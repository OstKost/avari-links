package sqlite

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/OstKost/avari-links/apps/api/internal/domain"
)

// linkRepository implements domain.LinkRepository using SQLite.
type linkRepository struct {
	db *sql.DB
}

// NewLinkRepository creates a new SQLite-backed link repository.
func NewLinkRepository(db *sql.DB) domain.LinkRepository {
	return &linkRepository{db: db}
}

func (r *linkRepository) Create(ctx context.Context, link *domain.Link) error {
	query := `
		INSERT INTO links (id, user_id, original_url, code, title, clicks, is_active, is_nsfw, last_clicked_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	var isActiveInt int
	if link.IsActive {
		isActiveInt = 1
	}

	var isNSFWInt int
	if link.IsNSFW {
		isNSFWInt = 1
	}

	_, err := r.db.ExecContext(
		ctx,
		query,
		link.ID,
		link.UserID,
		link.OriginalURL,
		link.Code,
		link.Title,
		link.Clicks,
		isActiveInt,
		isNSFWInt,
		link.LastClickedAt,
		link.CreatedAt,
		link.UpdatedAt,
	)

	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") || strings.Contains(err.Error(), "constraint failed: UNIQUE") {
			return domain.ErrConflict
		}
		return fmt.Errorf("failed to insert link: %w", err)
	}

	return nil
}

func (r *linkRepository) GetByID(ctx context.Context, id string) (*domain.Link, error) {
	query := `
		SELECT id, user_id, original_url, code, title, clicks, is_active, is_nsfw, last_clicked_at, created_at, updated_at
		FROM links
		WHERE id = ?
	`

	row := r.db.QueryRowContext(ctx, query, id)
	return r.scanLink(row)
}

func (r *linkRepository) GetByCode(ctx context.Context, code string) (*domain.Link, error) {
	query := `
		SELECT id, user_id, original_url, code, title, clicks, is_active, is_nsfw, last_clicked_at, created_at, updated_at
		FROM links
		WHERE code = ?
	`

	row := r.db.QueryRowContext(ctx, query, code)
	return r.scanLink(row)
}

func (r *linkRepository) List(ctx context.Context, filter domain.ListLinksFilter) ([]*domain.Link, int64, error) {
	var conditions []string
	var args []interface{}

	if filter.UserID != "" {
		conditions = append(conditions, "user_id = ?")
		args = append(args, filter.UserID)
	}

	if filter.Search != "" {
		pattern := "%" + strings.ToLower(filter.Search) + "%"
		conditions = append(conditions, "(LOWER(title) LIKE ? OR LOWER(original_url) LIKE ? OR LOWER(code) LIKE ?)")
		args = append(args, pattern, pattern, pattern)
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = "WHERE " + strings.Join(conditions, " AND ")
	}

	// Count total matching rows
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM links %s", whereClause)
	var total int64
	if err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count links: %w", err)
	}

	// Fetch page
	limit := filter.Limit
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	offset := filter.Offset
	if offset < 0 {
		offset = 0
	}

	selectQuery := fmt.Sprintf(`
		SELECT id, user_id, original_url, code, title, clicks, is_active, is_nsfw, last_clicked_at, created_at, updated_at
		FROM links
		%s
		ORDER BY created_at DESC
		LIMIT ? OFFSET ?
	`, whereClause)

	queryArgs := append(args, limit, offset)
	rows, err := r.db.QueryContext(ctx, selectQuery, queryArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query links list: %w", err)
	}
	defer rows.Close()

	var links []*domain.Link
	for rows.Next() {
		link, err := r.scanLink(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan link row: %w", err)
		}
		links = append(links, link)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("error iterating link rows: %w", err)
	}

	return links, total, nil
}

func (r *linkRepository) CountByUser(ctx context.Context, userID string) (int64, error) {
	query := `SELECT COUNT(*) FROM links WHERE user_id = ?`
	var count int64
	if err := r.db.QueryRowContext(ctx, query, userID).Scan(&count); err != nil {
		return 0, fmt.Errorf("failed to count links by user: %w", err)
	}
	return count, nil
}

func (r *linkRepository) UpdateStatus(ctx context.Context, id string, isActive bool) error {
	query := `
		UPDATE links
		SET is_active = ?, updated_at = ?
		WHERE id = ?
	`

	var isActiveInt int
	if isActive {
		isActiveInt = 1
	}

	res, err := r.db.ExecContext(ctx, query, isActiveInt, time.Now().UTC(), id)
	if err != nil {
		return fmt.Errorf("failed to update link status: %w", err)
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return domain.ErrNotFound
	}

	return nil
}

func (r *linkRepository) IncrementClicks(ctx context.Context, id string, clickedAt time.Time) error {
	query := `
		UPDATE links
		SET clicks = clicks + 1, last_clicked_at = ?, updated_at = ?
		WHERE id = ?
	`

	_, err := r.db.ExecContext(ctx, query, clickedAt, clickedAt, id)
	if err != nil {
		return fmt.Errorf("failed to increment clicks: %w", err)
	}

	return nil
}

func (r *linkRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM links WHERE id = ?`

	res, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete link: %w", err)
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return domain.ErrNotFound
	}

	return nil
}

func (r *linkRepository) ExistsCode(ctx context.Context, code string) (bool, error) {
	query := `SELECT 1 FROM links WHERE code = ? LIMIT 1`
	var exists int
	err := r.db.QueryRowContext(ctx, query, code).Scan(&exists)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("failed to check code existence: %w", err)
	}
	return true, nil
}

type rowScanner interface {
	Scan(dest ...interface{}) error
}

func (r *linkRepository) scanLink(scanner rowScanner) (*domain.Link, error) {
	var (
		link          domain.Link
		userID        sql.NullString
		isActiveInt   int
		isNSFWInt     int
		lastClickedAt sql.NullTime
	)

	err := scanner.Scan(
		&link.ID,
		&userID,
		&link.OriginalURL,
		&link.Code,
		&link.Title,
		&link.Clicks,
		&isActiveInt,
		&isNSFWInt,
		&lastClickedAt,
		&link.CreatedAt,
		&link.UpdatedAt,
	)

	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	if userID.Valid {
		uid := userID.String
		link.UserID = &uid
	}

	link.IsActive = (isActiveInt == 1)
	link.IsNSFW = (isNSFWInt == 1)
	if lastClickedAt.Valid {
		t := lastClickedAt.Time.UTC()
		link.LastClickedAt = &t
	}

	return &link, nil
}
