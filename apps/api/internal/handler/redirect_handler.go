package handler

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"html"
	"net/http"
	"net/url"
	"strings"

	"github.com/OstKost/avari-links/apps/api/internal/domain"
	"github.com/go-chi/chi/v5"
)

// RedirectHandler handles public short URL redirection.
type RedirectHandler struct{ service domain.LinkService }

func NewRedirectHandler(service domain.LinkService) *RedirectHandler {
	return &RedirectHandler{service: service}
}

// Redirect godoc
// @Summary Open short URL
// @Description Redirects ordinary links; NSFW links show a confirmation page first; inactive links show a deactivated notice page
// @Tags Redirect
// @Param code path string true "Short link code or slug"
// @Success 302 "Temporary Redirect"
// @Success 200 "NSFW warning"
// @Failure 403 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 410 {object} ErrorResponse "This shortened link is currently deactivated"
// @Router /s/{code} [get]
func (h *RedirectHandler) Redirect(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")
	if code == "" {
		respondError(w, http.StatusBadRequest, "Missing link code")
		return
	}
	link, err := h.service.GetByCode(r.Context(), code)
	if err != nil {
		mapDomainError(w, err)
		return
	}
	if !link.IsActive {
		if isJSONRequest(r) {
			mapDomainError(w, domain.ErrLinkInactive)
			return
		}
		showDeactivatedPage(w, r, code)
		return
	}
	if link.IsNSFW {
		showNSFWWarning(w, r, code, link.OriginalURL)
		return
	}
	h.redirectAndRecord(w, r, code)
}

// Continue godoc
// @Summary Continue through an NSFW warning
// @Description Confirms the visitor's choice and records the click
// @Tags Redirect
// @Param code path string true "Short link code or slug"
// @Success 302 "Temporary Redirect"
// @Failure 403 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 410 {object} ErrorResponse
// @Router /s/{code}/continue [post]
func (h *RedirectHandler) Continue(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")
	cookie, err := r.Cookie("nsfw_consent")
	if err != nil || r.FormValue("consent_token") == "" || len(cookie.Value) != 64 || subtle.ConstantTimeCompare([]byte(cookie.Value), []byte(r.FormValue("consent_token"))) != 1 {
		respondError(w, http.StatusForbidden, "Open the warning page and confirm the destination")
		return
	}
	clearConsentCookie(w, r, code)
	h.redirectAndRecord(w, r, code)
}

func (h *RedirectHandler) redirectAndRecord(w http.ResponseWriter, r *http.Request, code string) {
	if code == "" {
		respondError(w, http.StatusBadRequest, "Missing link code")
		return
	}
	targetURL, err := h.service.RecordClick(r.Context(), code)
	if err != nil {
		if errors.Is(err, domain.ErrLinkInactive) && !isJSONRequest(r) {
			showDeactivatedPage(w, r, code)
			return
		}
		mapDomainError(w, err)
		return
	}
	w.Header().Set("Referrer-Policy", "no-referrer")
	w.Header().Set("Cache-Control", "no-store")
	http.Redirect(w, r, targetURL, http.StatusFound)
}

func isJSONRequest(r *http.Request) bool {
	accept := r.Header.Get("Accept")
	return strings.Contains(accept, "application/json") && !strings.Contains(accept, "text/html")
}

