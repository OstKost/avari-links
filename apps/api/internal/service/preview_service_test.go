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

	t.Run("detects NSFW adult keywords in domain and title", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`
				<!DOCTYPE html>
				<html>
				<head>
					<title>Adult Gallery 18+ Only</title>
				</head>
				<body></body>
				</html>
			`))
		}))
		defer ts.Close()

		svc := NewPreviewService(2 * time.Second)
		preview, err := svc.Inspect(context.Background(), ts.URL)
		require.NoError(t, err)
		assert.True(t, preview.IsNSFW)
	})

	t.Run("detects NSFW by words inside page body text", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`
				<!DOCTYPE html>
				<html>
				<head>
					<title>Generic Portal</title>
				</head>
				<body>
					<h1>Каталог медиа</h1>
					<p>Смотрите лучшее порно и эротические ролики в высоком качестве онлайн.</p>
				</body>
				</html>
			`))
		}))
		defer ts.Close()

		svc := NewPreviewService(2 * time.Second)
		preview, err := svc.Inspect(context.Background(), ts.URL)
		require.NoError(t, err)
		assert.True(t, preview.IsNSFW)
	})

	t.Run("detects NSFW by meta rating or keywords tag", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`
				<!DOCTYPE html>
				<html>
				<head>
					<title>Entertainment Club</title>
					<meta name="rating" content="RTA-5042-1996-1400-1577-RTA" />
					<meta name="keywords" content="hentai, clips, adult games" />
				</head>
				<body>
					<p>Welcome</p>
				</body>
				</html>
			`))
		}))
		defer ts.Close()

		svc := NewPreviewService(2 * time.Second)
		preview, err := svc.Inspect(context.Background(), ts.URL)
		require.NoError(t, err)
		assert.True(t, preview.IsNSFW)
	})

	t.Run("does not false-positive on innocent words like Sussex or analytics", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`
				<!DOCTYPE html>
				<html>
				<head>
					<title>University of Sussex Data Analytics</title>
					<meta name="description" content="Official research portal for Sussex university analysis." />
				</head>
				<body>
					<h1>Department of Analytics</h1>
					<p>Passport and immigration analysis studies in Middlesex and Essex.</p>
				</body>
				</html>
			`))
		}))
		defer ts.Close()

		svc := NewPreviewService(2 * time.Second)
		preview, err := svc.Inspect(context.Background(), ts.URL)
		require.NoError(t, err)
		assert.False(t, preview.IsNSFW)
	})

	t.Run("normalizes domain URLs without scheme", func(t *testing.T) {
		assert.Equal(t, "https://ya.ru", NormalizeTargetURL("ya.ru"))
		assert.Equal(t, "https://google.com/search?q=test", NormalizeTargetURL("google.com/search?q=test"))
		assert.Equal(t, "http://custom.org", NormalizeTargetURL("http://custom.org"))
	})
}

func TestHasNSFWWords(t *testing.T) {
	assert.True(t, HasNSFWWords("pornhub.com"))
	assert.True(t, HasNSFWWords("https://rt.pornhub.com/view_video.php"))
	assert.True(t, HasNSFWWords("Free Porn Videos & Sex Movies - Porno, XXX, Porn Tube | Pornhub"))
	assert.True(t, HasNSFWWords("Эксклюзивное порно онлайн"))
	assert.True(t, HasNSFWWords("секс-шоп товары 18+"))
	assert.True(t, HasNSFWWords("RTA-5042-1996-1400-1577-RTA"))
	assert.True(t, HasNSFWWords("Onlyfans leak content"))
	assert.True(t, HasNSFWWords("Хентай комиксы и манга"))

	assert.False(t, HasNSFWWords("University of Sussex"))
	assert.False(t, HasNSFWWords("Google Analytics Dashboard"))
	assert.False(t, HasNSFWWords("Middlesex county council"))
	assert.False(t, HasNSFWWords("Passport control"))
}
