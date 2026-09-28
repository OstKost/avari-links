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

echo "===> Searching for all OpenResty site configs and roots..."
# Find all configs for links.avari.dev
for conf in $(grep -rnwl "links.avari.dev" /opt/om/nginx/conf/ /etc/nginx/ /opt/om/ 2>/dev/null || true); do
    echo "Found site config: ${conf}"
    # Read root directory if present
    SITE_ROOT=$(grep -oP '^\s*root\s+\K[^;]+' "${conf}" 2>/dev/null | tr -d ' ' || true)
    if [ -n "${SITE_ROOT}" ] && [ -d "${SITE_ROOT}" ]; then
        echo "Updating OpenResty site root: ${SITE_ROOT}"
        sudo rm -rf "${SITE_ROOT}/"*
        sudo cp -r "${SCRIPT_DIR}/web/"* "${SITE_ROOT}/"
    fi
    # Point upstream to 6 (port 4820)
    sudo sed -i "s|proxy_pass 'http://[0-9]*/';|proxy_pass 'http://6/';|g" "${conf}" 2>/dev/null || true
done

echo "===> Searching for old bundles across filesystem..."
sudo find / -name "index-BfaES30I.js" 2>/dev/null | while read -r old_file; do
    BUNDLE_DIR="$(dirname "$(dirname "$old_file")")"
    echo "Found old bundle at ${old_file}, syncing ${BUNDLE_DIR}..."
    sudo cp -r "${SCRIPT_DIR}/web/"* "${BUNDLE_DIR}/"
done

# Check Docker containers
if which docker >/dev/null 2>&1; then
    echo "===> Checking Docker containers on host:"
    sudo docker ps --format "table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}" || true
    for cid in $(sudo docker ps -q); do
        cname=$(sudo docker inspect --format '{{.Name}}' "$cid" 2>/dev/null || true)
        echo "Inspecting container: ${cname}"
        # Copy web assets into container if it has /var/www or /opt/om or nginx html
        sudo docker cp "${SCRIPT_DIR}/web/." "${cid}:/var/www/avari-links/frontend/" 2>/dev/null || true
        sudo docker cp "${SCRIPT_DIR}/web/." "${cid}:/opt/om/sites/3/html/" 2>/dev/null || true
        # Reload nginx in container if possible
        sudo docker exec "$cid" openresty -s reload 2>/dev/null || sudo docker exec "$cid" nginx -s reload 2>/dev/null || true
    done
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
fi

echo "===> Testing local backend static file serving on 127.0.0.1:4820..."
curl -s http://127.0.0.1:4820/ | grep -E "assets/index" || true

echo "===> Inspecting OpenResty / Nginx setup on host..."
sudo ps aux | grep -E 'nginx|openresty|om' | grep -v grep || true

echo "===> Checking listening ports on host (80, 443, 4820)..."
sudo ss -tulpn | grep -E ':80 |:443 |:4820 ' || true

echo "===> Inspecting OpenResty / Nginx site configs..."
for f in $(sudo find /opt/om /etc/nginx /usr/local/openresty -name "*.conf" 2>/dev/null | grep -E 'sites|conf\.d|vhost'); do
    echo "--- File: $f ---"
    sudo cat "$f" || true
done

echo "===> Testing localhost OpenResty proxy on HTTP (port 80) and HTTPS (port 443):"
curl -s -H "Host: links.avari.dev" http://127.0.0.1/ | grep -E "assets/index" || true
curl -s -k -H "Host: links.avari.dev" https://127.0.0.1/ | grep -E "assets/index" || true

echo "===> Testing direct public IP port 443 response:"
curl -s -k -H "Host: links.avari.dev" https://176.53.174.118/ | grep -E "assets/index" || true

echo "===> Verifying service health..."
sleep 2
sudo systemctl is-active avari-links.service
curl -s -f http://127.0.0.1:4820/healthz
echo ''
echo "===> Testing localhost OpenResty proxy output:"
curl -s -k -H "Host: links.avari.dev" https://127.0.0.1/ 2>/dev/null | grep -E "assets/index" || curl -s -H "Host: links.avari.dev" http://127.0.0.1/ 2>/dev/null | grep -E "assets/index" || true
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

