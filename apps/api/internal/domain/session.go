package domain

import (
	"context"
	"time"
)

// Session represents an anonymous user session.
type Session struct {
	ID           string    `json:"id"`
	KeyHash      string    `json:"-"`
	IsPremium    bool      `json:"is_premium"`
	LastActiveAt time.Time `json:"last_active_at"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// SessionWithKey is returned upon session creation or recovery, containing the raw access key.
type SessionWithKey struct {
	Session
	AccessKey  string `json:"access_key"`
	LinksCount int64  `json:"links_count,omitempty"`
}

// SessionRepository defines persistence methods for anonymous sessions.
type SessionRepository interface {
	Create(ctx context.Context, session *Session) error
	GetByID(ctx context.Context, id string) (*Session, error)
	GetByKeyHash(ctx context.Context, keyHash string) (*Session, error)
	TouchLastActive(ctx context.Context, id string, activeAt time.Time) error
	CleanupInactiveSessions(ctx context.Context, olderThan time.Duration) (int64, error)
}

// SessionService defines business use cases for session management.
type SessionService interface {
	CreateSession(ctx context.Context) (*SessionWithKey, error)
	RestoreSession(ctx context.Context, rawKey string) (*SessionWithKey, error)
	GetSessionByKey(ctx context.Context, rawKey string) (*Session, error)
	TouchSession(ctx context.Context, id string) error
	CleanupInactive(ctx context.Context, inactiveDuration time.Duration) (int64, error)
}
