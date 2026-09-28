package handler_test

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/OstKost/avari-links/apps/api/internal/domain"
	"github.com/OstKost/avari-links/apps/api/internal/handler"
	"github.com/go-playground/validator/v10"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	_ "modernc.org/sqlite"
)

func TestRouter_AuthAndLinksEndpoints(t *testing.T) {
	validate := validator.New()
	mockSvc := new(mockLinkService)
	mockSessionSvc := new(mockSessionService)
	mockAuthRepo := new(mockAuthLinkRepository)

	linkH := handler.NewLinkHandler(mockSvc, validate)
	redirectH := handler.NewRedirectHandler(mockSvc)
	authH := handler.NewAuthHandler(mockSessionSvc, mockAuthRepo, validate)

	db, err := sql.Open("sqlite", ":memory:")
	require.NoError(t, err)
	defer db.Close()

	r := handler.NewRouter(handler.RouterConfig{
		LinkHandler:     linkH,
		RedirectHandler: redirectH,
		AuthHandler:     authH,
		SessionService:  mockSessionSvc,
		DB:              db,
		AllowedOrigins:  []string{"http://localhost:4810"},
	})

	t.Run("POST /api/v1/auth/session succeeds", func(t *testing.T) {
		session := &domain.SessionWithKey{
			Session: domain.Session{
				ID:           "sess-123",
				KeyHash:      "hash-123",
				LastActiveAt: time.Now(),
				CreatedAt:    time.Now(),
				UpdatedAt:    time.Now(),
			},
			AccessKey: "test-user-magic-9999",
		}
		mockSessionSvc.On("CreateSession", mock.Anything).Return(session, nil).Once()

		req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/session", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusCreated, w.Code)
		var resp handler.SessionResponse
		err := json.NewDecoder(w.Body).Decode(&resp)
		require.NoError(t, err)
		assert.Equal(t, "sess-123", resp.ID)
		assert.Equal(t, "test-user-magic-9999", resp.AccessKey)
	})

	t.Run("GET /api/v1/links without session returns empty list", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/links", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		var resp handler.PaginatedListResponse
		err := json.NewDecoder(w.Body).Decode(&resp)
		require.NoError(t, err)
		assert.Equal(t, int64(0), resp.Total)
		assert.Empty(t, resp.Data)
	})

	t.Run("POST /api/v1/links without trailing slash routes properly", func(t *testing.T) {
		session := &domain.Session{
			ID: "sess-123",
		}
		mockSessionSvc.On("GetSessionByKey", mock.Anything, "test-key").Return(session, nil).Once()
		mockSessionSvc.On("TouchSession", mock.Anything, "sess-123").Return(nil).Maybe()

		expectedLink := &domain.Link{
			ID:          "link-1",
			OriginalURL: "https://example.com",
			Code:        "abc123",
			ShortURL:    "http://localhost:4820/s/abc123",
			Title:       "Example",
			IsActive:    true,
		}
		mockSvc.On("Create", mock.Anything, mock.MatchedBy(func(dto domain.CreateLinkDTO) bool {
			return dto.UserID == "sess-123" && dto.OriginalURL == "https://example.com"
		})).Return(expectedLink, nil).Once()

		body, _ := json.Marshal(map[string]string{
			"original_url": "https://example.com",
		})
		req := httptest.NewRequest(http.MethodPost, "/api/v1/links", bytes.NewReader(body))
		req.Header.Set("X-Session-Key", "test-key")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusCreated, w.Code)
	})

	t.Run("POST /api/v1/auth/session succeeds even with invalid X-Session-Key header", func(t *testing.T) {
		session := &domain.SessionWithKey{
			Session: domain.Session{
				ID:           "sess-new",
				KeyHash:      "hash-new",
				LastActiveAt: time.Now(),
				CreatedAt:    time.Now(),
				UpdatedAt:    time.Now(),
			},
			AccessKey: "new-valid-key-1111",
		}
		mockSessionSvc.On("CreateSession", mock.Anything).Return(session, nil).Once()

		req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/session", nil)
		req.Header.Set("X-Session-Key", "invalid-or-expired-key")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusCreated, w.Code)
		var resp handler.SessionResponse
		err := json.NewDecoder(w.Body).Decode(&resp)
		require.NoError(t, err)
		assert.Equal(t, "sess-new", resp.ID)
		assert.Equal(t, "new-valid-key-1111", resp.AccessKey)
	})

	t.Run("POST /api/v1/auth/restore succeeds even with invalid X-Session-Key header", func(t *testing.T) {
		session := &domain.SessionWithKey{
			Session: domain.Session{
				ID:           "sess-restored",
				KeyHash:      "hash-restored",
				LastActiveAt: time.Now(),
				CreatedAt:    time.Now(),
				UpdatedAt:    time.Now(),
			},
			AccessKey: "target-restore-key-2222",
		}
		mockSessionSvc.On("RestoreSession", mock.Anything, "target-restore-key-2222").Return(session, nil).Once()

		body, _ := json.Marshal(handler.RestoreSessionRequest{
			AccessKey: "target-restore-key-2222",
		})
		req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/restore", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Session-Key", "invalid-or-expired-key")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		var resp handler.SessionResponse
		err := json.NewDecoder(w.Body).Decode(&resp)
		require.NoError(t, err)
		assert.Equal(t, "sess-restored", resp.ID)
		assert.Equal(t, "target-restore-key-2222", resp.AccessKey)
	})
}
