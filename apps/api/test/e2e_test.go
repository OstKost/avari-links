package test_test

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/OstKost/avari-links/apps/api/internal/database"
	"github.com/OstKost/avari-links/apps/api/internal/domain"
	"github.com/OstKost/avari-links/apps/api/internal/handler"
	"github.com/OstKost/avari-links/apps/api/internal/repository/sqlite"
	"github.com/OstKost/avari-links/apps/api/internal/service"
	"github.com/go-playground/validator/v10"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTestServer(t *testing.T, blockedDomains ...[]string) (http.Handler, *sql.DB, domain.LinkRepository, domain.SessionRepository) {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "test_e2e.db")
	db, err := database.NewConnection(dbPath)
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = db.Exec("PRAGMA wal_checkpoint(TRUNCATE)")
		_ = db.Close()
	})

	err = database.Migrate(db)
	require.NoError(t, err)

	validate := validator.New()
	linkRepo := sqlite.NewLinkRepository(db)
	sessionRepo := sqlite.NewSessionRepository(db)

	var blocked []string
	if len(blockedDomains) > 0 {
		blocked = blockedDomains[0]
	} else {
		blocked = []string{"malware.com", "phishing.test", "blocked.local"}
	}

	linkService := service.NewLinkService(linkRepo, "http://localhost:4820", 6, blocked)
	sessionService := service.NewSessionService(sessionRepo, linkRepo)

	linkHandler := handler.NewLinkHandler(linkService, validate)
	authHandler := handler.NewAuthHandler(sessionService, linkRepo, validate)
	redirectHandler := handler.NewRedirectHandler(linkService)

	router := handler.NewRouter(handler.RouterConfig{
		LinkHandler:     linkHandler,
		RedirectHandler: redirectHandler,
		AuthHandler:     authHandler,
		SessionService:  sessionService,
		DB:              db,
		AllowedOrigins:  []string{"*"},
	})

	return router, db, linkRepo, sessionRepo
}

func doJSONRequest(t *testing.T, router http.Handler, method, path string, body interface{}, sessionKey string) *httptest.ResponseRecorder {
	t.Helper()
	var bodyReader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		require.NoError(t, err)
		bodyReader = bytes.NewReader(data)
	}

	req := httptest.NewRequest(method, path, bodyReader)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if sessionKey != "" {
		req.Header.Set("X-Session-Key", sessionKey)
	}

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

func TestE2E_HealthCheck(t *testing.T) {
	router, _, _, _ := setupTestServer(t)

	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]string
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.Equal(t, "ok", resp["status"])
	assert.Equal(t, "connected", resp["database"])
}

