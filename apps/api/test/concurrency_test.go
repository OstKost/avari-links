package test_test

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/OstKost/avari-links/apps/api/internal/database"
	"github.com/OstKost/avari-links/apps/api/internal/domain"
	"github.com/OstKost/avari-links/apps/api/internal/handler"
	"github.com/OstKost/avari-links/apps/api/internal/repository/sqlite"
	"github.com/OstKost/avari-links/apps/api/internal/service"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConcurrency_ClickTracking(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "test_concurrency.db")
	db, err := database.NewConnection(dbPath)
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })

	err = database.Migrate(db)
	require.NoError(t, err)

	validate := validator.New()
	linkRepo := sqlite.NewLinkRepository(db)
	sessionRepo := sqlite.NewSessionRepository(db)
	linkService := service.NewLinkService(linkRepo, "http://localhost:4820", 6)
	sessionService := service.NewSessionService(sessionRepo, linkRepo)

	linkHandler := handler.NewLinkHandler(linkService, validate)
	authHandler := handler.NewAuthHandler(sessionService, linkRepo, validate)
	redirectHandler := handler.NewRedirectHandler(linkService)

	router := handler.NewRouter(handler.RouterConfig{
		LinkHandler:     linkHandler,
		RedirectHandler: redirectHandler,
		AuthHandler:     authHandler,
		SessionService:  sessionService,
		DB:              db,
	})

	// Pre-create a link directly
	linkID := uuid.NewString()
	code := "concurrent-test"
	now := time.Now().UTC()
	err = linkRepo.Create(context.Background(), &domain.Link{
		ID:          linkID,
		OriginalURL: "https://example.com/fast-target",
		Code:        code,
		Title:       "Concurrency Test",
		IsActive:    true,
		Clicks:      0,
		CreatedAt:   now,
		UpdatedAt:   now,
	})
	require.NoError(t, err)

	// Fire 30 concurrent redirect requests
	const numRequests = 30
	var wg sync.WaitGroup
	wg.Add(numRequests)

	for i := 0; i < numRequests; i++ {
		go func() {
			defer wg.Done()
			req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/s/%s", code), nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)
			assert.Equal(t, http.StatusFound, w.Code)
		}()
	}

	wg.Wait()

	// Allow background goroutines to complete DB updates
	require.Eventually(t, func() bool {
		l, err := linkRepo.GetByID(context.Background(), linkID)
		if err != nil {
			return false
		}
		return l.Clicks == int64(numRequests)
	}, 3*time.Second, 50*time.Millisecond, "expected %d clicks to be recorded concurrently", numRequests)
}
