package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/OstKost/avari-links/apps/api/internal/domain"
	"github.com/go-playground/validator/v10"
)

// CreateLinkRequest represents the payload for creating a shortened link.
type CreateLinkRequest struct {
	OriginalURL string `json:"original_url" validate:"required,url" example:"https://github.com/OstKost/avari-links"`
	CustomCode  string `json:"custom_code,omitempty" validate:"omitempty,min=3,max=30,alphanumunicode|containsany=-_" example:"my-repo"`
	Title       string `json:"title,omitempty" validate:"omitempty,max=120" example:"My Awesome Repository"`
	IsNSFW      bool   `json:"is_nsfw" example:"false"`
}

// UpdateStatusRequest represents the payload for updating link status.
type UpdateStatusRequest struct {
	IsActive *bool `json:"is_active" validate:"required" example:"true"`
}

// LinkResponse represents the serialized link data returned to clients.
type LinkResponse struct {
	ID            string     `json:"id" example:"9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"`
	OriginalURL   string     `json:"original_url" example:"https://github.com/OstKost/avari-links"`
	Code          string     `json:"code" example:"aBc123"`
	ShortURL      string     `json:"short_url" example:"http://localhost:4820/s/aBc123"`
	Title         string     `json:"title" example:"My Awesome Repository"`
	Clicks        int64      `json:"clicks" example:"42"`
	IsActive      bool       `json:"is_active" example:"true"`
	IsNSFW        bool       `json:"is_nsfw" example:"false"`
	LastClickedAt *time.Time `json:"last_clicked_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at" example:"2026-09-24T20:00:00Z"`
	UpdatedAt     time.Time  `json:"updated_at" example:"2026-09-24T20:05:00Z"`
}

// PaginatedListResponse represents paginated link results.
type PaginatedListResponse struct {
	Data   []*LinkResponse `json:"data"`
	Total  int64           `json:"total" example:"100"`
	Limit  int             `json:"limit" example:"20"`
	Offset int             `json:"offset" example:"0"`
}

// ErrorResponse represents a standard API error response.
type ErrorResponse struct {
	Error   string            `json:"error" example:"Validation failed"`
	Details map[string]string `json:"details,omitempty"`
}

func toLinkResponse(link *domain.Link) *LinkResponse {
	if link == nil {
		return nil
	}
	return &LinkResponse{
		ID:            link.ID,
		OriginalURL:   link.OriginalURL,
		Code:          link.Code,
		ShortURL:      link.ShortURL,
		Title:         link.Title,
		Clicks:        link.Clicks,
		IsActive:      link.IsActive,
		IsNSFW:        link.IsNSFW,
		LastClickedAt: link.LastClickedAt,
		CreatedAt:     link.CreatedAt,
		UpdatedAt:     link.UpdatedAt,
	}
}

func toLinkResponses(links []*domain.Link) []*LinkResponse {
	res := make([]*LinkResponse, len(links))
	for i, l := range links {
		res[i] = toLinkResponse(l)
	}
	return res
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if data != nil {
		_ = json.NewEncoder(w).Encode(data)
	}
}

func respondError(w http.ResponseWriter, status int, message string) {
	respondJSON(w, status, ErrorResponse{Error: message})
}

func respondValidationError(w http.ResponseWriter, errs validator.ValidationErrors) {
	details := make(map[string]string)
	for _, e := range errs {
		details[e.Field()] = e.Tag()
	}
	respondJSON(w, http.StatusBadRequest, ErrorResponse{
		Error:   "Validation failed",
		Details: details,
	})
}

func mapDomainError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, domain.ErrNotFound):
		respondError(w, http.StatusNotFound, "Resource not found")
	case errors.Is(err, domain.ErrConflict):
		respondError(w, http.StatusConflict, "Short code or slug is already in use")
	case errors.Is(err, domain.ErrInvalidURL):
		respondError(w, http.StatusBadRequest, "Invalid URL format (must be http:// or https://)")
	case errors.Is(err, domain.ErrInvalidSlug):
		respondError(w, http.StatusBadRequest, "Custom slug must be 3-30 alphanumeric characters, dashes or underscores")
	case errors.Is(err, domain.ErrLinkInactive):
		respondError(w, http.StatusGone, "This shortened link is currently deactivated")
	case errors.Is(err, domain.ErrNSFWLabelRequired):
		respondError(w, http.StatusBadRequest, "This destination requires an NSFW label")
	case errors.Is(err, domain.ErrBlockedDestination):
		respondError(w, http.StatusForbidden, "This destination is blocked")
	default:
		respondError(w, http.StatusInternalServerError, "Internal server error")
	}
}
