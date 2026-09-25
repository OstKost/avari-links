package service

import (
	"context"
	"fmt"
	"log/slog"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/OstKost/avari-links/apps/api/internal/domain"
	"github.com/OstKost/avari-links/apps/api/pkg/base62"
	"github.com/google/uuid"
)

var customSlugRegex = regexp.MustCompile(`^[a-zA-Z0-9-_]{3,30}$`)

// linkService implements domain.LinkService.
type linkService struct {
	repo           domain.LinkRepository
	baseURL        string
	codeLength     int
	blockedDomains []string
}

// NewLinkService creates a new instance of LinkService.
func NewLinkService(repo domain.LinkRepository, baseURL string, codeLength int, blockedDomains ...[]string) domain.LinkService {
	if codeLength <= 0 {
		codeLength = 6
	}
	var domains []string
	if len(blockedDomains) > 0 {
		for _, domainName := range blockedDomains[0] {
			if normalized := strings.Trim(strings.ToLower(strings.TrimSpace(domainName)), "."); normalized != "" {
				domains = append(domains, normalized)
			}
		}
	}
	return &linkService{
		repo:           repo,
		baseURL:        strings.TrimRight(baseURL, "/"),
		codeLength:     codeLength,
		blockedDomains: domains,
	}
}

func (s *linkService) Create(ctx context.Context, dto domain.CreateLinkDTO) (*domain.Link, error) {
	// 1. Validate & normalize URL
	targetURL := strings.TrimSpace(dto.OriginalURL)
	if targetURL == "" {
		return nil, domain.ErrInvalidURL
	}

	parsedURL, err := url.ParseRequestURI(targetURL)
	if err != nil || (parsedURL.Scheme != "http" && parsedURL.Scheme != "https") || parsedURL.Host == "" {
		return nil, domain.ErrInvalidURL
	}
	if s.isBlocked(parsedURL.Hostname()) {
		return nil, domain.ErrBlockedDestination
	}
	if looksNSFW(parsedURL) && !dto.IsNSFW {
		return nil, domain.ErrNSFWLabelRequired
	}

	// 2. Resolve code / slug
	var code string
	customCode := strings.TrimSpace(dto.CustomCode)

	if customCode != "" {
		if !customSlugRegex.MatchString(customCode) {
			return nil, domain.ErrInvalidSlug
		}
		exists, err := s.repo.ExistsCode(ctx, customCode)
		if err != nil {
			return nil, fmt.Errorf("failed to check custom code existence: %w", err)
		}
		if exists {
			return nil, domain.ErrConflict
		}
		code = customCode
	} else {
		// Generate random unique code with collision retry
		for attempt := 0; attempt < 5; attempt++ {
			candidate, err := base62.Generate(s.codeLength)
			if err != nil {
				return nil, fmt.Errorf("failed to generate random code: %w", err)
			}

			exists, err := s.repo.ExistsCode(ctx, candidate)
			if err != nil {
				return nil, fmt.Errorf("failed to check code collision: %w", err)
			}
			if !exists {
				code = candidate
				break
			}
		}
		if code == "" {
			return nil, fmt.Errorf("could not generate unique code after multiple attempts")
		}
	}

	// 3. Resolve Title
	title := strings.TrimSpace(dto.Title)
	if title == "" {
		title = parsedURL.Host
	}

	now := time.Now().UTC()
	link := &domain.Link{
		ID:          uuid.New().String(),
		OriginalURL: targetURL,
		Code:        code,
		Title:       title,
		Clicks:      0,
		IsActive:    true,
		IsNSFW:      dto.IsNSFW,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := s.repo.Create(ctx, link); err != nil {
		return nil, err
	}

	s.enrichShortURL(link)
	return link, nil
}

func (s *linkService) GetByID(ctx context.Context, id string) (*domain.Link, error) {
	link, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	s.enrichShortURL(link)
	return link, nil
}

func (s *linkService) GetByCode(ctx context.Context, code string) (*domain.Link, error) {
	link, err := s.repo.GetByCode(ctx, code)
	if err != nil {
		return nil, err
	}
	if err := s.checkDestination(link); err != nil {
		return nil, err
	}
	s.enrichShortURL(link)
	return link, nil
}

func (s *linkService) List(ctx context.Context, filter domain.ListLinksFilter) ([]*domain.Link, int64, error) {
	links, total, err := s.repo.List(ctx, filter)
	if err != nil {
		return nil, 0, err
	}
	for _, l := range links {
		s.enrichShortURL(l)
	}
	return links, total, nil
}

func (s *linkService) ToggleStatus(ctx context.Context, id string, isActive bool) (*domain.Link, error) {
	if err := s.repo.UpdateStatus(ctx, id, isActive); err != nil {
		return nil, err
	}
	return s.GetByID(ctx, id)
}

func (s *linkService) RecordClick(ctx context.Context, code string) (string, error) {
	link, err := s.GetByCode(ctx, code)
	if err != nil {
		return "", err
	}

	if !link.IsActive {
		return "", domain.ErrLinkInactive
	}

	// Increment clicks asynchronously so redirect speed is maximum
	go func(linkID string) {
		bgCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := s.repo.IncrementClicks(bgCtx, linkID, time.Now().UTC()); err != nil {
			slog.Error("failed to increment click counter", "link_id", linkID, "error", err)
		}
	}(link.ID)

	return link.OriginalURL, nil
}

func (s *linkService) checkDestination(link *domain.Link) error {
	parsed, err := url.Parse(link.OriginalURL)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Hostname() == "" {
		return domain.ErrInvalidURL
	}
	if s.isBlocked(parsed.Hostname()) {
		return domain.ErrBlockedDestination
	}
	if looksNSFW(parsed) && !link.IsNSFW {
		return domain.ErrNSFWLabelRequired
	}
	return nil
}

func (s *linkService) isBlocked(host string) bool {
	host = strings.TrimSuffix(strings.ToLower(host), ".")
	for _, blocked := range s.blockedDomains {
		if host == blocked || strings.HasSuffix(host, "."+blocked) {
			return true
		}
	}
	return false
}

func looksNSFW(u *url.URL) bool {
	markers := map[string]bool{"nsfw": true, "xxx": true, "porn": true, "adult": true, "hentai": true}
	for _, label := range strings.Split(strings.ToLower(u.Hostname()), ".") {
		if markers[label] {
			return true
		}
	}
	for _, segment := range strings.FieldsFunc(strings.ToLower(u.EscapedPath()), func(r rune) bool {
		return r == '/' || r == '-' || r == '_' || r == '.'
	}) {
		if markers[segment] {
			return true
		}
	}
	return false
}

func (s *linkService) Delete(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}

func (s *linkService) enrichShortURL(link *domain.Link) {
	if link != nil {
		link.ShortURL = fmt.Sprintf("%s/s/%s", s.baseURL, link.Code)
	}
}
