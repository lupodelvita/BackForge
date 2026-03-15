# BackForge universal dev helper
#
# Usage:
#   .\dev.ps1                          interactive launcher
#   .\dev.ps1 up                       choose processes to start
#   .\dev.ps1 up all                   start everything at once
#   .\dev.ps1 up site                  start only Vite frontend
#   .\dev.ps1 up docker backend        start Docker + backend
#   .\dev.ps1 down                     choose processes to stop
#   .\dev.ps1 down all                 stop everything
#   .\dev.ps1 restart                  choose processes to restart
#   .\dev.ps1 status                   show all service statuses
#   .\dev.ps1 logs [svc]               tail a backend service log
#   .\dev.ps1 exec cmd                 run command inside dev container

param(
    [Parameter(Position=0)] [string]$Verb = "",
    [Parameter(ValueFromRemainingArguments)] [string[]]$Targets = @()
)

Set-StrictMode -Off
$ErrorActionPreference = "Continue"
$script:Root = $PSScriptRoot

# -------- Helpers -----------------------------------------------------------

function Test-Port([int]$port) {
    $tcp = New-Object System.Net.Sockets.TcpClient
    try   { $tcp.Connect("127.0.0.1", $port); return $true  }
    catch { return $false }
    finally { $tcp.Close() }
}

function Clear-Port([int]$port) {
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn) {
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}

