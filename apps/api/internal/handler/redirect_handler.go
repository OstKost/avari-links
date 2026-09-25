package handler

import (
	"net/http"

	"github.com/OstKost/avari-links/apps/api/internal/domain"
	"github.com/go-chi/chi/v5"
)

// RedirectHandler handles public short URL redirection.
type RedirectHandler struct {
	service domain.LinkService
}

// NewRedirectHandler creates a new RedirectHandler.
func NewRedirectHandler(service domain.LinkService) *RedirectHandler {
	return &RedirectHandler{service: service}
}

// Redirect godoc
// @Summary Redirect short URL
// @Description Redirects to the original target URL and records click statistics
// @Tags Redirect
// @Param code path string true "Short link code or slug"
// @Success 302 "Temporary Redirect"
// @Failure 404 {object} ErrorResponse
// @Failure 410 {object} ErrorResponse
// @Router /s/{code} [get]
func (h *RedirectHandler) Redirect(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")
	if code == "" {
		respondError(w, http.StatusBadRequest, "Missing link code")
		return
	}

	targetURL, err := h.service.RecordClick(r.Context(), code)
	if err != nil {
		mapDomainError(w, err)
		return
	}

	// 302 Found / Temporary Redirect so browsers don't cache permanently and click counts stay accurate
	http.Redirect(w, r, targetURL, http.StatusFound)
}
