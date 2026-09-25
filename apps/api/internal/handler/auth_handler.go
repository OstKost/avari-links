package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/OstKost/avari-links/apps/api/internal/domain"
	"github.com/OstKost/avari-links/apps/api/internal/middleware"
	"github.com/go-playground/validator/v10"
)

// AuthHandler handles anonymous authentication and session restoration.
type AuthHandler struct {
	sessionService domain.SessionService
	linkRepo       domain.LinkRepository
	validate       *validator.Validate
}

// NewAuthHandler creates a new AuthHandler instance.
func NewAuthHandler(sessionService domain.SessionService, linkRepo domain.LinkRepository, validate *validator.Validate) *AuthHandler {
	return &AuthHandler{
		sessionService: sessionService,
		linkRepo:       linkRepo,
		validate:       validate,
	}
}

// CreateSession godoc
// @Summary Create anonymous session
// @Description Creates a new anonymous session and returns a memorable access key
// @Tags Auth
// @Produce json
// @Success 201 {object} SessionResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/auth/session [post]
func (h *AuthHandler) CreateSession(w http.ResponseWriter, r *http.Request) {
	sessionWithKey, err := h.sessionService.CreateSession(r.Context())
	if err != nil {
		mapDomainError(w, err)
		return
	}

	respondJSON(w, http.StatusCreated, SessionResponse{
		ID:           sessionWithKey.ID,
		AccessKey:    sessionWithKey.AccessKey,
		LinksCount:   sessionWithKey.LinksCount,
		IsPremium:    sessionWithKey.IsPremium,
		LastActiveAt: sessionWithKey.LastActiveAt,
		CreatedAt:    sessionWithKey.CreatedAt,
	})
}

// RestoreSession godoc
// @Summary Restore session by access key
// @Description Restores access to links using the mnemonic access key
// @Tags Auth
// @Accept json
// @Produce json
// @Param request body RestoreSessionRequest true "Access Key payload"
// @Success 200 {object} SessionResponse
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/auth/restore [post]
func (h *AuthHandler) RestoreSession(w http.ResponseWriter, r *http.Request) {
	var req RestoreSessionRequest
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

	sessionWithKey, err := h.sessionService.RestoreSession(r.Context(), req.AccessKey)
	if err != nil {
		mapDomainError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, SessionResponse{
		ID:           sessionWithKey.ID,
		AccessKey:    sessionWithKey.AccessKey,
		LinksCount:   sessionWithKey.LinksCount,
		IsPremium:    sessionWithKey.IsPremium,
		LastActiveAt: sessionWithKey.LastActiveAt,
		CreatedAt:    sessionWithKey.CreatedAt,
	})
}

// GetMe godoc
// @Summary Get current session profile
// @Description Returns the profile and link count of the active session
// @Tags Auth
// @Produce json
// @Success 200 {object} SessionMeResponse
// @Failure 401 {object} ErrorResponse
// @Router /api/v1/auth/me [get]
func (h *AuthHandler) GetMe(w http.ResponseWriter, r *http.Request) {
	session := middleware.GetSession(r.Context())
	if session == nil {
		respondError(w, http.StatusUnauthorized, "Authentication required (missing or invalid X-Session-Key)")
		return
	}

	var count int64
	if h.linkRepo != nil {
		c, err := h.linkRepo.CountByUser(r.Context(), session.ID)
		if err == nil {
			count = c
		}
	}

	respondJSON(w, http.StatusOK, SessionMeResponse{
		ID:           session.ID,
		LinksCount:   count,
		IsPremium:    session.IsPremium,
		LastActiveAt: session.LastActiveAt,
		CreatedAt:    session.CreatedAt,
	})
}
