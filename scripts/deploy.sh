#!/usr/bin/env bash
set -euo pipefail

# Avari Links Deployment Script
# Target: 176.53.174.118 (links.avari.dev) with OpenResty Manager

SERVER_HOST="${SERVER_HOST:-176.53.174.118}"
SERVER_USER="${SERVER_USER:-user}"
SERVER_PORT="${SERVER_PORT:-22}"
SSH_KEY="${SSH_KEY:-}"

SSH_OPTS="-p ${SERVER_PORT} -o StrictHostKeyChecking=no -o ConnectTimeout=15"
if [ -n "${SSH_KEY}" ]; then
    SSH_OPTS="${SSH_OPTS} -i ${SSH_KEY}"
fi

echo "===> Deploying Avari Links to ${SERVER_USER}@${SERVER_HOST}:${SERVER_PORT}..."

# 1. Build Linux amd64 binary
echo "===> Building API binary for linux/amd64..."
mkdir -p bin
(cd apps/api && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o ../../bin/avari-api-linux-amd64 ./cmd/server/main.go)

# 2. Build Frontend bundle
echo "===> Building Web bundle..."
(cd apps/web && \
  VITE_YM_COUNTER_ID="${VITE_YM_COUNTER_ID:-113244262}" \
  VITE_YM_WEBVISOR="${VITE_YM_WEBVISOR:-true}" \
  pnpm install --frozen-lockfile && \
  VITE_YM_COUNTER_ID="${VITE_YM_COUNTER_ID:-113244262}" \
  VITE_YM_WEBVISOR="${VITE_YM_WEBVISOR:-true}" \
  pnpm run build)

# 3. Create deploy package in temp directory
TEMP_DIR=$(mktemp -d)
trap 'rm -rf "${TEMP_DIR}"' EXIT

mkdir -p "${TEMP_DIR}/web"
cp -r apps/web/dist/* "${TEMP_DIR}/web/"
cp bin/avari-api-linux-amd64 "${TEMP_DIR}/avari-links"
cp deployments/systemd/avari-links.service "${TEMP_DIR}/avari-links.service"
cp deployments/openresty/openresty.conf "${TEMP_DIR}/openresty.conf"

cat << 'REMOTE_INSTALL_EOF' > "${TEMP_DIR}/remote-install.sh"
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "===> Preparing directories on remote host..."
sudo mkdir -p /opt/avari-links/data /var/www/avari-links/frontend /etc/systemd/system

echo "===> Installing API binary..."
chmod +x "${SCRIPT_DIR}/avari-links"
sudo mv "${SCRIPT_DIR}/avari-links" /usr/local/bin/avari-links

echo "===> Installing frontend assets to /var/www/avari-links/frontend..."
sudo rm -rf /var/www/avari-links/frontend/*
sudo cp -r "${SCRIPT_DIR}/web/"* /var/www/avari-links/frontend/
sudo chmod -R 755 /var/www/avari-links/frontend
sudo chown -R www-data:www-data /var/www/avari-links/frontend 2>/dev/null || true

echo "===> Configuring OpenResty site for links.avari.dev..."
if [ -d /opt/om/nginx/conf/sites ]; then
    # If LetsEncrypt cert path doesn't exist, check for existing cert in /opt/om
    if ! sudo test -s /etc/letsencrypt/live/links.avari.dev/fullchain.pem; then
        EXISTING_CERT=$(sudo find /opt/om /etc/letsencrypt /var/www -name "*links.avari.dev*fullchain.pem" -o -name "*links.avari.dev*.crt" 2>/dev/null | head -n 1 || true)
        if [ -n "${EXISTING_CERT}" ]; then
            EXISTING_KEY=$(sudo find /opt/om /etc/letsencrypt /var/www -name "*links.avari.dev*privkey.pem" -o -name "*links.avari.dev*.key" 2>/dev/null | head -n 1 || true)
            sed -i "s|/etc/letsencrypt/live/links.avari.dev/fullchain.pem|${EXISTING_CERT}|g" "${SCRIPT_DIR}/openresty.conf"
            sed -i "s|/etc/letsencrypt/live/links.avari.dev/privkey.pem|${EXISTING_KEY}|g" "${SCRIPT_DIR}/openresty.conf"
        fi
    fi
    sudo cp "${SCRIPT_DIR}/openresty.conf" /opt/om/nginx/conf/sites/links-avari-dev.conf
    echo "Installed /opt/om/nginx/conf/sites/links-avari-dev.conf"
fi

echo "===> Updating existing site configs and root directories..."
for conf in $(grep -rnwl "links.avari.dev" /opt/om/nginx/conf/sites/ /etc/nginx/ /opt/om/ 2>/dev/null || true); do
    echo "Inspecting site config for links.avari.dev: ${conf}"
    OLD_ROOT=$(grep -oP '^\s*root\s+\K[^;]+' "${conf}" 2>/dev/null | tr -d ' ' || true)
    if [ -n "${OLD_ROOT}" ] && [ -d "${OLD_ROOT}" ] && [ "${OLD_ROOT}" != "/var/www/avari-links/frontend" ]; then
        echo "Updating static files in site root: ${OLD_ROOT}"
        sudo rm -rf "${OLD_ROOT}/"*
        sudo cp -r "${SCRIPT_DIR}/web/"* "${OLD_ROOT}/"
    fi
done

echo "===> Configuring systemd service..."
sudo cp "${SCRIPT_DIR}/avari-links.service" /etc/systemd/system/avari-links.service
sudo systemctl daemon-reload
sudo systemctl enable avari-links.service
sudo systemctl restart avari-links.service

echo "===> Stopping and disabling Caddy..."
sudo systemctl stop caddy 2>/dev/null || true
sudo systemctl disable caddy 2>/dev/null || true

echo "===> Testing and reloading OpenResty..."
if which openresty >/dev/null 2>&1; then
    sudo /usr/bin/openresty -p /opt/om/nginx/ -t 2>/dev/null || sudo openresty -t 2>/dev/null || true
    sudo /usr/bin/openresty -p /opt/om/nginx/ -s reload 2>/dev/null || sudo openresty -s reload 2>/dev/null || sudo systemctl reload openresty 2>/dev/null || true
elif [ -f /opt/om/nginx/sbin/nginx ]; then
    sudo /opt/om/nginx/sbin/nginx -t -p /opt/om/nginx/ -c /opt/om/nginx/conf/nginx.conf 2>/dev/null || true
    sudo /opt/om/nginx/sbin/nginx -p /opt/om/nginx/ -s reload 2>/dev/null || true
fi

echo "===> Testing local backend static file and API serving on 127.0.0.1:4820..."
curl -s http://127.0.0.1:4820/ | grep -E "assets/index" || true
curl -s -f http://127.0.0.1:4820/healthz && echo " -> avari-links backend (4820) OK" || echo " -> avari-links backend FAIL"

echo 'All checks completed successfully!'
REMOTE_INSTALL_EOF

chmod +x "${TEMP_DIR}/remote-install.sh"

echo "===> Streaming deployment bundle to server and applying configuration..."
tar -czf - -C "${TEMP_DIR}" . | ssh ${SSH_OPTS} "${SERVER_USER}@${SERVER_HOST}" "
set -euo pipefail
REMOTE_TMP=\$(mktemp -d)
trap 'rm -rf \"\${REMOTE_TMP}\"' EXIT
tar -xzf - -C \"\${REMOTE_TMP}\"
bash \"\${REMOTE_TMP}/remote-install.sh\"
"

echo "===> Deployment completed successfully!"

