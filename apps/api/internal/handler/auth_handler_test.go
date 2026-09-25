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
	"github.com/OstKost/avari-links/apps/api/internal/middleware"
	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

type mockSessionService struct {
	mock.Mock
}

func (m *mockSessionService) CreateSession(ctx context.Context) (*domain.SessionWithKey, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.SessionWithKey), args.Error(1)
}

func (m *mockSessionService) RestoreSession(ctx context.Context, rawKey string) (*domain.SessionWithKey, error) {
	args := m.Called(ctx, rawKey)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.SessionWithKey), args.Error(1)
}

func (m *mockSessionService) GetSessionByKey(ctx context.Context, rawKey string) (*domain.Session, error) {
	args := m.Called(ctx, rawKey)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Session), args.Error(1)
}

func (m *mockSessionService) TouchSession(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *mockSessionService) CleanupInactive(ctx context.Context, inactiveDuration time.Duration) (int64, error) {
	args := m.Called(ctx, inactiveDuration)
	return args.Get(0).(int64), args.Error(1)
}

type mockAuthLinkRepository struct {
	mock.Mock
}

func (m *mockAuthLinkRepository) Create(ctx context.Context, link *domain.Link) error {
	args := m.Called(ctx, link)
	return args.Error(0)
}

func (m *mockAuthLinkRepository) GetByID(ctx context.Context, id string) (*domain.Link, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Link), args.Error(1)
}

func (m *mockAuthLinkRepository) GetByCode(ctx context.Context, code string) (*domain.Link, error) {
	args := m.Called(ctx, code)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Link), args.Error(1)
}

func (m *mockAuthLinkRepository) List(ctx context.Context, filter domain.ListLinksFilter) ([]*domain.Link, int64, error) {
	args := m.Called(ctx, filter)
	if args.Get(0) == nil {
		return nil, args.Get(1).(int64), args.Error(2)
	}
	return args.Get(0).([]*domain.Link), args.Get(1).(int64), args.Error(2)
}

func (m *mockAuthLinkRepository) CountByUser(ctx context.Context, userID string) (int64, error) {
	args := m.Called(ctx, userID)
	return args.Get(0).(int64), args.Error(1)
}

func (m *mockAuthLinkRepository) UpdateStatus(ctx context.Context, id string, isActive bool) error {
	args := m.Called(ctx, id, isActive)
	return args.Error(0)
}

func (m *mockAuthLinkRepository) IncrementClicks(ctx context.Context, id string, clickedAt time.Time) error {
	args := m.Called(ctx, id, clickedAt)
	return args.Error(0)
}

func (m *mockAuthLinkRepository) Delete(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *mockAuthLinkRepository) ExistsCode(ctx context.Context, code string) (bool, error) {
	args := m.Called(ctx, code)
	return args.Bool(0), args.Error(1)
}

func TestAuthHandler_CreateSession(t *testing.T) {
	mockService := new(mockSessionService)
	mockLinkRepo := new(mockAuthLinkRepository)
	validate := validator.New()

	authHandler := handler.NewAuthHandler(mockService, mockLinkRepo, validate)

	r := chi.NewRouter()
	r.Post("/api/v1/auth/session", authHandler.CreateSession)

	mockService.On("CreateSession", mock.Anything).Return(&domain.SessionWithKey{
		Session: domain.Session{
			ID:           "test-id-123",
			LastActiveAt: time.Now().UTC(),
			CreatedAt:    time.Now().UTC(),
		},
		AccessKey:  "cosmic-totoro-4081",
		LinksCount: 0,
	}, nil)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/session", nil)
	rec := httptest.NewRecorder()

	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusCreated, rec.Code)

	var resp handler.SessionResponse
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.Equal(t, "test-id-123", resp.ID)
	assert.Equal(t, "cosmic-totoro-4081", resp.AccessKey)
}

func TestAuthHandler_RestoreSession(t *testing.T) {
	mockService := new(mockSessionService)
	mockLinkRepo := new(mockAuthLinkRepository)
	validate := validator.New()

	authHandler := handler.NewAuthHandler(mockService, mockLinkRepo, validate)

	r := chi.NewRouter()
	r.Post("/api/v1/auth/restore", authHandler.RestoreSession)

	t.Run("Success", func(t *testing.T) {
		mockService.On("RestoreSession", mock.Anything, "cosmic-totoro-4081").Return(&domain.SessionWithKey{
			Session: domain.Session{
				ID:           "test-id-123",
				LastActiveAt: time.Now().UTC(),
				CreatedAt:    time.Now().UTC(),
			},
			AccessKey:  "cosmic-totoro-4081",
			LinksCount: 2,
		}, nil)

		body, _ := json.Marshal(map[string]string{"access_key": "cosmic-totoro-4081"})
		req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/restore", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		r.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		var resp handler.SessionResponse
		err := json.Unmarshal(rec.Body.Bytes(), &resp)
		require.NoError(t, err)
		assert.Equal(t, int64(2), resp.LinksCount)
	})

	t.Run("Invalid Key", func(t *testing.T) {
		mockService.On("RestoreSession", mock.Anything, "wrong-key").Return(nil, domain.ErrInvalidSessionKey)

		body, _ := json.Marshal(map[string]string{"access_key": "wrong-key"})
		req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/restore", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		r.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusUnauthorized, rec.Code)
	})
}

func TestAuthHandler_GetMe(t *testing.T) {
	mockService := new(mockSessionService)
	mockLinkRepo := new(mockAuthLinkRepository)
	validate := validator.New()

	authHandler := handler.NewAuthHandler(mockService, mockLinkRepo, validate)

	r := chi.NewRouter()
	r.Get("/api/v1/auth/me", authHandler.GetMe)

	t.Run("Unauthorized without session", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
		rec := httptest.NewRecorder()

		r.ServeHTTP(rec, req)
		assert.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	t.Run("Authorized with session", func(t *testing.T) {
		sess := &domain.Session{
			ID:           "test-user-id",
			LastActiveAt: time.Now().UTC(),
			CreatedAt:    time.Now().UTC(),
		}

		mockLinkRepo.On("CountByUser", mock.Anything, "test-user-id").Return(int64(5), nil)

		req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
		ctx := context.WithValue(req.Context(), middleware.SessionContextKey, sess)
		rec := httptest.NewRecorder()

		r.ServeHTTP(rec, req.WithContext(ctx))

		assert.Equal(t, http.StatusOK, rec.Code)
		var resp handler.SessionMeResponse
		err := json.Unmarshal(rec.Body.Bytes(), &resp)
		require.NoError(t, err)
		assert.Equal(t, int64(5), resp.LinksCount)
		assert.Equal(t, "test-user-id", resp.ID)
	})
}
