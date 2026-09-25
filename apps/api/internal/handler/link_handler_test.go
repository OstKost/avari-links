package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/OstKost/avari-links/apps/api/internal/domain"
	"github.com/OstKost/avari-links/apps/api/internal/handler"
	"github.com/OstKost/avari-links/apps/api/internal/middleware"
	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

type mockLinkService struct {
	mock.Mock
}

func (m *mockLinkService) Create(ctx context.Context, dto domain.CreateLinkDTO) (*domain.Link, error) {
	args := m.Called(ctx, dto)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Link), args.Error(1)
}

func (m *mockLinkService) GetByID(ctx context.Context, id string, userID string) (*domain.Link, error) {
	args := m.Called(ctx, id, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Link), args.Error(1)
}

func (m *mockLinkService) GetByCode(ctx context.Context, code string) (*domain.Link, error) {
	args := m.Called(ctx, code)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Link), args.Error(1)
}

func (m *mockLinkService) List(ctx context.Context, filter domain.ListLinksFilter) ([]*domain.Link, int64, error) {
	args := m.Called(ctx, filter)
	if args.Get(0) == nil {
		return nil, args.Get(1).(int64), args.Error(2)
	}
	return args.Get(0).([]*domain.Link), args.Get(1).(int64), args.Error(2)
}

func (m *mockLinkService) ToggleStatus(ctx context.Context, id string, userID string, isActive bool) (*domain.Link, error) {
	args := m.Called(ctx, id, userID, isActive)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Link), args.Error(1)
}

func (m *mockLinkService) RecordClick(ctx context.Context, code string) (string, error) {
	args := m.Called(ctx, code)
	return args.String(0), args.Error(1)
}

func (m *mockLinkService) Delete(ctx context.Context, id string, userID string) error {
	args := m.Called(ctx, id, userID)
	return args.Error(0)
}

func TestLinkHandler_Create(t *testing.T) {
	validate := validator.New()

	t.Run("successfully creates link with session", func(t *testing.T) {
		svc := new(mockLinkService)
		h := handler.NewLinkHandler(svc, validate)

		expectedLink := &domain.Link{
			ID:          "uuid-123",
			OriginalURL: "https://google.com",
			Code:        "abc123",
			ShortURL:    "http://localhost:4820/s/abc123",
			Title:       "Google",
			IsActive:    true,
			CreatedAt:   time.Now().UTC(),
			UpdatedAt:   time.Now().UTC(),
		}

		svc.On("Create", mock.Anything, domain.CreateLinkDTO{
			UserID:      "session-1",
			OriginalURL: "https://google.com",
			Title:       "Google",
		}).Return(expectedLink, nil)

		body, _ := json.Marshal(handler.CreateLinkRequest{
			OriginalURL: "https://google.com",
			Title:       "Google",
		})

		req := httptest.NewRequest(http.MethodPost, "/api/v1/links", bytes.NewReader(body))
		ctx := context.WithValue(req.Context(), middleware.SessionContextKey, &domain.Session{ID: "session-1"})
		w := httptest.NewRecorder()

		h.Create(w, req.WithContext(ctx))

		assert.Equal(t, http.StatusCreated, w.Code)

		var resp handler.LinkResponse
		err := json.NewDecoder(w.Body).Decode(&resp)
		require.NoError(t, err)
		assert.Equal(t, "uuid-123", resp.ID)
		assert.Equal(t, "abc123", resp.Code)
		svc.AssertExpectations(t)
	})

	t.Run("returns bad request on invalid URL format", func(t *testing.T) {
		svc := new(mockLinkService)
		h := handler.NewLinkHandler(svc, validate)

		body, _ := json.Marshal(map[string]string{
			"original_url": "invalid-url-string",
		})

		req := httptest.NewRequest(http.MethodPost, "/api/v1/links", bytes.NewReader(body))
		w := httptest.NewRecorder()

		h.Create(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("returns unauthorized when session is missing", func(t *testing.T) {
		svc := new(mockLinkService)
		h := handler.NewLinkHandler(svc, validate)

		body, _ := json.Marshal(handler.CreateLinkRequest{
			OriginalURL: "https://example.com",
			Title:       "Example",
		})

		req := httptest.NewRequest(http.MethodPost, "/api/v1/links", bytes.NewReader(body))
		w := httptest.NewRecorder()

		h.Create(w, req)

		assert.Equal(t, http.StatusUnauthorized, w.Code)
	})
}

func TestRedirectHandler_Redirect(t *testing.T) {
	t.Run("redirects to target url with 302", func(t *testing.T) {
		svc := new(mockLinkService)
		h := handler.NewRedirectHandler(svc)

		svc.On("RecordClick", mock.Anything, "go123").Return("https://go.dev", nil)
		svc.On("GetByCode", mock.Anything, "go123").Return(&domain.Link{OriginalURL: "https://go.dev", IsActive: true}, nil)

		r := chi.NewRouter()
		r.Get("/s/{code}", h.Redirect)

		req := httptest.NewRequest(http.MethodGet, "/s/go123", nil)
		w := httptest.NewRecorder()

		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusFound, w.Code)
		assert.Equal(t, "https://go.dev", w.Header().Get("Location"))
		svc.AssertExpectations(t)
	})

	t.Run("returns 404 on not found code", func(t *testing.T) {
		svc := new(mockLinkService)
		h := handler.NewRedirectHandler(svc)

		svc.On("GetByCode", mock.Anything, "missing").Return(nil, domain.ErrNotFound)

		r := chi.NewRouter()
		r.Get("/s/{code}", h.Redirect)

		req := httptest.NewRequest(http.MethodGet, "/s/missing", nil)
		w := httptest.NewRecorder()

		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNotFound, w.Code)
		svc.AssertExpectations(t)
	})

	t.Run("returns 410 HTML page when link is deactivated", func(t *testing.T) {
		svc := new(mockLinkService)
		h := handler.NewRedirectHandler(svc)

		svc.On("GetByCode", mock.Anything, "inactive-slug").Return(&domain.Link{
			OriginalURL: "https://example.com/expired",
			Code:        "inactive-slug",
			IsActive:    false,
		}, nil)

		r := chi.NewRouter()
		r.Get("/s/{code}", h.Redirect)

		req := httptest.NewRequest(http.MethodGet, "/s/inactive-slug", nil)
		w := httptest.NewRecorder()

		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusGone, w.Code)
		assert.Contains(t, w.Header().Get("Content-Type"), "text/html")
		assert.Contains(t, w.Body.String(), "Ссылка деактивирована")
		assert.Contains(t, w.Body.String(), "Ссылка временно отключена")
		assert.Contains(t, w.Body.String(), "Avari Links")
		assert.Contains(t, w.Body.String(), "/s/inactive-slug")
		assert.Empty(t, w.Header().Get("Location"))
		svc.AssertExpectations(t)
	})

	t.Run("returns 410 JSON when link is deactivated and client requests JSON", func(t *testing.T) {
		svc := new(mockLinkService)
		h := handler.NewRedirectHandler(svc)

		svc.On("GetByCode", mock.Anything, "inactive-json").Return(&domain.Link{
			OriginalURL: "https://example.com/expired",
			Code:        "inactive-json",
			IsActive:    false,
		}, nil)

		r := chi.NewRouter()
		r.Get("/s/{code}", h.Redirect)

		req := httptest.NewRequest(http.MethodGet, "/s/inactive-json", nil)
		req.Header.Set("Accept", "application/json")
		w := httptest.NewRecorder()

		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusGone, w.Code)
		assert.Contains(t, w.Header().Get("Content-Type"), "application/json")
		assert.Contains(t, w.Body.String(), `"error":"This shortened link is currently deactivated"`)
		svc.AssertExpectations(t)
	})
}