const commonRedirectStyles = `
:root {
  --av-bg: #091416;
  --av-surface: #102326;
  --av-surface-raised: #173238;
  --av-surface-hover: #1c3d43;
  --av-text: #f3eee4;
  --av-text-secondary: #b4c3bf;
  --av-text-muted: #91a7a3;
  --av-gold: #d5ad68;
  --av-gold-hover: #e6c58d;
  --av-cyan: #65d9f5;
  --av-border-subtle: #294247;
  --av-border-control: #678581;
  --av-warning: #ebc77e;
  --av-danger: #f29b98;
}
@media (prefers-color-scheme: light) {
  :root {
    --av-bg: #f5f3ed;
    --av-surface: #fffdf7;
    --av-surface-raised: #edf1eb;
    --av-surface-hover: #e2eae3;
    --av-text: #172a2b;
    --av-text-secondary: #3c5553;
    --av-text-muted: #4d6461;
    --av-gold: #83602b;
    --av-gold-hover: #694a1c;
    --av-cyan: #07647a;
    --av-border-subtle: #c9d4cd;
    --av-border-control: #657f76;
    --av-warning: #7a5014;
    --av-danger: #a33634;
  }
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Onest', system-ui, -apple-system, sans-serif;
  background: radial-gradient(ellipse 80% 60% at 50% 20%, rgba(101, 217, 245, 0.07), transparent 70%), var(--av-bg);
  color: var(--av-text);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.card {
  width: 100%;
  max-width: 500px;
  background: var(--av-surface);
  border: 1px solid var(--av-border-subtle);
  border-radius: 16px;
  padding: 32px;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  margin-bottom: 24px;
}
.brand-logo-box {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid rgba(213, 173, 104, 0.5);
  background: var(--av-surface-raised);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 5px;
  box-shadow: 0 0 10px rgba(213, 173, 104, 0.15);
}
.brand-name {
  font-family: 'Philosopher', Georgia, serif;
  font-size: 1.45rem;
  color: var(--av-text);
  letter-spacing: 0.02em;
}
.gold-dot { color: var(--av-gold); }
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: 'Victor Mono', ui-monospace, monospace;
  font-size: 12px;
  font-weight: 500;
  border-radius: 9999px;
  padding: 4px 12px;
  margin-bottom: 16px;
}
.badge-warning {
  color: var(--av-warning);
  background: rgba(235, 199, 126, 0.1);
  border: 1px solid rgba(235, 199, 126, 0.3);
}
.badge-danger {
  color: var(--av-danger);
  background: rgba(242, 155, 152, 0.1);
  border: 1px solid rgba(242, 155, 152, 0.3);
}
.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
h1 {
  font-family: 'Philosopher', Georgia, serif;
  font-size: 1.65rem;
  font-weight: 400;
  line-height: 1.3;
  margin-bottom: 12px;
  color: var(--av-text);
}
p {
  font-size: 14.5px;
  line-height: 1.6;
  color: var(--av-text-secondary);
  margin-bottom: 20px;
}
.info-chip {
  width: 100%;
  background: var(--av-surface-raised);
  border: 1px solid var(--av-border-subtle);
  border-radius: 8px;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  font-size: 13px;
}
.info-label { color: var(--av-text-muted); }
.info-value {
  font-family: 'Victor Mono', ui-monospace, monospace;
  color: var(--av-cyan);
  font-size: 13px;
  font-weight: 500;
  word-break: break-all;
}
.actions {
  width: 100%;
  display: flex;
  flex-direction: row;
  gap: 12px;
  justify-content: center;
}
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-family: 'Victor Mono', ui-monospace, monospace;
  font-size: 14px;
  font-weight: 500;
  padding: 11px 20px;
  border-radius: 9px;
  text-decoration: none;
  transition: all 180ms ease;
  cursor: pointer;
  border: 1px solid var(--av-border-control);
  background: var(--av-surface-raised);
  color: var(--av-text);
  flex: 1;
}
.btn:hover {
  border-color: var(--av-gold);
  color: var(--av-gold);
  background: var(--av-surface-hover);
  transform: translateY(-1px);
}
.btn-primary {
  background: var(--av-cyan);
  color: #091416;
  border: 1px solid var(--av-cyan);
  font-weight: 600;
}
.btn-primary:hover {
  background: #7be1f8;
  color: #091416;
  border-color: #7be1f8;
}
.footer-note {
  margin-top: 24px;
  font-size: 12px;
  color: var(--av-text-muted);
}
@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; animation: none !important; }
}
`

const brandLogoSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" width="24" height="24">
<defs>
  <linearGradient id="av-gold-grad" x1="10" y1="6" x2="54" y2="58" gradientUnits="userSpaceOnUse">
    <stop offset="0%" stop-color="#f5dfa8"/>
    <stop offset="50%" stop-color="#d5ad68"/>
    <stop offset="100%" stop-color="#9d7432"/>
  </linearGradient>
  <linearGradient id="av-cyan-glow" x1="32" y1="24" x2="32" y2="40" gradientUnits="userSpaceOnUse">
    <stop offset="0%" stop-color="#bbf3ff"/>
    <stop offset="100%" stop-color="#65d9f5"/>
  </linearGradient>
