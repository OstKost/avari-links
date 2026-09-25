package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/OstKost/avari-links/apps/api/internal/domain"
	"github.com/OstKost/avari-links/apps/api/pkg/memkey"
	"github.com/google/uuid"
)

type sessionService struct {
	sessionRepo domain.SessionRepository
	linkRepo    domain.LinkRepository
}

// NewSessionService creates a new SessionService instance.
func NewSessionService(sessionRepo domain.SessionRepository, linkRepo domain.LinkRepository) domain.SessionService {
	return &sessionService{
		sessionRepo: sessionRepo,
		linkRepo:    linkRepo,
	}
}

func (s *sessionService) CreateSession(ctx context.Context) (*domain.SessionWithKey, error) {
	key, err := memkey.Generate()
	if err != nil {
		return nil, fmt.Errorf("failed to generate access key: %w", err)
	}

	keyHash := memkey.Hash(key)
	now := time.Now().UTC()

	session := &domain.Session{
		ID:           uuid.NewString(),
		KeyHash:      keyHash,
		LastActiveAt: now,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := s.sessionRepo.Create(ctx, session); err != nil {
		return nil, fmt.Errorf("failed to persist session: %w", err)
	}

	return &domain.SessionWithKey{
		Session:    *session,
		AccessKey:  key,
		LinksCount: 0,
	}, nil
}

func (s *sessionService) RestoreSession(ctx context.Context, rawKey string) (*domain.SessionWithKey, error) {
	cleanKey := strings.TrimSpace(rawKey)
	if cleanKey == "" {
		return nil, domain.ErrInvalidSessionKey
	}

	keyHash := memkey.Hash(cleanKey)
	session, err := s.sessionRepo.GetByKeyHash(ctx, keyHash)
	if err != nil {
		if err == domain.ErrNotFound {
			return nil, domain.ErrInvalidSessionKey
		}
		return nil, fmt.Errorf("failed to get session: %w", err)
	}

	now := time.Now().UTC()
	_ = s.sessionRepo.TouchLastActive(ctx, session.ID, now)
	session.LastActiveAt = now

	var linksCount int64
	if s.linkRepo != nil {
		count, err := s.linkRepo.CountByUser(ctx, session.ID)
		if err == nil {
			linksCount = count
		}
	}

	return &domain.SessionWithKey{
		Session:    *session,
		AccessKey:  memkey.Normalize(cleanKey),
		LinksCount: linksCount,
	}, nil
}

func (s *sessionService) GetSessionByKey(ctx context.Context, rawKey string) (*domain.Session, error) {
	cleanKey := strings.TrimSpace(rawKey)
	if cleanKey == "" {
		return nil, domain.ErrInvalidSessionKey
	}

	keyHash := memkey.Hash(cleanKey)
	session, err := s.sessionRepo.GetByKeyHash(ctx, keyHash)
	if err != nil {
		if err == domain.ErrNotFound {
			return nil, domain.ErrInvalidSessionKey
		}
		return nil, fmt.Errorf("failed to get session: %w", err)
	}

	return session, nil
}

func (s *sessionService) TouchSession(ctx context.Context, id string) error {
	return s.sessionRepo.TouchLastActive(ctx, id, time.Now().UTC())
}

func (s *sessionService) CleanupInactive(ctx context.Context, inactiveDuration time.Duration) (int64, error) {
	if inactiveDuration <= 0 {
		inactiveDuration = 100 * 24 * time.Hour
	}
	return s.sessionRepo.CleanupInactiveSessions(ctx, inactiveDuration)
}