func TestE2E_SessionLifecycle_And_LinkManagement(t *testing.T) {
	router, _, _, _ := setupTestServer(t)

	// 1. Create anonymous session
	wSession := doJSONRequest(t, router, http.MethodPost, "/api/v1/auth/session", nil, "")
	assert.Equal(t, http.StatusCreated, wSession.Code)

	var sessionResp handler.SessionResponse
	err := json.Unmarshal(wSession.Body.Bytes(), &sessionResp)
	require.NoError(t, err)
	assert.NotEmpty(t, sessionResp.ID)
	assert.NotEmpty(t, sessionResp.AccessKey)
	assert.Equal(t, int64(0), sessionResp.LinksCount)

	userKey := sessionResp.AccessKey

	// 2. Check /api/v1/auth/me
	wMe := doJSONRequest(t, router, http.MethodGet, "/api/v1/auth/me", nil, userKey)
	assert.Equal(t, http.StatusOK, wMe.Code)
	var meResp handler.SessionMeResponse
	err = json.Unmarshal(wMe.Body.Bytes(), &meResp)
	require.NoError(t, err)
	assert.Equal(t, sessionResp.ID, meResp.ID)
	assert.Equal(t, int64(0), meResp.LinksCount)

	// 3. Create first link with custom code
	createReq := handler.CreateLinkRequest{
		OriginalURL: "https://golang.org/doc/effective_go",
		Title:       "Effective Go",
		CustomCode:  "effective-go",
	}
	wLink1 := doJSONRequest(t, router, http.MethodPost, "/api/v1/links", createReq, userKey)
	assert.Equal(t, http.StatusCreated, wLink1.Code)
	var link1 handler.LinkResponse
	err = json.Unmarshal(wLink1.Body.Bytes(), &link1)
	require.NoError(t, err)
	assert.Equal(t, "effective-go", link1.Code)
	assert.Equal(t, "Effective Go", link1.Title)
	assert.True(t, link1.IsActive)
	assert.Equal(t, "http://localhost:4820/s/effective-go", link1.ShortURL)

	// 4. Create second link with auto-generated code
	createReq2 := handler.CreateLinkRequest{
		OriginalURL: "https://react.dev/learn",
		Title:       "React Docs",
	}
	wLink2 := doJSONRequest(t, router, http.MethodPost, "/api/v1/links", createReq2, userKey)
	assert.Equal(t, http.StatusCreated, wLink2.Code)
	var link2 handler.LinkResponse
	err = json.Unmarshal(wLink2.Body.Bytes(), &link2)
	require.NoError(t, err)
	assert.NotEmpty(t, link2.Code)
	assert.Equal(t, "React Docs", link2.Title)

	// 5. Verify /api/v1/auth/me reports 2 links
	wMe2 := doJSONRequest(t, router, http.MethodGet, "/api/v1/auth/me", nil, userKey)
	assert.Equal(t, http.StatusOK, wMe2.Code)
	err = json.Unmarshal(wMe2.Body.Bytes(), &meResp)
	require.NoError(t, err)
	assert.Equal(t, int64(2), meResp.LinksCount)

	// 6. Restore session on a new "device" using the mnemonic phrase
	restoreReq := handler.RestoreSessionRequest{
		AccessKey: userKey,
	}
	wRestore := doJSONRequest(t, router, http.MethodPost, "/api/v1/auth/restore", restoreReq, "")
	assert.Equal(t, http.StatusOK, wRestore.Code)
	var restoredResp handler.SessionResponse
	err = json.Unmarshal(wRestore.Body.Bytes(), &restoredResp)
	require.NoError(t, err)
	assert.Equal(t, sessionResp.ID, restoredResp.ID)
	assert.Equal(t, int64(2), restoredResp.LinksCount)

	// 7. List links for this session
	wList := doJSONRequest(t, router, http.MethodGet, "/api/v1/links", nil, userKey)
	assert.Equal(t, http.StatusOK, wList.Code)
	var listResp handler.PaginatedListResponse
	err = json.Unmarshal(wList.Body.Bytes(), &listResp)
	require.NoError(t, err)
	assert.Equal(t, int64(2), listResp.Total)
	assert.Len(t, listResp.Data, 2)

	// 8. Search links by query
	wSearch := doJSONRequest(t, router, http.MethodGet, "/api/v1/links?search=effective", nil, userKey)
	assert.Equal(t, http.StatusOK, wSearch.Code)
	var searchResp handler.PaginatedListResponse
	err = json.Unmarshal(wSearch.Body.Bytes(), &searchResp)
	require.NoError(t, err)
	assert.Equal(t, int64(1), searchResp.Total)
	assert.Equal(t, "effective-go", searchResp.Data[0].Code)

	// 9. Get link by ID
	wGet := doJSONRequest(t, router, http.MethodGet, fmt.Sprintf("/api/v1/links/%s", link1.ID), nil, userKey)
	assert.Equal(t, http.StatusOK, wGet.Code)
	var getResp handler.LinkResponse
	err = json.Unmarshal(wGet.Body.Bytes(), &getResp)
	require.NoError(t, err)
	assert.Equal(t, link1.ID, getResp.ID)

	// 10. Test Redirect and Click Counter
	reqRedirect := httptest.NewRequest(http.MethodGet, "/s/effective-go", nil)
	wRedirect := httptest.NewRecorder()
	router.ServeHTTP(wRedirect, reqRedirect)
	assert.Equal(t, http.StatusFound, wRedirect.Code)
	assert.Equal(t, "https://golang.org/doc/effective_go", wRedirect.Header().Get("Location"))

	// Give the async click increment goroutine a moment to persist
	time.Sleep(50 * time.Millisecond)

	wGetAfterClick := doJSONRequest(t, router, http.MethodGet, fmt.Sprintf("/api/v1/links/%s", link1.ID), nil, userKey)
	assert.Equal(t, http.StatusOK, wGetAfterClick.Code)
	var afterClickResp handler.LinkResponse
	err = json.Unmarshal(wGetAfterClick.Body.Bytes(), &afterClickResp)
	require.NoError(t, err)
	assert.Equal(t, int64(1), afterClickResp.Clicks)

	// 11. Toggle status to inactive
	activeFalse := false
	wToggle := doJSONRequest(t, router, http.MethodPatch, fmt.Sprintf("/api/v1/links/%s/status", link1.ID), handler.UpdateStatusRequest{
		IsActive: &activeFalse,
	}, userKey)
	assert.Equal(t, http.StatusOK, wToggle.Code)

	// Verify redirect fails on inactive link
	reqRedirectInactive := httptest.NewRequest(http.MethodGet, "/s/effective-go", nil)
	wRedirectInactive := httptest.NewRecorder()
	router.ServeHTTP(wRedirectInactive, reqRedirectInactive)
	assert.Equal(t, http.StatusGone, wRedirectInactive.Code)

	// 12. Delete link
	wDelete := doJSONRequest(t, router, http.MethodDelete, fmt.Sprintf("/api/v1/links/%s", link1.ID), nil, userKey)
	assert.Equal(t, http.StatusNoContent, wDelete.Code)

	// Verify link is now deleted
	wGetDeleted := doJSONRequest(t, router, http.MethodGet, fmt.Sprintf("/api/v1/links/%s", link1.ID), nil, userKey)
	assert.Equal(t, http.StatusNotFound, wGetDeleted.Code)

	// Verify redirect on deleted link returns 404
	reqRedirectDeleted := httptest.NewRequest(http.MethodGet, "/s/effective-go", nil)
	wRedirectDeleted := httptest.NewRecorder()
	router.ServeHTTP(wRedirectDeleted, reqRedirectDeleted)
	assert.Equal(t, http.StatusNotFound, wRedirectDeleted.Code)
}

