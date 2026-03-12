#!/usr/bin/env pwsh
# BackForge — запуск всех сервисов (запускать из корня проекта)
# Использование: .\start-dev.ps1

$LOG_DIR = "/tmp/backforge-logs"

Write-Host "==> Создаём папку для логов..."
docker compose exec dev bash -c "mkdir -p $LOG_DIR"

Write-Host "==> [1/3] API Gateway (Go)  :8080"
docker compose exec -d -w /workspace/services/api-gateway dev bash -c "go run . > $LOG_DIR/api-gateway.log 2>&1"

Write-Host "==> [2/3] Frontend Analyzer (Python)  :8081"
docker compose exec -d -w /workspace/services/frontend-analyzer dev bash -c "source .venv/bin/activate && uvicorn src.main:app --host 0.0.0.0 --port 8081 > $LOG_DIR/analyzer.log 2>&1"

Write-Host "==> [3/3] Visual Builder (Vite)  :5173"
docker compose exec -d -w /workspace/apps/builder dev bash -c "npm run dev > $LOG_DIR/builder.log 2>&1"

Write-Host ""
Write-Host "Ждём 10 сек пока сервисы поднимутся..."
Start-Sleep 10

Write-Host ""
Write-Host "=== Статус ==="
$gw   = docker compose exec dev curl -s http://localhost:8080/health 2>$null
$an   = docker compose exec dev curl -s http://localhost:8081/health 2>$null
$code = docker compose exec dev curl -s http://localhost:5173 -o /dev/null -w "%{http_code}" 2>$null

Write-Host "  API Gateway  : $(if ($gw   -match 'ok') { '✅ ok' } else { '❌ не ответил' })"
Write-Host "  Analyzer     : $(if ($an   -match 'ok') { '✅ ok' } else { '❌ не ответил' })"
Write-Host "  Builder      : $(if ($code -eq '200')   { '✅ ok' } else { "❌ HTTP $code"  })"

Write-Host ""
Write-Host "Логи внутри контейнера:"
Write-Host "  docker compose exec dev tail -f $LOG_DIR/api-gateway.log"
Write-Host "  docker compose exec dev tail -f $LOG_DIR/analyzer.log"
Write-Host "  docker compose exec dev tail -f $LOG_DIR/builder.log"
Write-Host ""
Write-Host "Открой в браузере: http://localhost:5173"
