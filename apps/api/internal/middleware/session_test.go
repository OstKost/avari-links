package middleware_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/OstKost/avari-links/apps/api/internal/domain"
	"github.com/OstKost/avari-links/apps/api/internal/middleware"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
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

func TestSessionMiddleware(t *testing.T) {
	t.Run("passes through without session when no header provided", func(t *testing.T) {
		svc := new(mockSessionService)
		mw := middleware.SessionMiddleware(svc)

		var capturedSession *domain.Session
		next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			capturedSession = middleware.GetSession(r.Context())
			w.WriteHeader(http.StatusOK)
		})

		req := httptest.NewRequest(http.MethodGet, "/api/v1/links", nil)
		w := httptest.NewRecorder()

		mw(next).ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		assert.Nil(t, capturedSession)
	})

	t.Run("authenticates session from X-Session-Key header", func(t *testing.T) {
		svc := new(mockSessionService)
		expectedSession := &domain.Session{
			ID:           "session-123",
			KeyHash:      "hash-123",
			LastActiveAt: time.Now().UTC(),
		}

		svc.On("GetSessionByKey", mock.Anything, "valid-secret-key").Return(expectedSession, nil)
		svc.On("TouchSession", mock.Anything, "session-123").Return(nil)

		mw := middleware.SessionMiddleware(svc)

		var capturedSession *domain.Session
		next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			capturedSession = middleware.GetSession(r.Context())
			w.WriteHeader(http.StatusOK)
		})

		req := httptest.NewRequest(http.MethodGet, "/api/v1/links", nil)
		req.Header.Set("X-Session-Key", "valid-secret-key")
		w := httptest.NewRecorder()

		mw(next).ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		assert.NotNil(t, capturedSession)
		assert.Equal(t, "session-123", capturedSession.ID)
	})

	t.Run("authenticates session from Bearer Authorization header", func(t *testing.T) {
		svc := new(mockSessionService)
		expectedSession := &domain.Session{
			ID:           "session-456",
			KeyHash:      "hash-456",
			LastActiveAt: time.Now().UTC(),
		}

		svc.On("GetSessionByKey", mock.Anything, "bearer-token-123").Return(expectedSession, nil)
		svc.On("TouchSession", mock.Anything, "session-456").Return(nil)

		mw := middleware.SessionMiddleware(svc)

		var capturedSession *domain.Session
		next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			capturedSession = middleware.GetSession(r.Context())
			w.WriteHeader(http.StatusOK)
		})

		req := httptest.NewRequest(http.MethodGet, "/api/v1/links", nil)
		req.Header.Set("Authorization", "Bearer bearer-token-123")
		w := httptest.NewRecorder()

		mw(next).ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		assert.NotNil(t, capturedSession)
		assert.Equal(t, "session-456", capturedSession.ID)
	})

	t.Run("returns 401 Unauthorized for invalid session key", func(t *testing.T) {
		svc := new(mockSessionService)
		svc.On("GetSessionByKey", mock.Anything, "invalid-key").Return(nil, errors.New("not found"))

		mw := middleware.SessionMiddleware(svc)

		nextCalled := false
		next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			nextCalled = true
		})

		req := httptest.NewRequest(http.MethodGet, "/api/v1/links", nil)
		req.Header.Set("X-Session-Key", "invalid-key")
		w := httptest.NewRecorder()

		mw(next).ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnauthorized, w.Code)
		assert.False(t, nextCalled)
		assert.Contains(t, w.Body.String(), "Invalid or expired access key")
	})
}