func TestE2E_ContentFiltering_And_NSFWFlow(t *testing.T) {
	router, _, _, _ := setupTestServer(t)

	// Create session
	wSession := doJSONRequest(t, router, http.MethodPost, "/api/v1/auth/session", nil, "")
	var sessionResp handler.SessionResponse
	_ = json.Unmarshal(wSession.Body.Bytes(), &sessionResp)
	userKey := sessionResp.AccessKey

	// 1. Blocked destination rejection
	wBlocked := doJSONRequest(t, router, http.MethodPost, "/api/v1/links", handler.CreateLinkRequest{
		OriginalURL: "https://malware.com/evil.exe",
	}, userKey)
	assert.Equal(t, http.StatusForbidden, wBlocked.Code)
	assert.Contains(t, wBlocked.Body.String(), "blocked")

	// 2. NSFW destination without explicit flag rejection
	wNSFWNoFlag := doJSONRequest(t, router, http.MethodPost, "/api/v1/links", handler.CreateLinkRequest{
		OriginalURL: "https://example.com/nsfw-content/gallery",
		IsNSFW:      false,
	}, userKey)
	assert.Equal(t, http.StatusBadRequest, wNSFWNoFlag.Code)
	assert.Contains(t, wNSFWNoFlag.Body.String(), "NSFW")

	// 3. NSFW destination WITH flag success
	wNSFWWithFlag := doJSONRequest(t, router, http.MethodPost, "/api/v1/links", handler.CreateLinkRequest{
		OriginalURL: "https://example.com/nsfw-content/gallery",
		CustomCode:  "adult-gallery",
		IsNSFW:      true,
	}, userKey)
	assert.Equal(t, http.StatusCreated, wNSFWWithFlag.Code)

	// 4. Requesting NSFW link redirect shows warning page with consent form and cookie
	reqNSFW := httptest.NewRequest(http.MethodGet, "/s/adult-gallery", nil)
	wNSFW := httptest.NewRecorder()
	router.ServeHTTP(wNSFW, reqNSFW)

	assert.Equal(t, http.StatusOK, wNSFW.Code)
	assert.Contains(t, wNSFW.Body.String(), "Возможен контент 18+")

	// Extract consent token from form body
	re := regexp.MustCompile(`name="consent_token" value="([a-f0-9]+)"`)
	match := re.FindStringSubmatch(wNSFW.Body.String())
	require.Len(t, match, 2)
	consentToken := match[1]

	cookies := wNSFW.Result().Cookies()
	require.NotEmpty(t, cookies)
	var consentCookie *http.Cookie
	for _, c := range cookies {
		if c.Name == "nsfw_consent" {
			consentCookie = c
			break
		}
	}
	require.NotNil(t, consentCookie)

	// 5. POST to continue without cookie -> 403 Forbidden
	reqWithoutCookie := httptest.NewRequest(http.MethodPost, "/s/adult-gallery/continue", nil)
	wWithoutCookie := httptest.NewRecorder()
	router.ServeHTTP(wWithoutCookie, reqWithoutCookie)
	assert.Equal(t, http.StatusForbidden, wWithoutCookie.Code)

	// 6. POST to continue with cookie and valid form data -> 302 Redirect
	form := url.Values{"consent_token": {consentToken}}
	reqContinue := httptest.NewRequest(http.MethodPost, "/s/adult-gallery/continue", strings.NewReader(form.Encode()))
	reqContinue.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	reqContinue.AddCookie(consentCookie)
	wContinue := httptest.NewRecorder()
	router.ServeHTTP(wContinue, reqContinue)

	assert.Equal(t, http.StatusFound, wContinue.Code)
	assert.Equal(t, "https://example.com/nsfw-content/gallery", wContinue.Header().Get("Location"))
}

