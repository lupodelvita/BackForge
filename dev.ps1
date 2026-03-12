# dev.ps1 — запуск команд внутри dev-контейнера
# Использование:
#   .\dev.ps1 cargo test --workspace
#   .\dev.ps1 go build ./...
#   .\dev.ps1 bash                    # открыть shell в контейнере

param(
    [Parameter(ValueFromRemainingArguments)]
    [string[]]$Command
)

if (-not $Command) {
    # Без аргументов — открыть интерактивный bash
    docker compose exec dev bash
    exit
}

docker compose exec dev @Command
