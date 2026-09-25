# Build Stage
FROM golang:1.24-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git ca-certificates tzdata

COPY go.mod go.sum ./
RUN GOSUMDB=off go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/bin/server ./cmd/server/main.go

# Production Runtime Stage
FROM alpine:3.21

WORKDIR /app

RUN apk --no-cache add ca-certificates tzdata curl && \
    addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/bin/server /app/server

RUN mkdir -p /app/data && chown -R appuser:appgroup /app

USER appuser

ENV PORT=4820 \
    ENVIRONMENT=production \
    DB_PATH=/app/data/shortener.db

EXPOSE 4820

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:4820/healthz || exit 1

ENTRYPOINT ["/app/server"]
