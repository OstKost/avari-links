#!/usr/bin/env bash
set -euo pipefail

# Avari Links Deployment Script
# Target: 157.22.252.225 (links.avari.dev)

SERVER_HOST="${SERVER_HOST:-157.22.252.225}"
SERVER_USER="${SERVER_USER:-root}"
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
(cd apps/web && pnpm run build)

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

# 1. Prepare directories
mkdir -p /opt/avari-links/data /var/www/avari-links/frontend /etc/systemd/system

# 2. Deploy binary
chmod +x \"\${REMOTE_TMP}/avari-links\"
mv \"\${REMOTE_TMP}/avari-links\" /usr/local/bin/avari-links

# 3. Deploy frontend static
rm -rf /var/www/avari-links/frontend/*
cp -r \"\${REMOTE_TMP}/web/\"* /var/www/avari-links/frontend/

# 4. Configure systemd
cp \"\${REMOTE_TMP}/avari-links.service\" /etc/systemd/system/avari-links.service
systemctl daemon-reload
systemctl enable avari-links.service
systemctl restart avari-links.service

# 5. Configure Caddy
if ! grep -q 'links.avari.dev' /etc/caddy/Caddyfile; then
    cat << 'CADDY_EOF' >> /etc/caddy/Caddyfile

# Avari Links (URL Shortener & Analytics)
links.avari.dev, http://links.avari.dev {
    handle /api/* {
        reverse_proxy localhost:4820
    }
    handle /s/* {
        reverse_proxy localhost:4820
    }
    handle /healthz {
        reverse_proxy localhost:4820
    }
    handle /swagger/* {
        reverse_proxy localhost:4820
    }
    handle {
        root * /var/www/avari-links/frontend
        try_files {path} /index.html
        file_server
    }
    encode gzip zstd
}
CADDY_EOF
    echo 'Added links.avari.dev configuration to Caddyfile'
fi

caddy reload --config /etc/caddy/Caddyfile

# 6. Verify service
sleep 2
systemctl is-active avari-links.service
curl -s -f http://127.0.0.1:4820/healthz
echo ''
echo 'Remote deployment successful!'
"

echo "===> Deployment completed successfully!"
