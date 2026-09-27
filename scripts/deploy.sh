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

echo "===> Streaming deployment bundle to server and applying configuration..."
tar -czf - -C "${TEMP_DIR}" avari-links avari-links.service web | ssh ${SSH_OPTS} "${SERVER_USER}@${SERVER_HOST}" "
set -euo pipefail
REMOTE_TMP=\$(mktemp -d)
trap 'rm -rf \"\${REMOTE_TMP}\"' EXIT

# Extract payload
tar -xzf - -C \"\${REMOTE_TMP}\"

# 1. Prepare directories with sudo
sudo mkdir -p /opt/avari-links/data /var/www/avari-links/frontend /etc/systemd/system

# 2. Deploy binary
chmod +x \"\${REMOTE_TMP}/avari-links\"
sudo mv \"\${REMOTE_TMP}/avari-links\" /usr/local/bin/avari-links

# 3. Deploy frontend static
sudo rm -rf /var/www/avari-links/frontend/*
sudo cp -r \"\${REMOTE_TMP}/web/\"* /var/www/avari-links/frontend/

# 4. Configure systemd service
sudo cp \"\${REMOTE_TMP}/avari-links.service\" /etc/systemd/system/avari-links.service
sudo systemctl daemon-reload
sudo systemctl enable avari-links.service
sudo systemctl restart avari-links.service

# 5. Ensure OpenResty Manager upstream & site config
if [ -d /opt/om/nginx/conf/upstreams ]; then
    echo 'upstream 6 {
server 127.0.0.1:4820;
keepalive 64;
}' | sudo tee /opt/om/nginx/conf/upstreams/6.conf > /dev/null

    if [ -f /opt/om/nginx/conf/sites/3.conf ]; then
        sudo sed -i 's|proxy_pass '\''http://[0-9]*/'\'';|proxy_pass '\''http://6/'\'';|g' /opt/om/nginx/conf/sites/3.conf
    fi

    if which openresty >/dev/null 2>&1; then
        sudo openresty -t -p /opt/om/nginx -c /opt/om/nginx/conf/nginx.conf && sudo openresty -p /opt/om/nginx -s reload || true
    fi
fi

# 6. Verify service
sleep 2
sudo systemctl is-active avari-links.service
curl -s -f http://127.0.0.1:4820/healthz
echo ''
echo 'Remote deployment to 176.53.174.118 successful!'
"

echo "===> Deployment completed successfully!"

