package service_test

import (
	"context"
	"testing"
	"time"

	"github.com/OstKost/avari-links/apps/api/internal/domain"
	"github.com/OstKost/avari-links/apps/api/internal/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

type mockLinkRepository struct {
	mock.Mock
}

func (m *mockLinkRepository) Create(ctx context.Context, link *domain.Link) error {
	args := m.Called(ctx, link)
	return args.Error(0)
}

func (m *mockLinkRepository) GetByID(ctx context.Context, id string) (*domain.Link, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Link), args.Error(1)
}

func (m *mockLinkRepository) GetByCode(ctx context.Context, code string) (*domain.Link, error) {
	args := m.Called(ctx, code)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Link), args.Error(1)
}

func (m *mockLinkRepository) List(ctx context.Context, filter domain.ListLinksFilter) ([]*domain.Link, int64, error) {
	args := m.Called(ctx, filter)
	if args.Get(0) == nil {
		return nil, args.Get(1).(int64), args.Error(2)
	}
	return args.Get(0).([]*domain.Link), args.Get(1).(int64), args.Error(2)
}

func (m *mockLinkRepository) UpdateStatus(ctx context.Context, id string, isActive bool) error {
	args := m.Called(ctx, id, isActive)
	return args.Error(0)
}

func (m *mockLinkRepository) IncrementClicks(ctx context.Context, id string, clickedAt time.Time) error {
	args := m.Called(ctx, id, clickedAt)
	return args.Error(0)
}

func (m *mockLinkRepository) Delete(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *mockLinkRepository) ExistsCode(ctx context.Context, code string) (bool, error) {
	args := m.Called(ctx, code)
	return args.Bool(0), args.Error(1)
}

func TestLinkService_Create(t *testing.T) {
	ctx := context.Background()
	baseURL := "https://sho.rt"

	t.Run("creates link with random code", func(t *testing.T) {
		repo := new(mockLinkRepository)
		svc := service.NewLinkService(repo, baseURL, 6)

		repo.On("ExistsCode", ctx, mock.AnythingOfType("string")).Return(false, nil)
		repo.On("Create", ctx, mock.AnythingOfType("*domain.Link")).Return(nil)

		link, err := svc.Create(ctx, domain.CreateLinkDTO{
			OriginalURL: "https://golang.org/doc",
			Title:       "Go Docs",
		})

		require.NoError(t, err)
		assert.Equal(t, "https://golang.org/doc", link.OriginalURL)
		assert.Equal(t, "Go Docs", link.Title)
		assert.Len(t, link.Code, 6)
		assert.Equal(t, baseURL+"/s/"+link.Code, link.ShortURL)
		repo.AssertExpectations(t)
	})

	t.Run("creates link with valid custom slug", func(t *testing.T) {
		repo := new(mockLinkRepository)
		svc := service.NewLinkService(repo, baseURL, 6)

		repo.On("ExistsCode", ctx, "my-custom-slug").Return(false, nil)
		repo.On("Create", ctx, mock.MatchedBy(func(l *domain.Link) bool {
			return l.Code == "my-custom-slug"
		})).Return(nil)

		link, err := svc.Create(ctx, domain.CreateLinkDTO{
			OriginalURL: "https://github.com/OstKost",
			CustomCode:  "my-custom-slug",
		})

		require.NoError(t, err)
		assert.Equal(t, "my-custom-slug", link.Code)
		assert.Equal(t, baseURL+"/s/my-custom-slug", link.ShortURL)
		repo.AssertExpectations(t)
	})

	t.Run("returns error on invalid url", func(t *testing.T) {
		repo := new(mockLinkRepository)
		svc := service.NewLinkService(repo, baseURL, 6)

		_, err := svc.Create(ctx, domain.CreateLinkDTO{
			OriginalURL: "not-a-valid-url",
		})
		assert.ErrorIs(t, err, domain.ErrInvalidURL)
	})

	t.Run("returns error on conflicting custom slug", func(t *testing.T) {
		repo := new(mockLinkRepository)
		svc := service.NewLinkService(repo, baseURL, 6)

		repo.On("ExistsCode", ctx, "existing-slug").Return(true, nil)

		_, err := svc.Create(ctx, domain.CreateLinkDTO{
			OriginalURL: "https://example.com",
			CustomCode:  "existing-slug",
		})
		assert.ErrorIs(t, err, domain.ErrConflict)
		repo.AssertExpectations(t)
	})

	t.Run("returns error on malformed custom slug", func(t *testing.T) {
		repo := new(mockLinkRepository)
		svc := service.NewLinkService(repo, baseURL, 6)

		_, err := svc.Create(ctx, domain.CreateLinkDTO{
			OriginalURL: "https://example.com",
			CustomCode:  "ab", // too short, min is 3
		})
		assert.ErrorIs(t, err, domain.ErrInvalidSlug)
	})
}

func TestLinkService_RecordClick(t *testing.T) {
	ctx := context.Background()
	baseURL := "https://sho.rt"

	t.Run("records click on active link", func(t *testing.T) {
		repo := new(mockLinkRepository)
		svc := service.NewLinkService(repo, baseURL, 6)

		link := &domain.Link{
			ID:          "123",
			OriginalURL: "https://target.com",
			Code:        "go123",
			IsActive:    true,
		}

		repo.On("GetByCode", ctx, "go123").Return(link, nil)
		repo.On("IncrementClicks", mock.Anything, "123", mock.Anything).Return(nil).Maybe()

		targetURL, err := svc.RecordClick(ctx, "go123")
		require.NoError(t, err)
		assert.Equal(t, "https://target.com", targetURL)
	})

	t.Run("returns error on inactive link", func(t *testing.T) {
		repo := new(mockLinkRepository)
		svc := service.NewLinkService(repo, baseURL, 6)

		link := &domain.Link{
			ID:          "123",
			OriginalURL: "https://target.com",
			Code:        "disabled",
			IsActive:    false,
		}

		repo.On("GetByCode", ctx, "disabled").Return(link, nil)

		_, err := svc.RecordClick(ctx, "disabled")
		assert.ErrorIs(t, err, domain.ErrLinkInactive)
	})
}
