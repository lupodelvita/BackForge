# ── Build stage ──────────────────────────────────────────────────────────────
FROM golang:1.25-alpine AS builder

WORKDIR /app

COPY services/api-gateway/go.mod services/api-gateway/go.sum ./
RUN go mod download

COPY services/api-gateway/ .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o api-gateway .

# ── Run stage ─────────────────────────────────────────────────────────────────
FROM alpine:3.21

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app
COPY --from=builder /app/api-gateway .

EXPOSE 8080

CMD ["./api-gateway"]