func TestE2E_Security_And_CrossUserIsolation(t *testing.T) {
	router, _, _, _ := setupTestServer(t)

	// Create User A session
	wSessionA := doJSONRequest(t, router, http.MethodPost, "/api/v1/auth/session", nil, "")
	var sessionA handler.SessionResponse
	_ = json.Unmarshal(wSessionA.Body.Bytes(), &sessionA)

	// Create User B session
	wSessionB := doJSONRequest(t, router, http.MethodPost, "/api/v1/auth/session", nil, "")
	var sessionB handler.SessionResponse
	_ = json.Unmarshal(wSessionB.Body.Bytes(), &sessionB)

	// User A creates a link
	wLinkA := doJSONRequest(t, router, http.MethodPost, "/api/v1/links", handler.CreateLinkRequest{
		OriginalURL: "https://secret.example.com/project",
		CustomCode:  "user-a-link",
	}, sessionA.AccessKey)
	assert.Equal(t, http.StatusCreated, wLinkA.Code)
	var linkA handler.LinkResponse
	_ = json.Unmarshal(wLinkA.Body.Bytes(), &linkA)

	// User B tries to update status of User A's link -> 403 Forbidden
	activeFalse := false
	wUpdateB := doJSONRequest(t, router, http.MethodPatch, fmt.Sprintf("/api/v1/links/%s/status", linkA.ID), handler.UpdateStatusRequest{
		IsActive: &activeFalse,
	}, sessionB.AccessKey)
	assert.Equal(t, http.StatusForbidden, wUpdateB.Code)

	// User B tries to delete User A's link -> 403 Forbidden
	wDeleteB := doJSONRequest(t, router, http.MethodDelete, fmt.Sprintf("/api/v1/links/%s", linkA.ID), nil, sessionB.AccessKey)
	assert.Equal(t, http.StatusForbidden, wDeleteB.Code)

	// User B lists links -> should see 0 links
	wListB := doJSONRequest(t, router, http.MethodGet, "/api/v1/links", nil, sessionB.AccessKey)
	assert.Equal(t, http.StatusOK, wListB.Code)
	var listB handler.PaginatedListResponse
	_ = json.Unmarshal(wListB.Body.Bytes(), &listB)
	assert.Equal(t, int64(0), listB.Total)
	assert.Empty(t, listB.Data)

	// Unauthenticated user tries to update or delete -> 401 Unauthorized
	wAnonUpdate := doJSONRequest(t, router, http.MethodPatch, fmt.Sprintf("/api/v1/links/%s/status", linkA.ID), handler.UpdateStatusRequest{
		IsActive: &activeFalse,
	}, "")
	assert.Equal(t, http.StatusUnauthorized, wAnonUpdate.Code)

	wAnonDelete := doJSONRequest(t, router, http.MethodDelete, fmt.Sprintf("/api/v1/links/%s", linkA.ID), nil, "")
	assert.Equal(t, http.StatusUnauthorized, wAnonDelete.Code)
}

