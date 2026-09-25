package domain

import (
	"context"
	"time"
)

// Link represents the core shortened URL domain entity.
type Link struct {
	ID            string     `json:"id"`
	OriginalURL   string     `json:"original_url"`
	Code          string     `json:"code"`
	ShortURL      string     `json:"short_url,omitempty"`
	Title         string     `json:"title"`
	Clicks        int64      `json:"clicks"`
	IsActive      bool       `json:"is_active"`
	IsNSFW        bool       `json:"is_nsfw"`
	LastClickedAt *time.Time `json:"last_clicked_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

// CreateLinkDTO contains input parameters for shortening a new link.
type CreateLinkDTO struct {
	OriginalURL string `json:"original_url"`
	CustomCode  string `json:"custom_code,omitempty"`
	Title       string `json:"title,omitempty"`
	IsNSFW      bool   `json:"is_nsfw"`
}

// ListLinksFilter contains parameters for searching and paginating links.
type ListLinksFilter struct {
	Search string `json:"search,omitempty"`
	Limit  int    `json:"limit,omitempty"`
	Offset int    `json:"offset,omitempty"`
}

// LinkRepository defines the persistence contract for Links.
type LinkRepository interface {
	Create(ctx context.Context, link *Link) error
	GetByID(ctx context.Context, id string) (*Link, error)
	GetByCode(ctx context.Context, code string) (*Link, error)
	List(ctx context.Context, filter ListLinksFilter) ([]*Link, int64, error)
	UpdateStatus(ctx context.Context, id string, isActive bool) error
	IncrementClicks(ctx context.Context, id string, clickedAt time.Time) error
	Delete(ctx context.Context, id string) error
	ExistsCode(ctx context.Context, code string) (bool, error)
}

// LinkService defines business use cases for Link management.
type LinkService interface {
	Create(ctx context.Context, dto CreateLinkDTO) (*Link, error)
	GetByID(ctx context.Context, id string) (*Link, error)
	GetByCode(ctx context.Context, code string) (*Link, error)
	List(ctx context.Context, filter ListLinksFilter) ([]*Link, int64, error)
	ToggleStatus(ctx context.Context, id string, isActive bool) (*Link, error)
	RecordClick(ctx context.Context, code string) (string, error)
	Delete(ctx context.Context, id string) error
}