func TestRedirectHandler_NSFWWarning(t *testing.T) {
	svc := new(mockLinkService)
	h := handler.NewRedirectHandler(svc)
	svc.On("GetByCode", mock.Anything, "adult-link").Return(&domain.Link{OriginalURL: "https://example.com/xxx", IsActive: true, IsNSFW: true}, nil)
	svc.On("RecordClick", mock.Anything, "adult-link").Return("https://example.com/xxx", nil)
	r := chi.NewRouter()
	r.Get("/s/{code}", h.Redirect)
	r.Post("/s/{code}/continue", h.Continue)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/s/adult-link", nil))
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "Возможен контент 18+")
	assert.NotContains(t, w.Header().Get("Location"), "example.com")
	svc.AssertNotCalled(t, "RecordClick", mock.Anything, mock.Anything)

	withoutConsent := httptest.NewRecorder()
	r.ServeHTTP(withoutConsent, httptest.NewRequest(http.MethodPost, "/s/adult-link/continue", nil))
	assert.Equal(t, http.StatusForbidden, withoutConsent.Code)
	svc.AssertNotCalled(t, "RecordClick", mock.Anything, mock.Anything)

	match := regexp.MustCompile(`name="consent_token" value="([a-f0-9]+)"`).FindStringSubmatch(w.Body.String())
	require.Len(t, match, 2)
	cookies := w.Result().Cookies()
	require.Len(t, cookies, 1)
	form := url.Values{"consent_token": {match[1]}}
	req := httptest.NewRequest(http.MethodPost, "/s/adult-link/continue", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.AddCookie(cookies[0])
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusFound, w.Code)
	assert.Equal(t, "https://example.com/xxx", w.Header().Get("Location"))
	svc.AssertExpectations(t)
}

type mockPreviewService struct {
	mock.Mock
}

func (m *mockPreviewService) Inspect(ctx context.Context, rawURL string) (*domain.LinkPreview, error) {
	args := m.Called(ctx, rawURL)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.LinkPreview), args.Error(1)
}

func TestLinkHandler_Preview(t *testing.T) {
	validate := validator.New()

	t.Run("returns preview metadata successfully", func(t *testing.T) {
		svc := new(mockLinkService)
		prev := new(mockPreviewService)
		h := handler.NewLinkHandler(svc, validate, prev)

		prev.On("Inspect", mock.Anything, "https://example.com/page").Return(&domain.LinkPreview{
			URL:         "https://example.com/page",
			IsReachable: true,
			StatusCode:  200,
			Title:       "Example Page",
			Description: "Example description",
			ImageURL:    "https://example.com/og.jpg",
			FaviconURL:  "https://example.com/favicon.ico",
			SiteName:    "Example Site",
		}, nil)

		r := chi.NewRouter()
		r.Post("/api/v1/links/preview", h.Preview)

		body := []byte(`{"url":"https://example.com/page"}`)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/links/preview", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		var resp handler.PreviewLinkResponse
		err := json.NewDecoder(w.Body).Decode(&resp)
		require.NoError(t, err)

		assert.True(t, resp.IsReachable)
		assert.Equal(t, 200, resp.StatusCode)
		assert.Equal(t, "Example Page", resp.Title)
		assert.Equal(t, "https://example.com/og.jpg", resp.ImageURL)
		prev.AssertExpectations(t)
	})

	t.Run("returns 400 for invalid URL", func(t *testing.T) {
		svc := new(mockLinkService)
		prev := new(mockPreviewService)
		h := handler.NewLinkHandler(svc, validate, prev)

		r := chi.NewRouter()
		r.Post("/api/v1/links/preview", h.Preview)

		body := []byte(`{"url":"not-a-valid-url"}`)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/links/preview", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}