function Write-Ok([string]$msg)   { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Err([string]$msg)  { Write-Host "  [!!] $msg" -ForegroundColor Red }
function Write-Step([string]$msg) { Write-Host "  --> $msg"  -ForegroundColor Cyan }

# -------- Status display ----------------------------------------------------

function Show-Status {
    Write-Host ""
    Write-Host "  Service           Port   Status" -ForegroundColor Yellow
    Write-Host "  ----------------------------------------" -ForegroundColor DarkGray

    $dockerUp = ((docker compose ps --quiet 2>$null) -join "").Trim() -ne ""
    $sym = if ($dockerUp) { "[+]" } else { "[ ]" }
    $col = if ($dockerUp) { "Green" } else { "DarkYellow" }
    Write-Host ("  {0}  docker                  Docker containers" -f $sym) -ForegroundColor $col

    $services = @(
        [pscustomobject]@{Name="gateway   "; Port=8080},
        [pscustomobject]@{Name="analyzer  "; Port=8081},
        [pscustomobject]@{Name="deployment"; Port=8082},
        [pscustomobject]@{Name="sync      "; Port=8083},
        [pscustomobject]@{Name="codegen   "; Port=8084},
        [pscustomobject]@{Name="metrics   "; Port=8085}
    )
    foreach ($s in $services) {
        $ok  = Test-Port $s.Port
        $sym = if ($ok) { "[+]" } else { "[ ]" }
        $col = if ($ok) { "Green" } else { "DarkYellow" }
        Write-Host ("  {0}  {1}  :{2}" -f $sym, $s.Name, $s.Port) -ForegroundColor $col
    }

    $siteOk = Test-Port 3000
    $sym = if ($siteOk) { "[+]" } else { "[ ]" }
    $col = if ($siteOk) { "Green" } else { "DarkYellow" }
    Write-Host ("  {0}  site          :3000   Vite dev server" -f $sym) -ForegroundColor $col
    Write-Host ""
}

# -------- Interactive selection ---------------------------------------------

function Select-Procs([string]$action) {
    Write-Host ""
    Write-Host ("  Select processes to {0}:" -f $action) -ForegroundColor Cyan
    Write-Host "    [1]  docker   -- Docker compose (postgres, redis, dev container)" -ForegroundColor White
    Write-Host "    [2]  backend  -- Go services (ports 8080-8085)" -ForegroundColor White
    Write-Host "    [3]  site     -- Vite frontend (port 3000)" -ForegroundColor White
    Write-Host "    [a]  all      -- all of the above" -ForegroundColor White
    Write-Host ""
    $raw = Read-Host "  Choice (e.g: 1 / 2 3 / 1,3 / a)"
    return Resolve-Targets ($raw -split '[,\s]+')
}

function Resolve-Targets([string[]]$raw) {
    if (-not $raw -or $raw.Count -eq 0) { return @("docker","backend","site") }
    $clean = $raw | Where-Object { $_ -ne "" }
    if ("all" -in $clean -or "a" -in $clean) { return @("docker","backend","site") }
    $out = @()
    foreach ($r in $clean) {
        switch ($r.ToLower()) {
            "1"        { $out += "docker"  }
            "docker"   { $out += "docker"  }
            "2"        { $out += "backend" }
            "backend"  { $out += "backend" }
            "services" { $out += "backend" }
            "3"        { $out += "site"    }
            "site"     { $out += "site"    }
            "frontend" { $out += "site"    }
            "vite"     { $out += "site"    }
        }
    }
    if ($out.Count -eq 0) { return @("docker","backend","site") }
    return $out | Select-Object -Unique
}

# -------- Start functions ---------------------------------------------------

function Start-DockerCompose {
    Write-Step "docker compose up -d"
    docker compose up -d
    if ($LASTEXITCODE -ne 0) { Write-Err "docker compose failed"; return $false }
    Write-Ok "Docker containers up"
    return $true
}

function Start-BackendServices {
    Write-Step "Building and launching backend Go services..."
    $sh = Join-Path $script:Root "start-services.sh"
    docker cp $sh backforge-dev:/tmp/start-services.sh | Out-Null
    docker compose exec dev bash -c "sed -i 's/\r//' /tmp/start-services.sh && chmod +x /tmp/start-services.sh && bash /tmp/start-services.sh"
    Write-Ok "Backend services launched"
    return $true
}

function Start-SiteServer {
    Write-Step "Starting Vite dev server in a new window..."
    Clear-Port 3000
    $siteDir = Join-Path $script:Root "site"
    $proc = Start-Process powershell `
        -ArgumentList @("-NoProfile", "-NoExit", "-Command", "npm run dev") `
        -WorkingDirectory $siteDir `
        -PassThru
    $proc.Id | Set-Content (Join-Path $script:Root ".site.pid") -Encoding UTF8
    Write-Ok ("Site started (PID {0}) -> http://localhost:3000" -f $proc.Id)
    return $true
}

# -------- Stop functions ----------------------------------------------------

function Stop-DockerCompose {
    Write-Step "docker compose down"
    docker compose down
    Write-Ok "Docker containers stopped"
}

function Stop-BackendServices {
    Write-Step "Killing backend services (8080-8085)..."
    docker compose exec dev bash -c "pkill -f 'bf-' 2>/dev/null; true" | Out-Null
    Write-Ok "Backend services stopped"
}

function Stop-SiteServer {
    Write-Step "Stopping Vite dev server..."
    $pidFile = Join-Path $script:Root ".site.pid"
    if (Test-Path $pidFile) {
        $savedPid = Get-Content $pidFile -ErrorAction SilentlyContinue
        if ($savedPid) { Stop-Process -Id ([int]$savedPid) -Force -ErrorAction SilentlyContinue }
        Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    }
    Clear-Port 3000
    Write-Ok "Site stopped"
}

# -------- Orchestration -----------------------------------------------------

function Invoke-Up([string[]]$procs) {
    Write-Host ""
    Write-Host ("=== Starting: {0} ===" -f ($procs -join ", ")) -ForegroundColor Yellow
    if ("docker"  -in $procs) { if (-not (Start-DockerCompose))   { return }; Start-Sleep 3 }
    if ("backend" -in $procs) { Start-BackendServices | Out-Null;  Start-Sleep 8 }
    if ("site"    -in $procs) { Start-SiteServer      | Out-Null;  Start-Sleep 4 }
    Show-Status
}

function Invoke-Down([string[]]$procs) {
    Write-Host ""
    Write-Host ("=== Stopping: {0} ===" -f ($procs -join ", ")) -ForegroundColor Yellow
    if ("site"    -in $procs) { Stop-SiteServer }
    if ("backend" -in $procs) { Stop-BackendServices }
    if ("docker"  -in $procs) { Stop-DockerCompose }
    Show-Status
}

function Invoke-Restart([string[]]$procs) {
    Write-Host ""
    Write-Host ("=== Restarting: {0} ===" -f ($procs -join ", ")) -ForegroundColor Yellow
    if ("site"    -in $procs) { Stop-SiteServer;       Start-Sleep 1; Start-SiteServer      | Out-Null }
    if ("backend" -in $procs) { Stop-BackendServices;  Start-Sleep 2; Start-BackendServices | Out-Null; Start-Sleep 8 }
    if ("docker"  -in $procs) { Stop-DockerCompose;    Start-Sleep 2; Start-DockerCompose   | Out-Null; Start-Sleep 3 }
    Show-Status
}

# -------- Main dispatch -----------------------------------------------------

switch ($Verb.ToLower()) {

    "" {
        Write-Host ""
        Write-Host "  +======================================+" -ForegroundColor Cyan
        Write-Host "  |    BackForge Dev Environment         |" -ForegroundColor Cyan
        Write-Host "  +======================================+" -ForegroundColor Cyan
        Show-Status
        Write-Host "  [u]  up       start processes"    -ForegroundColor White
        Write-Host "  [d]  down     stop processes"     -ForegroundColor White
        Write-Host "  [r]  restart  restart processes"  -ForegroundColor White
        Write-Host "  [s]  status   refresh status"     -ForegroundColor White
        Write-Host "  [l]  logs     tail a service log" -ForegroundColor White
        Write-Host "  [q]  quit"                        -ForegroundColor DarkGray
        Write-Host ""
        $choice = Read-Host "  Action"
        switch ($choice.ToLower().Trim()) {
            "u" { $p = Select-Procs "start";   Invoke-Up      $p }
            "d" { $p = Select-Procs "stop";    Invoke-Down    $p }
            "r" { $p = Select-Procs "restart"; Invoke-Restart $p }
            "s" { Show-Status }
            "l" {
                $svc = Read-Host "  Service (gateway / deployment / sync / codegen / metrics / analyzer)"
                & $PSCommandPath logs $svc
            }
            default { Write-Host "  Bye!" -ForegroundColor DarkGray }
        }
    }

    "up" {
        $procs = if ($Targets.Count -gt 0) { Resolve-Targets $Targets } else { Select-Procs "start" }
        Invoke-Up $procs
    }

    "down" {
        $procs = if ($Targets.Count -gt 0) { Resolve-Targets $Targets } else { Select-Procs "stop" }
        Invoke-Down $procs
    }

    "restart" {
        $procs = if ($Targets.Count -gt 0) { Resolve-Targets $Targets } else { Select-Procs "restart" }
        Invoke-Restart $procs
    }

    "status" { Show-Status }

    "logs" {
        $svc = if ($Targets.Count -gt 0) { $Targets[0] } else { "gateway" }
        $fileMap = @{
            gateway    = "/tmp/bf/gateway.log"
            analyzer   = "/tmp/bf/analyzer.log"
            deployment = "/tmp/bf/deployment.log"
            deploy     = "/tmp/bf/deployment.log"
            sync       = "/tmp/bf/sync.log"
            codegen    = "/tmp/bf/codegen.log"
            metrics    = "/tmp/bf/metrics.log"
        }
        $file = if ($fileMap.ContainsKey($svc)) { $fileMap[$svc] } else { "/tmp/bf/gateway.log" }
        Write-Host ("==> Tailing {0}  (Ctrl+C to stop)" -f $file) -ForegroundColor Cyan
        docker compose exec dev tail -f $file
    }

    "exec" {
        if ($Targets.Count -gt 0) { docker compose exec dev @Targets }
        else { docker compose exec dev bash }
    }

    default {
        docker compose exec dev $Verb @Targets
    }
}