</defs>
<path d="M28 8 C29 20 23 38 8 56 C20 48 27 34 32 18 Z" fill="url(#av-gold-grad)"/>
<path d="M36 8 C35 20 41 38 56 56 C44 48 37 34 32 18 Z" fill="url(#av-gold-grad)"/>
<path d="M15 48 C24 43 40 43 49 48 C41 40 23 40 15 48 Z" fill="#102326" stroke="url(#av-gold-grad)" stroke-width="1.2"/>
<path d="M32 26 C33 30 35 32 38 33 C35 34 33 36 32 40 C31 36 29 34 26 33 C29 32 31 30 32 26 Z" fill="url(#av-cyan-glow)"/>
</svg>`

func showDeactivatedPage(w http.ResponseWriter, r *http.Request, code string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Referrer-Policy", "no-referrer")
	w.Header().Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusGone)

	escapedCode := html.EscapeString(code)
	_, _ = fmt.Fprintf(w, `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ссылка деактивирована — Avari Links</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600&family=Philosopher:wght@400;700&family=Victor+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>%s</style>
</head>
<body>
<main class="card">
  <a href="/" class="brand" title="Avari Links">
    <span class="brand-logo-box">%s</span>
    <span class="brand-name">Avari Links<span class="gold-dot">.</span></span>
  </a>
  <div class="badge badge-warning"><span class="badge-dot"></span>410 • Ссылка деактивирована</div>
  <h1>Ссылка временно отключена</h1>
  <p>Создатель этой ссылки приостановил перенаправление или отключил её действие. Если это ваша ссылка, вы можете снова включить её в панели управления.</p>
  <div class="info-chip">
    <span class="info-label">Короткая ссылка:</span>
    <code class="info-value">/s/%s</code>
  </div>
  <div class="actions">
    <a href="/" class="btn btn-primary" style="flex:none;width:100%%">Перейти на главную</a>
  </div>
  <div class="footer-note">Avari Links — короткие ссылки и точный контроль</div>
</main>
</body>
</html>`, commonRedirectStyles, brandLogoSVG, escapedCode)
}

func showNSFWWarning(w http.ResponseWriter, r *http.Request, code, target string) {
	parsed, _ := url.Parse(target)
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		respondError(w, http.StatusInternalServerError, "Internal server error")
		return
	}
	token := hex.EncodeToString(tokenBytes)
	http.SetCookie(w, &http.Cookie{Name: "nsfw_consent", Value: token, Path: "/s/" + url.PathEscape(code) + "/continue", MaxAge: 600, HttpOnly: true, Secure: r.TLS != nil, SameSite: http.SameSiteStrictMode})
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Referrer-Policy", "no-referrer")
	w.Header().Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'")
	w.Header().Set("X-Content-Type-Options", "nosniff")

	escapedCode := html.EscapeString(code)
	escapedTargetHost := html.EscapeString(parsed.Hostname())
	pathEscapedCode := url.PathEscape(code)

	_, _ = fmt.Fprintf(w, `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Возможен контент 18+ — Avari Links</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600&family=Philosopher:wght@400;700&family=Victor+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>%s</style>
</head>
<body>
<main class="card">
  <a href="/" class="brand" title="Avari Links">
    <span class="brand-logo-box">%s</span>
    <span class="brand-name">Avari Links<span class="gold-dot">.</span></span>
  </a>
  <div class="badge badge-danger"><span class="badge-dot"></span>18+ • Предупреждение о содержимом</div>
  <h1>Возможен контент 18+</h1>
  <p>Создатель пометил эту ссылку как NSFW. Адрес назначения: <strong style="color:var(--av-text)">%s</strong>. Открывайте его, только если согласны увидеть материалы для взрослых.</p>
  <div class="info-chip">
    <span class="info-label">Короткая ссылка:</span>
    <code class="info-value">/s/%s</code>
  </div>
  <div class="actions">
    <form method="post" action="/s/%s/continue" style="flex:1;display:flex">
      <input type="hidden" name="consent_token" value="%s">
      <button type="submit" class="btn btn-primary" style="width:100%%">Продолжить</button>
    </form>
    <a href="/" class="btn">Отмена</a>
  </div>
  <div class="footer-note">Avari Links — короткие ссылки и точный контроль</div>
</main>
</body>
</html>`, commonRedirectStyles, brandLogoSVG, escapedTargetHost, escapedCode, pathEscapedCode, token)
}

func clearConsentCookie(w http.ResponseWriter, r *http.Request, code string) {
	http.SetCookie(w, &http.Cookie{Name: "nsfw_consent", Path: "/s/" + url.PathEscape(code) + "/continue", MaxAge: -1, HttpOnly: true, Secure: r.TLS != nil, SameSite: http.SameSiteStrictMode})
}
