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

func (m *mockLinkRepository) CountByUser(ctx context.Context, userID string) (int64, error) {
	args := m.Called(ctx, userID)
	return args.Get(0).(int64), args.Error(1)
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

	t.Run("creates link with random code and user id", func(t *testing.T) {
		repo := new(mockLinkRepository)
		svc := service.NewLinkService(repo, baseURL, 6)

		repo.On("ExistsCode", ctx, mock.AnythingOfType("string")).Return(false, nil)
		repo.On("Create", ctx, mock.MatchedBy(func(l *domain.Link) bool {
			return l.UserID != nil && *l.UserID == "user-123"
		})).Return(nil)

		link, err := svc.Create(ctx, domain.CreateLinkDTO{
			UserID:      "user-123",
			OriginalURL: "https://golang.org/doc",
			Title:       "Go Docs",
		})

		require.NoError(t, err)
		assert.Equal(t, "https://golang.org/doc", link.OriginalURL)
		assert.Equal(t, "Go Docs", link.Title)
		assert.Len(t, link.Code, 6)
		assert.Equal(t, baseURL+"/s/"+link.Code, link.ShortURL)
		assert.Equal(t, "user-123", *link.UserID)
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

	t.Run("returns ErrInvalidSlug when slug is less than 4 chars", func(t *testing.T) {
		repo := new(mockLinkRepository)
		svc := service.NewLinkService(repo, baseURL, 6)

		_, err := svc.Create(ctx, domain.CreateLinkDTO{
			OriginalURL: "https://example.com",
			CustomCode:  "abc", // < 4 chars
		})
		assert.ErrorIs(t, err, domain.ErrInvalidSlug)
	})

	t.Run("returns ErrPremiumSlugRequired when non-premium user requests 4-7 char slug", func(t *testing.T) {
		repo := new(mockLinkRepository)
		svc := service.NewLinkService(repo, baseURL, 6)

		_, err := svc.Create(ctx, domain.CreateLinkDTO{
			OriginalURL: "https://example.com",
			CustomCode:  "link", // 4 chars, non-premium
			IsPremium:   false,
		})
		assert.ErrorIs(t, err, domain.ErrPremiumSlugRequired)
	})

	t.Run("allows 4-7 char slug for Premium user", func(t *testing.T) {
		repo := new(mockLinkRepository)
		svc := service.NewLinkService(repo, baseURL, 6)

		repo.On("ExistsCode", mock.Anything, "link").Return(false, nil)
		repo.On("Create", mock.Anything, mock.MatchedBy(func(l *domain.Link) bool {
			return l.Code == "link" && l.OriginalURL == "https://example.com"
		})).Return(nil)

		l, err := svc.Create(ctx, domain.CreateLinkDTO{
			OriginalURL: "https://example.com",
			CustomCode:  "link",
			IsPremium:   true,
		})
		require.NoError(t, err)
		assert.Equal(t, "link", l.Code)
		repo.AssertExpectations(t)
	})
}

func TestLinkService_UserIsolation(t *testing.T) {
	ctx := context.Background()
	baseURL := "https://sho.rt"
	repo := new(mockLinkRepository)
	svc := service.NewLinkService(repo, baseURL, 6)

	uidA := "user-A"
	uidB := "user-B"
	linkA := &domain.Link{
		ID:          "link-1",
		UserID:      &uidA,
		OriginalURL: "https://a.com",
		Code:        "codeA",
		IsActive:    true,
	}

	repo.On("GetByID", ctx, "link-1").Return(linkA, nil)

	// User B trying to delete User A's link -> Forbidden
	err := svc.Delete(ctx, "link-1", uidB)
	assert.ErrorIs(t, err, domain.ErrForbidden)

	// User B trying to update User A's link -> Forbidden
	_, err = svc.ToggleStatus(ctx, "link-1", uidB, false)
	assert.ErrorIs(t, err, domain.ErrForbidden)

	// User A updating their link -> success
	repo.On("UpdateStatus", ctx, "link-1", false).Return(nil)
	updated, err := svc.ToggleStatus(ctx, "link-1", uidA, false)
	require.NoError(t, err)
	assert.Equal(t, "link-1", updated.ID)
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

func TestLinkService_ContentRules(t *testing.T) {
	ctx := context.Background()
	for _, tc := range []struct {
		name  string
		url   string
		label bool
		want  error
	}{
		{"blocked domain", "https://blocked.example/path", false, domain.ErrBlockedDestination},
		{"blocked subdomain", "https://a.blocked.example/path", true, domain.ErrBlockedDestination},
		{"similar domain allowed", "https://notblocked.example/path", false, nil},
		{"nsfw marker requires label", "https://example.com/xxx/video", false, domain.ErrNSFWLabelRequired},
		{"encoded nsfw marker requires label", "https://example.com/%78xx/video", false, domain.ErrNSFWLabelRequired},
		{"nsfw marker labeled", "https://example.com/xxx/video", true, nil},
		{"self labeled", "https://example.com/article", true, nil},
	} {
		t.Run(tc.name, func(t *testing.T) {
			repo := new(mockLinkRepository)
			svc := service.NewLinkService(repo, "https://sho.rt", 6, []string{"blocked.example"})
			if tc.want == nil {
				repo.On("ExistsCode", ctx, mock.AnythingOfType("string")).Return(false, nil)
				repo.On("Create", ctx, mock.MatchedBy(func(l *domain.Link) bool { return l.IsNSFW == tc.label })).Return(nil)
			}
			link, err := svc.Create(ctx, domain.CreateLinkDTO{OriginalURL: tc.url, IsNSFW: tc.label})
			if tc.want != nil {
				assert.ErrorIs(t, err, tc.want)
				assert.Nil(t, link)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tc.label, link.IsNSFW)
			}
			repo.AssertExpectations(t)
		})
	}
}

func TestLinkService_BlocksExistingDestination(t *testing.T) {
	ctx := context.Background()
	repo := new(mockLinkRepository)
	svc := service.NewLinkService(repo, "https://sho.rt", 6, []string{"blocked.example"})
	repo.On("GetByCode", ctx, "old").Return(&domain.Link{OriginalURL: "https://sub.blocked.example/", IsActive: true}, nil)
	_, err := svc.RecordClick(ctx, "old")
	assert.ErrorIs(t, err, domain.ErrBlockedDestination)
	repo.AssertNotCalled(t, "IncrementClicks", mock.Anything, mock.Anything, mock.Anything)
}

func TestLinkService_LegacyNSFWLinkShowsWarning(t *testing.T) {
	ctx := context.Background()
	repo := new(mockLinkRepository)
	svc := service.NewLinkService(repo, "https://sho.rt", 6)
	repo.On("GetByCode", ctx, "legacy").Return(&domain.Link{OriginalURL: "https://example.com/xxx/video", IsActive: true}, nil)
	link, err := svc.GetByCode(ctx, "legacy")
	require.NoError(t, err)
	assert.True(t, link.IsNSFW)
}
