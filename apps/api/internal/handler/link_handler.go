package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/OstKost/avari-links/apps/api/internal/domain"
	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"
)

// LinkHandler handles Link management REST endpoints.
type LinkHandler struct {
	service  domain.LinkService
	validate *validator.Validate
}

// NewLinkHandler creates a new LinkHandler instance.
func NewLinkHandler(service domain.LinkService, validate *validator.Validate) *LinkHandler {
	return &LinkHandler{
		service:  service,
		validate: validate,
	}
}

// Create godoc
// @Summary Create shortened link
// @Description Shortens a given URL with optional custom slug, title and NSFW label; blocked destinations are rejected
// @Tags Links
// @Accept json
// @Produce json
// @Param request body CreateLinkRequest true "Link creation payload"
// @Success 201 {object} LinkResponse
// @Failure 400 {object} ErrorResponse
// @Failure 409 {object} ErrorResponse
// @Failure 403 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/links [post]
func (h *LinkHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req CreateLinkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid JSON body")
		return
	}

	if err := h.validate.Struct(req); err != nil {
		var valErrs validator.ValidationErrors
		if errors.As(err, &valErrs) {
			respondValidationError(w, valErrs)
			return
		}
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	link, err := h.service.Create(r.Context(), domain.CreateLinkDTO{
		OriginalURL: req.OriginalURL,
		CustomCode:  req.CustomCode,
		Title:       req.Title,
		IsNSFW:      req.IsNSFW,
	})
	if err != nil {
		mapDomainError(w, err)
		return
	}

	respondJSON(w, http.StatusCreated, toLinkResponse(link))
}

// List godoc
// @Summary List shortened links
// @Description Returns paginated and searchable list of links
// @Tags Links
// @Produce json
// @Param search query string false "Search by title, original URL or code"
// @Param limit query int false "Pagination limit (default 20, max 100)"
// @Param offset query int false "Pagination offset (default 0)"
// @Success 200 {object} PaginatedListResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/links [get]
func (h *LinkHandler) List(w http.ResponseWriter, r *http.Request) {
	search := r.URL.Query().Get("search")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}

	links, total, err := h.service.List(r.Context(), domain.ListLinksFilter{
		Search: search,
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		mapDomainError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, PaginatedListResponse{
		Data:   toLinkResponses(links),
		Total:  total,
		Limit:  limit,
		Offset: offset,
	})
}

// GetByID godoc
// @Summary Get link details
// @Description Returns link details by unique ID
// @Tags Links
// @Produce json
// @Param id path string true "Link ID (UUID)"
// @Success 200 {object} LinkResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/links/{id} [get]
func (h *LinkHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		respondError(w, http.StatusBadRequest, "Missing link ID")
		return
	}

	link, err := h.service.GetByID(r.Context(), id)
	if err != nil {
		mapDomainError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, toLinkResponse(link))
}

// UpdateStatus godoc
// @Summary Toggle link active status
// @Description Activates or deactivates a link
// @Tags Links
// @Accept json
// @Produce json
// @Param id path string true "Link ID (UUID)"
// @Param request body UpdateStatusRequest true "Status update payload"
// @Success 200 {object} LinkResponse
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/links/{id}/status [patch]
func (h *LinkHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		respondError(w, http.StatusBadRequest, "Missing link ID")
		return
	}

	var req UpdateStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid JSON body")
		return
	}

	if err := h.validate.Struct(req); err != nil {
		var valErrs validator.ValidationErrors
		if errors.As(err, &valErrs) {
			respondValidationError(w, valErrs)
			return
		}
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	link, err := h.service.ToggleStatus(r.Context(), id, *req.IsActive)
	if err != nil {
		mapDomainError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, toLinkResponse(link))
}

// Delete godoc
// @Summary Delete shortened link
// @Description Deletes a link permanently
// @Tags Links
// @Produce json
// @Param id path string true "Link ID (UUID)"
// @Success 204 "No Content"
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/links/{id} [delete]
func (h *LinkHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		respondError(w, http.StatusBadRequest, "Missing link ID")
		return
	}

	if err := h.service.Delete(r.Context(), id); err != nil {
		mapDomainError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
