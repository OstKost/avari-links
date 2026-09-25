package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/OstKost/avari-links/apps/api/internal/middleware"
	"github.com/stretchr/testify/assert"
)

func TestCORSMiddleware(t *testing.T) {
	handler := middleware.CORS([]string{"http://localhost:3000", "https://app.avari.dev"})

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	t.Run("handles preflight OPTIONS request for allowed origin", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodOptions, "/api/v1/links", nil)
		req.Header.Set("Origin", "https://app.avari.dev")
		req.Header.Set("Access-Control-Request-Method", "POST")
		req.Header.Set("Access-Control-Request-Headers", "X-Session-Key, Content-Type")

		w := httptest.NewRecorder()
		handler(next).ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		assert.Equal(t, "https://app.avari.dev", w.Header().Get("Access-Control-Allow-Origin"))
		assert.Contains(t, w.Header().Get("Access-Control-Allow-Methods"), "POST")
	})

	t.Run("applies headers to simple GET request", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/links", nil)
		req.Header.Set("Origin", "http://localhost:3000")

		w := httptest.NewRecorder()
		handler(next).ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		assert.Equal(t, "http://localhost:3000", w.Header().Get("Access-Control-Allow-Origin"))
	})
}