func TestE2E_PremiumStatus_And_ShortCodes(t *testing.T) {
	router, db, _, _ := setupTestServer(t)

	// 1. Create a free session
	wSession := doJSONRequest(t, router, http.MethodPost, "/api/v1/auth/session", nil, "")
	assert.Equal(t, http.StatusCreated, wSession.Code)
	var sessionResp handler.SessionResponse
	err := json.Unmarshal(wSession.Body.Bytes(), &sessionResp)
	require.NoError(t, err)
	assert.False(t, sessionResp.IsPremium)

	// 2. Check /api/v1/auth/me reports is_premium = false
	wMe := doJSONRequest(t, router, http.MethodGet, "/api/v1/auth/me", nil, sessionResp.AccessKey)
	assert.Equal(t, http.StatusOK, wMe.Code)
	var meResp handler.SessionMeResponse
	err = json.Unmarshal(wMe.Body.Bytes(), &meResp)
	require.NoError(t, err)
	assert.False(t, meResp.IsPremium)

	// 3. Free user attempts 4-character code -> 403 Forbidden
	wShortFree := doJSONRequest(t, router, http.MethodPost, "/api/v1/links", handler.CreateLinkRequest{
		OriginalURL: "https://beta.example.com",
		CustomCode:  "beta",
	}, sessionResp.AccessKey)
	assert.Equal(t, http.StatusForbidden, wShortFree.Code)
	assert.Contains(t, wShortFree.Body.String(), "require Premium status")

	// 4. Admin manually sets is_premium = 1 in database
	_, err = db.Exec("UPDATE anonymous_sessions SET is_premium = 1 WHERE id = ?", sessionResp.ID)
	require.NoError(t, err)

	// 5. Check /api/v1/auth/me now reports is_premium = true
	wMePrem := doJSONRequest(t, router, http.MethodGet, "/api/v1/auth/me", nil, sessionResp.AccessKey)
	assert.Equal(t, http.StatusOK, wMePrem.Code)
	err = json.Unmarshal(wMePrem.Body.Bytes(), &meResp)
	require.NoError(t, err)
	assert.True(t, meResp.IsPremium)

	// 6. Premium user creates 4-character code -> 201 Created
	wShortPrem := doJSONRequest(t, router, http.MethodPost, "/api/v1/links", handler.CreateLinkRequest{
		OriginalURL: "https://beta.example.com",
		CustomCode:  "beta",
	}, sessionResp.AccessKey)
	assert.Equal(t, http.StatusCreated, wShortPrem.Code)
	var linkResp handler.LinkResponse
	err = json.Unmarshal(wShortPrem.Body.Bytes(), &linkResp)
	require.NoError(t, err)
	assert.Equal(t, "beta", linkResp.Code)

	// 7. Even Premium user cannot use slug shorter than 4 characters
	wTooShort := doJSONRequest(t, router, http.MethodPost, "/api/v1/links", handler.CreateLinkRequest{
		OriginalURL: "https://cat.example.com",
		CustomCode:  "cat",
	}, sessionResp.AccessKey)
	assert.Equal(t, http.StatusBadRequest, wTooShort.Code)
}
