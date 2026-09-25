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

func setupTestDB(t *testing.T) (*sql.DB, domain.LinkRepository) {
	t.Helper()
	// Unique in-memory DB per test
	db, err := sql.Open("sqlite", "file:"+uuid.New().String()+"?mode=memory&cache=shared")
	require.NoError(t, err)

	err = database.Migrate(db)
	require.NoError(t, err)

	t.Cleanup(func() {
		_ = db.Close()
	})

	repo := sqlite.NewLinkRepository(db)
	return db, repo
}

func TestLinkRepository_CRUD(t *testing.T) {
	ctx := context.Background()
	_, repo := setupTestDB(t)

	now := time.Now().UTC().Truncate(time.Second)
	link := &domain.Link{
		ID:          uuid.New().String(),
		OriginalURL: "https://example.com/very/long/url",
		Code:        "ex1234",
		Title:       "Example Link",
		Clicks:      0,
		IsActive:    true,
		IsNSFW:      true,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	// 1. Create
	err := repo.Create(ctx, link)
	require.NoError(t, err)

	// 2. Duplicate Code -> Conflict
	dup := *link
	dup.ID = uuid.New().String()
	err = repo.Create(ctx, &dup)
	assert.ErrorIs(t, err, domain.ErrConflict)

	// 3. GetByID
	found, err := repo.GetByID(ctx, link.ID)
	require.NoError(t, err)
	assert.Equal(t, link.ID, found.ID)
	assert.Equal(t, link.OriginalURL, found.OriginalURL)
	assert.Equal(t, link.Code, found.Code)
	assert.Equal(t, link.Title, found.Title)
	assert.True(t, found.IsActive)
	assert.True(t, found.IsNSFW)

	// 4. GetByCode
	foundCode, err := repo.GetByCode(ctx, "ex1234")
	require.NoError(t, err)
	assert.Equal(t, link.ID, foundCode.ID)

	// 5. ExistsCode
	exists, err := repo.ExistsCode(ctx, "ex1234")
	require.NoError(t, err)
	assert.True(t, exists)

	notExists, err := repo.ExistsCode(ctx, "random99")
	require.NoError(t, err)
	assert.False(t, notExists)

	// 6. IncrementClicks
	clickTime := time.Now().UTC()
	err = repo.IncrementClicks(ctx, link.ID, clickTime)
	require.NoError(t, err)

	updated, err := repo.GetByID(ctx, link.ID)
	require.NoError(t, err)
	assert.Equal(t, int64(1), updated.Clicks)
	assert.NotNil(t, updated.LastClickedAt)

	// 7. UpdateStatus
	err = repo.UpdateStatus(ctx, link.ID, false)
	require.NoError(t, err)

	deactivated, err := repo.GetByID(ctx, link.ID)
	require.NoError(t, err)
	assert.False(t, deactivated.IsActive)

	// 8. List & Search
	links, total, err := repo.List(ctx, domain.ListLinksFilter{Search: "example"})
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	assert.Len(t, links, 1)

	// 9. Delete
	err = repo.Delete(ctx, link.ID)
	require.NoError(t, err)

	_, err = repo.GetByID(ctx, link.ID)
	assert.ErrorIs(t, err, domain.ErrNotFound)
}
