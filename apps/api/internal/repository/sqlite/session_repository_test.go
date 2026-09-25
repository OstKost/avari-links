package sqlite_test

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"github.com/OstKost/avari-links/apps/api/internal/database"
	"github.com/OstKost/avari-links/apps/api/internal/domain"
	"github.com/OstKost/avari-links/apps/api/internal/repository/sqlite"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	_ "modernc.org/sqlite"
)

func setupSessionTestDB(t *testing.T) (*sql.DB, domain.SessionRepository, domain.LinkRepository) {
	t.Helper()
	db, err := sql.Open("sqlite", "file:"+uuid.New().String()+"?mode=memory&cache=shared")
	require.NoError(t, err)

	err = database.Migrate(db)
	require.NoError(t, err)

	t.Cleanup(func() {
		_ = db.Close()
	})

	sessionRepo := sqlite.NewSessionRepository(db)
	linkRepo := sqlite.NewLinkRepository(db)
	return db, sessionRepo, linkRepo
}

func TestSessionRepository_CRUD_And_Cleanup(t *testing.T) {
	ctx := context.Background()
	_, sessionRepo, linkRepo := setupSessionTestDB(t)

	now := time.Now().UTC()
	session := &domain.Session{
		ID:           uuid.NewString(),
		KeyHash:      "hash_12345",
		LastActiveAt: now,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	// 1. Create
	err := sessionRepo.Create(ctx, session)
	require.NoError(t, err)

	// 2. GetByID
	found, err := sessionRepo.GetByID(ctx, session.ID)
	require.NoError(t, err)
	assert.Equal(t, session.ID, found.ID)
	assert.Equal(t, session.KeyHash, found.KeyHash)

	// 3. GetByKeyHash
	foundByHash, err := sessionRepo.GetByKeyHash(ctx, "hash_12345")
	require.NoError(t, err)
	assert.Equal(t, session.ID, foundByHash.ID)

	// 4. TouchLastActive
	newActive := now.Add(10 * time.Minute)
	err = sessionRepo.TouchLastActive(ctx, session.ID, newActive)
	require.NoError(t, err)

	updated, err := sessionRepo.GetByID(ctx, session.ID)
	require.NoError(t, err)
	assert.True(t, updated.LastActiveAt.After(now))

	// 5. Test Cleanup of Inactive Sessions (100 days)
	// Create an old inactive session (101 days ago)
	oldTime := now.Add(-101 * 24 * time.Hour)
	oldSession := &domain.Session{
		ID:           uuid.NewString(),
		KeyHash:      "hash_old_inactive",
		LastActiveAt: oldTime,
		CreatedAt:    oldTime,
		UpdatedAt:    oldTime,
	}
	err = sessionRepo.Create(ctx, oldSession)
	require.NoError(t, err)

	// Old session link (also old, no recent clicks)
	oldLink := &domain.Link{
		ID:          uuid.NewString(),
		UserID:      &oldSession.ID,
		OriginalURL: "https://old.example.com",
		Code:        "old123",
		Title:       "Old Link",
		Clicks:      0,
		IsActive:    true,
		CreatedAt:   oldTime,
		UpdatedAt:   oldTime,
	}
	err = linkRepo.Create(ctx, oldLink)
	require.NoError(t, err)

	// Create another old session, but with active link clicks recently!
	activeLinkSession := &domain.Session{
		ID:           uuid.NewString(),
		KeyHash:      "hash_active_links",
		LastActiveAt: oldTime,
		CreatedAt:    oldTime,
		UpdatedAt:    oldTime,
	}
	err = sessionRepo.Create(ctx, activeLinkSession)
	require.NoError(t, err)

	recentClick := now.Add(-2 * 24 * time.Hour)
	linkWithRecentClicks := &domain.Link{
		ID:            uuid.NewString(),
		UserID:        &activeLinkSession.ID,
		OriginalURL:   "https://activelink.example.com",
		Code:          "act123",
		Title:         "Active Link",
		Clicks:        10,
		IsActive:      true,
		LastClickedAt: &recentClick,
		CreatedAt:     oldTime,
		UpdatedAt:     now,
	}
	err = linkRepo.Create(ctx, linkWithRecentClicks)
	require.NoError(t, err)

	// Run cleanup for 100 days
	purgedCount, err := sessionRepo.CleanupInactiveSessions(ctx, 100*24*time.Hour)
	require.NoError(t, err)
	assert.Equal(t, int64(1), purgedCount)

	// oldSession should be purged
	_, err = sessionRepo.GetByID(ctx, oldSession.ID)
	assert.ErrorIs(t, err, domain.ErrNotFound)

	// oldLink should be deleted
	_, err = linkRepo.GetByID(ctx, oldLink.ID)
	assert.ErrorIs(t, err, domain.ErrNotFound)

	// activeLinkSession and initial session should NOT be purged
	_, err = sessionRepo.GetByID(ctx, activeLinkSession.ID)
	require.NoError(t, err)
	_, err = sessionRepo.GetByID(ctx, session.ID)
	require.NoError(t, err)

	// 6. Test Premium Session Retention (Never purged, links preserved for 2 years)
	premSession := &domain.Session{
		ID:           uuid.NewString(),
		KeyHash:      "hash_premium_user",
		IsPremium:    true,
		LastActiveAt: oldTime, // 101 days old
		CreatedAt:    oldTime,
		UpdatedAt:    oldTime,
	}
	err = sessionRepo.Create(ctx, premSession)
	require.NoError(t, err)

	// Verify IsPremium is persisted and read back
	foundPrem, err := sessionRepo.GetByID(ctx, premSession.ID)
	require.NoError(t, err)
	assert.True(t, foundPrem.IsPremium)

	// Premium link (101 days old, within 2-year retention window)
	premRecentLink := &domain.Link{
		ID:          uuid.NewString(),
		UserID:      &premSession.ID,
		OriginalURL: "https://prem.example.com",
		Code:        "prem1",
		Title:       "Premium Link",
		Clicks:      0,
		IsActive:    true,
		CreatedAt:   oldTime,
		UpdatedAt:   oldTime,
	}
	err = linkRepo.Create(ctx, premRecentLink)
	require.NoError(t, err)

	// Very old premium link (more than 2 years inactive: 800 days old)
	veryOldTime := now.Add(-800 * 24 * time.Hour)
	premExpiredLink := &domain.Link{
		ID:          uuid.NewString(),
		UserID:      &premSession.ID,
		OriginalURL: "https://prem-expired.example.com",
		Code:        "prem2",
		Title:       "Expired Premium Link",
		Clicks:      0,
		IsActive:    true,
		CreatedAt:   veryOldTime,
		UpdatedAt:   veryOldTime,
	}
	err = linkRepo.Create(ctx, premExpiredLink)
	require.NoError(t, err)

	// Run cleanup
	_, err = sessionRepo.CleanupInactiveSessions(ctx, 100*24*time.Hour)
	require.NoError(t, err)

	// Premium session MUST NOT be purged
	_, err = sessionRepo.GetByID(ctx, premSession.ID)
	require.NoError(t, err)

	// Premium link under 2 years MUST be preserved
	_, err = linkRepo.GetByID(ctx, premRecentLink.ID)
	require.NoError(t, err)

	// Premium link older than 2 years MUST be deleted
	_, err = linkRepo.GetByID(ctx, premExpiredLink.ID)
	assert.ErrorIs(t, err, domain.ErrNotFound)
}
