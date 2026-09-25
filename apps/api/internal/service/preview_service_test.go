package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/OstKost/avari-links/apps/api/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPreviewService_Inspect(t *testing.T) {
	t.Run("extracts OpenGraph and favicon metadata accurately", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`
				<!DOCTYPE html>
				<html>
				<head>
					<title>Fallback Title</title>
					<meta property="og:title" content="Awesome OpenGraph Title" />
					<meta property="og:description" content="This is an awesome description for link preview." />
					<meta property="og:image" content="/assets/cover.jpg" />
					<meta property="og:site_name" content="Avari Demo" />
					<link rel="icon" href="/favicon.png" />
				</head>
				<body><h1>Hello World</h1></body>
				</html>
			`))
		}))
		defer ts.Close()

		svc := NewPreviewService(2 * time.Second)
		preview, err := svc.Inspect(context.Background(), ts.URL)
		require.NoError(t, err)
		require.NotNil(t, preview)

		assert.True(t, preview.IsReachable)
		assert.Equal(t, 200, preview.StatusCode)
		assert.Equal(t, "Awesome OpenGraph Title", preview.Title)
		assert.Equal(t, "This is an awesome description for link preview.", preview.Description)
		assert.Equal(t, ts.URL+"/assets/cover.jpg", preview.ImageURL)
		assert.Equal(t, ts.URL+"/favicon.png", preview.FaviconURL)
		assert.Equal(t, "Avari Demo", preview.SiteName)
		assert.Empty(t, preview.Error)
	})

	t.Run("falls back to standard title and description if OG tags absent", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`
				<!DOCTYPE html>
				<html>
				<head>
					<title>  Simple Standard Title  </title>
					<meta name="description" content="Simple standard meta description" />
				</head>
				<body></body>
				</html>
			`))
		}))
		defer ts.Close()

		svc := NewPreviewService(2 * time.Second)
		preview, err := svc.Inspect(context.Background(), ts.URL)
		require.NoError(t, err)
		require.NotNil(t, preview)

		assert.True(t, preview.IsReachable)
		assert.Equal(t, "Simple Standard Title", preview.Title)
		assert.Equal(t, "Simple standard meta description", preview.Description)
		assert.Equal(t, ts.URL+"/favicon.ico", preview.FaviconURL)
	})

	t.Run("handles 404 or 500 error gracefully", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusNotFound)
		}))
		defer ts.Close()

		svc := NewPreviewService(2 * time.Second)
		preview, err := svc.Inspect(context.Background(), ts.URL)
		require.NoError(t, err)
		require.NotNil(t, preview)

		assert.False(t, preview.IsReachable)
		assert.Equal(t, 404, preview.StatusCode)
		assert.Contains(t, preview.Error, "404")
	})

	t.Run("handles unreachable host without crashing", func(t *testing.T) {
		svc := NewPreviewService(500 * time.Millisecond)
		preview, err := svc.Inspect(context.Background(), "http://non-existent-domain-123456789.xyz")
		require.NoError(t, err)
		require.NotNil(t, preview)

		assert.False(t, preview.IsReachable)
		assert.NotEmpty(t, preview.Error)
	})

	t.Run("rejects invalid URL format with domain error", func(t *testing.T) {
		svc := NewPreviewService(2 * time.Second)
		_, err := svc.Inspect(context.Background(), "invalid-scheme://foo")
		assert.ErrorIs(t, err, domain.ErrInvalidURL)
	})
}
