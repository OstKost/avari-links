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

// NormalizeTargetURL ensures a URL has a default https:// scheme if omitted.
func NormalizeTargetURL(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}
	lower := strings.ToLower(trimmed)
	if strings.HasPrefix(lower, "http://") || strings.HasPrefix(lower, "https://") {
		return trimmed
	}
	// If it has an explicit other scheme like ftp:// or custom://, don't prepend
	if strings.Contains(trimmed, "://") {
		return trimmed
	}
	// Only auto-prefix if host portion looks like a domain name with a dot or localhost
	hostPart := strings.SplitN(trimmed, "/", 2)[0]
	if strings.Contains(hostPart, ".") || strings.HasPrefix(lower, "localhost") {
		return "https://" + trimmed
	}
	return trimmed
}

var (
	// nsfwRoots are substrings that unequivocally indicate adult content in URLs or page text.
	nsfwRoots = []string{
		"pornhub", "xvideos", "xhamster", "xnxx", "redtube", "youporn",
		"brazzers", "chaturbate", "onlyfans", "stripchat", "bongacams",
		"livejasmin", "cam4", "camsoda", "beeg", "spankbang", "eporner",
		"tnaflix", "tube8", "youjizz", "fapdu", "hqporner", "rule34",
		"nhentai", "luscious", "erome", "manyvids", "fansly",
		"porn", "porno", "порно", "хентай", "hentai",
		"erotic", "erotica", "эротик", "эротика",
		"сиськи", "минет", "кунилингус", "дилдо", "вибратор",
		"шлюх", "проститут", "эскорт", "интим", "онлифанс",
		"нюдс", "rta-5042", "sex-shop", "секс-шоп", "сексшоп",
	}

	// nsfwTokens are standalone words or domain tokens that indicate adult content.
	nsfwTokens = map[string]bool{
		"sex": true, "секс": true, "xxx": true, "18+": true, "r18": true,
		"nsfw": true, "adult": true, "adults": true, "nude": true, "nudes": true,
		"nudity": true, "boobs": true, "tits": true, "pussy": true, "dick": true,
		"milf": true, "bdsm": true, "fetish": true, "escort": true,
		"camgirl": true, "hardcore": true, "blowjob": true, "creampie": true,
		"gangbang": true, "masturbat": true, "masturbation": true,
		"член": true, "анал": true, "анальный": true, "трах": true,
		"трахать": true, "голая": true, "голые": true, "вебкам": true,
		"дроч": true, "дрочить": true, "mature": true,
	}
)

