package handler

import (
	"database/sql"
	"net/http"
	"time"

	_ "github.com/OstKost/avari-links/apps/api/docs" // Swagger generated docs
	customMiddleware "github.com/OstKost/avari-links/apps/api/internal/middleware"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	httpSwagger "github.com/swaggo/http-swagger"
)

// RouterConfig contains dependencies for building HTTP router.
type RouterConfig struct {
	LinkHandler     *LinkHandler
	RedirectHandler *RedirectHandler
	DB              *sql.DB
	AllowedOrigins  []string
}

// NewRouter builds and configures the Chi HTTP router.
func NewRouter(cfg RouterConfig) http.Handler {
	r := chi.NewRouter()

	// Standard middlewares
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(customMiddleware.RequestLogger())
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))
	r.Use(customMiddleware.CORS(cfg.AllowedOrigins))

	// Health check endpoint
	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		if err := cfg.DB.Ping(); err != nil {
			respondError(w, http.StatusServiceUnavailable, "Database unreachable")
			return
		}
		respondJSON(w, http.StatusOK, map[string]string{
			"status":   "ok",
			"database": "connected",
			"time":     time.Now().UTC().Format(time.RFC3339),
		})
	})

	// Swagger Documentation UI
	r.Get("/swagger/*", httpSwagger.Handler(
		httpSwagger.URL("/swagger/doc.json"),
	))

	// Public short URL redirect route
	r.Get("/s/{code}", cfg.RedirectHandler.Redirect)

	// API v1 routes
	r.Route("/api/v1", func(api chi.Router) {
		api.Route("/links", func(links chi.Router) {
			links.Post("/", cfg.LinkHandler.Create)
			links.Get("/", cfg.LinkHandler.List)
			links.Get("/{id}", cfg.LinkHandler.GetByID)
			links.Patch("/{id}/status", cfg.LinkHandler.UpdateStatus)
			links.Delete("/{id}", cfg.LinkHandler.Delete)
		})
	})

	return r
}
