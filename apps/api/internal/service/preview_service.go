package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/OstKost/avari-links/apps/api/internal/domain"
	"golang.org/x/net/html"
)

const (
	defaultPreviewTimeout = 3500 * time.Millisecond
	maxHTMLReadBytes      = 512 * 1024 // 512 KB
)

// previewService implements domain.PreviewService.
type previewService struct {
	client  *http.Client
	timeout time.Duration
}

// NewPreviewService creates a new PreviewService instance with safe HTTP client settings.
func NewPreviewService(timeout ...time.Duration) domain.PreviewService {
	t := defaultPreviewTimeout
	if len(timeout) > 0 && timeout[0] > 0 {
		t = timeout[0]
	}

	transport := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   2 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		MaxIdleConns:          50,
		IdleConnTimeout:       30 * time.Second,
		TLSHandshakeTimeout:   2 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		ResponseHeaderTimeout: 3 * time.Second,
	}

	client := &http.Client{
		Transport: transport,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 5 {
				return errors.New("stopped after 5 redirects")
			}
			return nil
		},
	}

	return &previewService{
		client:  client,
		timeout: t,
	}
}

// Inspect fetches the target URL and extracts OpenGraph/HTML metadata.
func (s *previewService) Inspect(ctx context.Context, rawURL string) (*domain.LinkPreview, error) {
	trimmed := strings.TrimSpace(rawURL)
	if trimmed == "" {
		return nil, domain.ErrInvalidURL
	}

	parsed, err := url.ParseRequestURI(trimmed)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
		return nil, domain.ErrInvalidURL
	}

	inspectCtx, cancel := context.WithTimeout(ctx, s.timeout)
	defer cancel()

	req, err := http.NewRequestWithContext(inspectCtx, http.MethodGet, trimmed, nil)
	if err != nil {
		return &domain.LinkPreview{
			URL:         trimmed,
			IsReachable: false,
			Error:       fmt.Sprintf("failed to create request: %v", err),
		}, nil
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 (compatible; AvariBot/1.0; +https://avari.link)")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9,ru;q=0.8")

	resp, err := s.client.Do(req)
	if err != nil {
		return &domain.LinkPreview{
			URL:         trimmed,
			IsReachable: false,
			Error:       formatNetworkError(err),
		}, nil
	}
	defer resp.Body.Close()

	preview := &domain.LinkPreview{
		URL:         trimmed,
		StatusCode:  resp.StatusCode,
		IsReachable: resp.StatusCode >= 200 && resp.StatusCode < 400,
	}

	if resp.StatusCode >= 400 {
		preview.Error = fmt.Sprintf("HTTP status %d %s", resp.StatusCode, http.StatusText(resp.StatusCode))
		return preview, nil
	}

	// Read limited HTML stream
	limitedReader := io.LimitReader(resp.Body, maxHTMLReadBytes)
	s.extractMetadata(limitedReader, resp.Request.URL, preview)

	// Fallback title if not found
	if preview.Title == "" {
		if preview.SiteName != "" {
			preview.Title = preview.SiteName
		} else {
			preview.Title = parsed.Host
		}
	}

	// Fallback favicon
	if preview.FaviconURL == "" && parsed.Scheme != "" && parsed.Host != "" {
		preview.FaviconURL = fmt.Sprintf("%s://%s/favicon.ico", parsed.Scheme, parsed.Host)
	}

	return preview, nil
}

func (s *previewService) extractMetadata(r io.Reader, baseURL *url.URL, preview *domain.LinkPreview) {
	tokenizer := html.NewTokenizer(r)

	var (
		rawTitle        string
		ogTitle         string
		twitterTitle    string
		ogDesc          string
		metaDesc        string
		twitterDesc     string
		ogImage         string
		twitterImage    string
		favicon         string
		ogSiteName      string
		inTitleTag      bool
		titleTextBuffer strings.Builder
	)

	for {
		tt := tokenizer.Next()
		switch tt {
		case html.ErrorToken:
			// EOF or read error
			finalizeExtracted(preview, baseURL, rawTitle, ogTitle, twitterTitle, ogDesc, metaDesc, twitterDesc, ogImage, twitterImage, favicon, ogSiteName)
			return

		case html.StartTagToken, html.SelfClosingTagToken:
			token := tokenizer.Token()
			tagName := strings.ToLower(token.Data)

			if tagName == "title" {
				inTitleTag = true
				titleTextBuffer.Reset()
			} else if tagName == "meta" {
				var prop, name, content string
				for _, attr := range token.Attr {
					switch strings.ToLower(attr.Key) {
					case "property":
						prop = strings.ToLower(strings.TrimSpace(attr.Val))
					case "name":
						name = strings.ToLower(strings.TrimSpace(attr.Val))
					case "content":
						content = strings.TrimSpace(attr.Val)
					}
				}

				switch prop {
				case "og:title":
					if ogTitle == "" {
						ogTitle = content
					}
				case "og:description":
					if ogDesc == "" {
						ogDesc = content
					}
				case "og:image", "og:image:url":
					if ogImage == "" {
						ogImage = content
					}
				case "og:site_name":
					if ogSiteName == "" {
						ogSiteName = content
					}
				}

				switch name {
				case "twitter:title":
					if twitterTitle == "" {
						twitterTitle = content
					}
				case "description":
					if metaDesc == "" {
						metaDesc = content
					}
				case "twitter:description":
					if twitterDesc == "" {
						twitterDesc = content
					}
				case "twitter:image", "twitter:image:src":
					if twitterImage == "" {
						twitterImage = content
					}
				}
			} else if tagName == "link" {
				var rel, href string
				for _, attr := range token.Attr {
					switch strings.ToLower(attr.Key) {
					case "rel":
						rel = strings.ToLower(strings.TrimSpace(attr.Val))
					case "href":
						href = strings.TrimSpace(attr.Val)
					}
				}
				if strings.Contains(rel, "icon") && favicon == "" && href != "" {
					favicon = href
				}
			}

		case html.TextToken:
			if inTitleTag {
				titleTextBuffer.WriteString(tokenizer.Token().Data)
			}

		case html.EndTagToken:
			token := tokenizer.Token()
			if strings.ToLower(token.Data) == "title" {
				inTitleTag = false
				if rawTitle == "" {
					rawTitle = strings.TrimSpace(titleTextBuffer.String())
				}
			}
			// Stop scanning if we exited </head> to save time and memory
			if strings.ToLower(token.Data) == "head" {
				finalizeExtracted(preview, baseURL, rawTitle, ogTitle, twitterTitle, ogDesc, metaDesc, twitterDesc, ogImage, twitterImage, favicon, ogSiteName)
				return
			}
		}
	}
}

func finalizeExtracted(
	preview *domain.LinkPreview,
	baseURL *url.URL,
	rawTitle, ogTitle, twitterTitle, ogDesc, metaDesc, twitterDesc, ogImage, twitterImage, favicon, ogSiteName string,
) {
	// Pick best title
	if ogTitle != "" {
		preview.Title = cleanText(ogTitle, 150)
	} else if twitterTitle != "" {
		preview.Title = cleanText(twitterTitle, 150)
	} else if rawTitle != "" {
		preview.Title = cleanText(rawTitle, 150)
	}

	// Pick best description
	if ogDesc != "" {
		preview.Description = cleanText(ogDesc, 300)
	} else if metaDesc != "" {
		preview.Description = cleanText(metaDesc, 300)
	} else if twitterDesc != "" {
		preview.Description = cleanText(twitterDesc, 300)
	}

	// Pick best image
	img := ogImage
	if img == "" {
		img = twitterImage
	}
	if img != "" {
		preview.ImageURL = resolveURL(baseURL, img)
	}

	if favicon != "" {
		preview.FaviconURL = resolveURL(baseURL, favicon)
	}

	if ogSiteName != "" {
		preview.SiteName = cleanText(ogSiteName, 80)
	}
}

func cleanText(s string, maxLen int) string {
	cleaned := strings.Join(strings.Fields(s), " ")
	if len(cleaned) > maxLen {
		return cleaned[:maxLen-1] + "…"
	}
	return cleaned
}

func resolveURL(base *url.URL, ref string) string {
	if base == nil {
		return ref
	}
	parsedRef, err := url.Parse(ref)
	if err != nil {
		return ref
	}
	return base.ResolveReference(parsedRef).String()
}

func formatNetworkError(err error) string {
	if errors.Is(err, context.DeadlineExceeded) {
		return "Время ожидания ответа сайта истекло (Timeout)"
	}
	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		return "Время ожидания ответа сайта истекло (Timeout)"
	}
	errStr := err.Error()
	if strings.Contains(errStr, "no such host") {
		return "Сайт не найден (DNS lookup failed)"
	}
	if strings.Contains(errStr, "connection refused") {
		return "Соединение отклонено сервером"
	}
	return fmt.Sprintf("Ошибка соединения: %v", err)
}
