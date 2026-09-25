package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/OstKost/avari-links/apps/api/internal/domain"
	"github.com/OstKost/avari-links/apps/api/internal/handler"
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

func (m *mockLinkService) GetByID(ctx context.Context, id string) (*domain.Link, error) {
	args := m.Called(ctx, id)
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

func (m *mockLinkService) ToggleStatus(ctx context.Context, id string, isActive bool) (*domain.Link, error) {
	args := m.Called(ctx, id, isActive)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Link), args.Error(1)
}

func (m *mockLinkService) RecordClick(ctx context.Context, code string) (string, error) {
	args := m.Called(ctx, code)
	return args.String(0), args.Error(1)
}

func (m *mockLinkService) Delete(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func TestLinkHandler_Create(t *testing.T) {
	validate := validator.New()

	t.Run("successfully creates link", func(t *testing.T) {
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
			OriginalURL: "https://google.com",
			Title:       "Google",
		}).Return(expectedLink, nil)

		body, _ := json.Marshal(handler.CreateLinkRequest{
			OriginalURL: "https://google.com",
			Title:       "Google",
		})

		req := httptest.NewRequest(http.MethodPost, "/api/v1/links", bytes.NewReader(body))
		w := httptest.NewRecorder()

		h.Create(w, req)

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
}

func TestRedirectHandler_Redirect(t *testing.T) {
	t.Run("redirects to target url with 302", func(t *testing.T) {
		svc := new(mockLinkService)
		h := handler.NewRedirectHandler(svc)

		svc.On("RecordClick", mock.Anything, "go123").Return("https://go.dev", nil)

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

		svc.On("RecordClick", mock.Anything, "missing").Return("", domain.ErrNotFound)

		r := chi.NewRouter()
		r.Get("/s/{code}", h.Redirect)

		req := httptest.NewRequest(http.MethodGet, "/s/missing", nil)
		w := httptest.NewRecorder()

		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNotFound, w.Code)
		svc.AssertExpectations(t)
	})
}
