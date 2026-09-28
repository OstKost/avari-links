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
(cd apps/web && pnpm install --frozen-lockfile && pnpm run build)

# 3. Create deploy package in temp directory
TEMP_DIR=$(mktemp -d)
trap 'rm -rf "${TEMP_DIR}"' EXIT

mkdir -p "${TEMP_DIR}/web"
cp -r apps/web/dist/* "${TEMP_DIR}/web/"
cp bin/avari-api-linux-amd64 "${TEMP_DIR}/avari-links"
cp deployments/systemd/avari-links.service "${TEMP_DIR}/avari-links.service"

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

# If OpenResty Manager site has a separate root directory, copy assets there too
if [ -f /opt/om/nginx/conf/sites/3.conf ]; then
    SITE_ROOT=$(grep -oP '^\s*root\s+\K[^;]+' /opt/om/nginx/conf/sites/3.conf 2>/dev/null || true)
    if [ -n "${SITE_ROOT}" ] && [ "${SITE_ROOT}" != "/var/www/avari-links/frontend" ] && [ -d "${SITE_ROOT}" ]; then
        echo "===> Copying assets to OpenResty site root: ${SITE_ROOT}"
        sudo cp -r "${SCRIPT_DIR}/web/"* "${SITE_ROOT}/"
    fi
fi

echo "===> Configuring systemd service..."
sudo cp "${SCRIPT_DIR}/avari-links.service" /etc/systemd/system/avari-links.service
sudo systemctl daemon-reload
sudo systemctl enable avari-links.service
sudo systemctl restart avari-links.service

echo "===> Configuring OpenResty Manager upstream..."
if [ -d /opt/om/nginx/conf/upstreams ]; then
    echo 'upstream 6 {
server 127.0.0.1:4820;
keepalive 64;
}' | sudo tee /opt/om/nginx/conf/upstreams/6.conf > /dev/null

    if [ -f /opt/om/nginx/conf/sites/3.conf ]; then
        sudo sed -i "s|proxy_pass 'http://[0-9]*/';|proxy_pass 'http://6/';|g" /opt/om/nginx/conf/sites/3.conf
    fi
fi

echo "===> Purging OpenResty / Nginx CDN caches..."
sudo rm -rf /opt/om/nginx/cache/* /opt/om/nginx/proxy_cache/* /var/cache/nginx/* /tmp/om_cache/* /tmp/nginx_cache/* 2>/dev/null || true

echo "===> Reloading OpenResty / Nginx..."
sudo systemctl reload openresty 2>/dev/null || sudo systemctl restart openresty 2>/dev/null || \
sudo systemctl reload nginx 2>/dev/null || sudo systemctl restart nginx 2>/dev/null || \
sudo /usr/local/openresty/bin/openresty -s reload 2>/dev/null || \
sudo /opt/om/nginx/sbin/nginx -s reload 2>/dev/null || \
sudo /usr/local/openresty/nginx/sbin/nginx -s reload 2>/dev/null || true

echo "===> Verifying service health..."
sleep 2
sudo systemctl is-active avari-links.service
curl -s -f http://127.0.0.1:4820/healthz
echo ''
echo 'Remote deployment to 176.53.174.118 successful!'
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