// HasNSFWWords checks a text snippet for adult/NSFW keywords and rating indicators.
func HasNSFWWords(text string) bool {
	if text == "" {
		return false
	}
	lower := strings.ToLower(text)

	// Check substring roots
	for _, root := range nsfwRoots {
		if strings.Contains(lower, root) {
			return true
		}
	}

	// Tokenize text into words
	tokens := strings.FieldsFunc(lower, func(r rune) bool {
		if r == '+' || r == '-' {
			return false
		}
		return !((r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || (r >= 'а' && r <= 'я') || r == 'ё')
	})

	for _, token := range tokens {
		trimmed := strings.Trim(token, "-")
		if trimmed == "" {
			continue
		}
		if nsfwTokens[trimmed] {
			return true
		}
		if strings.HasPrefix(trimmed, "18+") || strings.HasPrefix(trimmed, "r18") {
			return true
		}
	}

	return false
}

// LooksNSFW checks if URL hostname, path, query, or associated site text contain adult/NSFW keywords.
func LooksNSFW(u *url.URL, extraText ...string) bool {
	if u != nil {
		hostLower := strings.ToLower(u.Hostname())
		// Check full hostname against roots
		for _, root := range nsfwRoots {
			if strings.Contains(hostLower, root) {
				return true
			}
		}

		// Check hostname labels and segments
		for _, label := range strings.FieldsFunc(hostLower, func(r rune) bool {
			return r == '.' || r == '-' || r == '_'
		}) {
			if nsfwTokens[label] || strings.HasPrefix(label, "18+") || strings.HasPrefix(label, "r18") {
				return true
			}
		}

		// Check path segments
		for _, segment := range strings.FieldsFunc(strings.ToLower(u.Path), func(r rune) bool {
			return r == '/' || r == '-' || r == '_' || r == '.'
		}) {
			if HasNSFWWords(segment) {
				return true
			}
		}

		// Check raw query
		if u.RawQuery != "" && HasNSFWWords(u.RawQuery) {
			return true
		}
	}

	for _, text := range extraText {
		if HasNSFWWords(text) {
			return true
		}
	}

	return false
}

// Inspect fetches the target URL and extracts OpenGraph/HTML metadata.
func (s *previewService) Inspect(ctx context.Context, rawURL string) (*domain.LinkPreview, error) {
	trimmed := NormalizeTargetURL(rawURL)
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
			IsNSFW:      LooksNSFW(parsed),
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
			IsNSFW:      LooksNSFW(parsed),
			Error:       formatNetworkError(err),
		}, nil
	}
	defer resp.Body.Close()

	ratingHeader := resp.Header.Get("Rating")
	ageRatingHeader := resp.Header.Get("Age-Rating")

	preview := &domain.LinkPreview{
		URL:         trimmed,
		StatusCode:  resp.StatusCode,
		IsReachable: resp.StatusCode >= 200 && resp.StatusCode < 400,
	}

	if resp.StatusCode >= 400 {
		preview.IsNSFW = LooksNSFW(parsed, ratingHeader, ageRatingHeader)
		preview.Error = fmt.Sprintf("HTTP status %d %s", resp.StatusCode, http.StatusText(resp.StatusCode))
		return preview, nil
	}

	// Read limited HTML stream and extract metadata and page text
	limitedReader := io.LimitReader(resp.Body, maxHTMLReadBytes)
	extraPageWords := s.extractMetadata(limitedReader, resp.Request.URL, preview)

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

	preview.IsNSFW = LooksNSFW(parsed, preview.Title, preview.Description, preview.SiteName, ratingHeader, ageRatingHeader, extraPageWords)

	return preview, nil
}

func (s *previewService) extractMetadata(r io.Reader, baseURL *url.URL, preview *domain.LinkPreview) string {
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
		metaKeywords    string
		metaRating      string
		inTitleTag      bool
		inBodyTag       bool
		inScriptOrStyle bool
		titleTextBuffer strings.Builder
		bodyTextBuffer  strings.Builder
	)

	for {
		tt := tokenizer.Next()
		switch tt {
		case html.ErrorToken:
			// EOF or read error
			finalizeExtracted(preview, baseURL, rawTitle, ogTitle, twitterTitle, ogDesc, metaDesc, twitterDesc, ogImage, twitterImage, favicon, ogSiteName)
			return metaKeywords + " " + metaRating + " " + bodyTextBuffer.String()

		case html.StartTagToken, html.SelfClosingTagToken:
			token := tokenizer.Token()
			tagName := strings.ToLower(token.Data)

			if tagName == "title" {
				inTitleTag = true
				titleTextBuffer.Reset()
			} else if tagName == "body" {
				inBodyTag = true
			} else if tagName == "script" || tagName == "style" || tagName == "noscript" || tagName == "svg" {
				inScriptOrStyle = true
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
				case "keywords":
					if metaKeywords == "" {
						metaKeywords = content
					}
				case "rating", "age-rating", "rating-rta":
					if metaRating == "" {
						metaRating = content
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
			textData := tokenizer.Token().Data
			if inTitleTag {
				titleTextBuffer.WriteString(textData)
			} else if inBodyTag && !inScriptOrStyle {
				// Accumulate words from visible page body up to 32KB
				if bodyTextBuffer.Len() < 32768 {
					trimmed := strings.TrimSpace(textData)
					if trimmed != "" {
						bodyTextBuffer.WriteString(" ")
						bodyTextBuffer.WriteString(trimmed)
					}
				}
			}

		case html.EndTagToken:
			token := tokenizer.Token()
			tagName := strings.ToLower(token.Data)
			if tagName == "title" {
				inTitleTag = false
				if rawTitle == "" {
					rawTitle = strings.TrimSpace(titleTextBuffer.String())
				}
			} else if tagName == "script" || tagName == "style" || tagName == "noscript" || tagName == "svg" {
				inScriptOrStyle = false
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
