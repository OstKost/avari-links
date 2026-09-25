package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/OstKost/avari-links/apps/api/internal/domain"
)

type contextKey string

const (
	// SessionContextKey is the context key for storing the authenticated Session.
	SessionContextKey contextKey = "session"
)

// SessionMiddleware extracts session key from X-Session-Key or Authorization header.
func SessionMiddleware(sessionService domain.SessionService) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			rawKey := extractSessionKey(r)
			if rawKey == "" {
				next.ServeHTTP(w, r)
				return
			}

			session, err := sessionService.GetSessionByKey(r.Context(), rawKey)
			if err != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				_ = json.NewEncoder(w).Encode(map[string]string{
					"error": "Invalid or expired access key",
				})
				return
			}

			// Touch session asynchronously to update last_active_at
			go func(sid string) {
				_ = sessionService.TouchSession(context.Background(), sid)
			}(session.ID)

			ctx := context.WithValue(r.Context(), SessionContextKey, session)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetSession extracts the Session from context if available.
func GetSession(ctx context.Context) *domain.Session {
	val := ctx.Value(SessionContextKey)
	if session, ok := val.(*domain.Session); ok {
		return session
	}
	return nil
}

func extractSessionKey(r *http.Request) string {
	if key := strings.TrimSpace(r.Header.Get("X-Session-Key")); key != "" {
		return key
	}

	authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
	if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		return strings.TrimSpace(authHeader[7:])
	}

	return ""
}
