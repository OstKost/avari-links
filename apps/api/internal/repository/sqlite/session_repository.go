package sqlite

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/OstKost/avari-links/apps/api/internal/domain"
)

// sessionRepository implements domain.SessionRepository using SQLite.
type sessionRepository struct {
	db *sql.DB
}

// NewSessionRepository creates a new SQLite-backed session repository.
func NewSessionRepository(db *sql.DB) domain.SessionRepository {
	return &sessionRepository{db: db}
}

func (r *sessionRepository) Create(ctx context.Context, session *domain.Session) error {
	query := `
		INSERT INTO anonymous_sessions (id, key_hash, is_premium, last_active_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`
	_, err := r.db.ExecContext(
		ctx,
		query,
		session.ID,
		session.KeyHash,
		session.IsPremium,
		session.LastActiveAt,
		session.CreatedAt,
		session.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to insert session: %w", err)
	}
	return nil
}

func (r *sessionRepository) GetByID(ctx context.Context, id string) (*domain.Session, error) {
	query := `
		SELECT id, key_hash, is_premium, last_active_at, created_at, updated_at
		FROM anonymous_sessions
		WHERE id = ?
	`
	var s domain.Session
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&s.ID,
		&s.KeyHash,
		&s.IsPremium,
		&s.LastActiveAt,
		&s.CreatedAt,
		&s.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("failed to query session by id: %w", err)
	}
	return &s, nil
}

func (r *sessionRepository) GetByKeyHash(ctx context.Context, keyHash string) (*domain.Session, error) {
	query := `
		SELECT id, key_hash, is_premium, last_active_at, created_at, updated_at
		FROM anonymous_sessions
		WHERE key_hash = ?
	`
	var s domain.Session
	err := r.db.QueryRowContext(ctx, query, keyHash).Scan(
		&s.ID,
		&s.KeyHash,
		&s.IsPremium,
		&s.LastActiveAt,
		&s.CreatedAt,
		&s.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("failed to query session by key hash: %w", err)
	}
	return &s, nil
}

func (r *sessionRepository) TouchLastActive(ctx context.Context, id string, activeAt time.Time) error {
	query := `
		UPDATE anonymous_sessions
		SET last_active_at = ?, updated_at = ?
		WHERE id = ?
	`
	_, err := r.db.ExecContext(ctx, query, activeAt, activeAt, id)
	if err != nil {
		return fmt.Errorf("failed to touch session last_active_at: %w", err)
	}
	return nil
}

func (r *sessionRepository) CleanupInactiveSessions(ctx context.Context, olderThan time.Duration) (int64, error) {
	cutoff := time.Now().UTC().Add(-olderThan)
	premiumRetention := 2 * 365 * 24 * time.Hour
	premiumCutoff := time.Now().UTC().Add(-premiumRetention)

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback() // nolint:errcheck

	// 1. Delete inactive links belonging to Premium users (no activity for 2 years)
	// Premium user sessions are never deleted.
	deletePremiumLinksQuery := `
		DELETE FROM links
		WHERE user_id IN (SELECT id FROM anonymous_sessions WHERE is_premium = 1)
		  AND (
			(last_clicked_at IS NOT NULL AND last_clicked_at < ?)
			OR
			(last_clicked_at IS NULL AND created_at < ?)
		  )
	`
	if _, err := tx.ExecContext(ctx, deletePremiumLinksQuery, premiumCutoff, premiumCutoff); err != nil {
		return 0, fmt.Errorf("failed to clean up inactive premium links: %w", err)
	}

	// 2. Select non-premium session IDs eligible for purge:
	// - is_premium = 0
	// - session.last_active_at < cutoff
	// - AND none of the user's links have clicks >= cutoff
	// - AND none of the user's links were created >= cutoff (when unclicked)
	selectQuery := `
		SELECT id FROM anonymous_sessions
		WHERE is_premium = 0
		  AND last_active_at < ?
		  AND id NOT IN (
			SELECT DISTINCT user_id FROM links
			WHERE user_id IS NOT NULL
			  AND (
				(last_clicked_at IS NOT NULL AND last_clicked_at >= ?)
				OR
				(last_clicked_at IS NULL AND created_at >= ?)
			  )
		  )
	`
	rows, err := tx.QueryContext(ctx, selectQuery, cutoff, cutoff, cutoff)
	if err != nil {
		return 0, fmt.Errorf("failed to query inactive sessions: %w", err)
	}
	defer rows.Close()

	var sessionIDs []string
	for rows.Next() {
		var sid string
		if err := rows.Scan(&sid); err != nil {
			return 0, fmt.Errorf("failed to scan session id: %w", err)
		}
		sessionIDs = append(sessionIDs, sid)
	}
	if err := rows.Err(); err != nil {
		return 0, fmt.Errorf("rows iteration error: %w", err)
	}

	if len(sessionIDs) == 0 {
		if err := tx.Commit(); err != nil {
			return 0, fmt.Errorf("failed to commit session cleanup: %w", err)
		}
		return 0, nil
	}

	// 3. Delete links belonging to inactive non-premium sessions
	deleteLinksQuery := `
		DELETE FROM links
		WHERE user_id IN (` + placeholders(len(sessionIDs)) + `)
	`
	args := make([]interface{}, len(sessionIDs))
	for i, id := range sessionIDs {
		args[i] = id
	}

	if _, err := tx.ExecContext(ctx, deleteLinksQuery, args...); err != nil {
		return 0, fmt.Errorf("failed to delete links for inactive sessions: %w", err)
	}

	// 4. Delete the non-premium sessions themselves
	deleteSessionsQuery := `
		DELETE FROM anonymous_sessions
		WHERE id IN (` + placeholders(len(sessionIDs)) + `)
	`
	res, err := tx.ExecContext(ctx, deleteSessionsQuery, args...)
	if err != nil {
		return 0, fmt.Errorf("failed to delete inactive sessions: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return 0, fmt.Errorf("failed to commit session cleanup: %w", err)
	}

	affected, err := res.RowsAffected()
	if err != nil {
		return int64(len(sessionIDs)), nil
	}
	return affected, nil
}

func placeholders(n int) string {
	if n <= 0 {
		return ""
	}
	b := make([]byte, n*2-1)
	for i := 0; i < n; i++ {
		if i > 0 {
			b[i*2-1] = ','
		}
		b[i*2] = '?'
	}
	return string(b)
}
