package service_test

import (
	"context"
	"testing"
	"time"

	"github.com/OstKost/avari-links/apps/api/internal/domain"
	"github.com/OstKost/avari-links/apps/api/internal/service"
	"github.com/OstKost/avari-links/apps/api/pkg/memkey"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

type mockSessionRepository struct {
	mock.Mock
}

func (m *mockSessionRepository) Create(ctx context.Context, session *domain.Session) error {
	args := m.Called(ctx, session)
	return args.Error(0)
}

func (m *mockSessionRepository) GetByID(ctx context.Context, id string) (*domain.Session, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Session), args.Error(1)
}

func (m *mockSessionRepository) GetByKeyHash(ctx context.Context, keyHash string) (*domain.Session, error) {
	args := m.Called(ctx, keyHash)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Session), args.Error(1)
}

func (m *mockSessionRepository) TouchLastActive(ctx context.Context, id string, activeAt time.Time) error {
	args := m.Called(ctx, id, activeAt)
	return args.Error(0)
}

func (m *mockSessionRepository) CleanupInactiveSessions(ctx context.Context, olderThan time.Duration) (int64, error) {
	args := m.Called(ctx, olderThan)
	return args.Get(0).(int64), args.Error(1)
}

func TestSessionService_CreateAndRestore(t *testing.T) {
	ctx := context.Background()
	sessionRepo := new(mockSessionRepository)
	linkRepo := new(mockLinkRepository)

	svc := service.NewSessionService(sessionRepo, linkRepo)

	// 1. CreateSession
	sessionRepo.On("Create", ctx, mock.MatchedBy(func(s *domain.Session) bool {
		return s.ID != "" && s.KeyHash != ""
	})).Return(nil)

	res, err := svc.CreateSession(ctx)
	require.NoError(t, err)
	assert.NotEmpty(t, res.ID)
	assert.NotEmpty(t, res.AccessKey)
	assert.Equal(t, int64(0), res.LinksCount)

	// 2. RestoreSession Success
	rawKey := "cosmic-totoro-4081"
	keyHash := memkey.Hash(rawKey)
	dummySession := &domain.Session{
		ID:           "test-session-id",
		KeyHash:      keyHash,
		LastActiveAt: time.Now().UTC(),
		CreatedAt:    time.Now().UTC(),
	}

	sessionRepo.On("GetByKeyHash", ctx, keyHash).Return(dummySession, nil)
	sessionRepo.On("TouchLastActive", ctx, dummySession.ID, mock.AnythingOfType("time.Time")).Return(nil)
	linkRepo.On("CountByUser", ctx, dummySession.ID).Return(int64(3), nil)

	restored, err := svc.RestoreSession(ctx, rawKey)
	require.NoError(t, err)
	assert.Equal(t, "test-session-id", restored.ID)
	assert.Equal(t, rawKey, restored.AccessKey)
	assert.Equal(t, int64(3), restored.LinksCount)

	// 3. RestoreSession Not Found
	invalidKey := "unknown-hero-thing-0000"
	invalidHash := memkey.Hash(invalidKey)
	sessionRepo.On("GetByKeyHash", ctx, invalidHash).Return(nil, domain.ErrNotFound)

	_, err = svc.RestoreSession(ctx, invalidKey)
	assert.ErrorIs(t, err, domain.ErrInvalidSessionKey)
}
