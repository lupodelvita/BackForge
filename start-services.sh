#!/bin/sh
# BackForge — start all backend services inside the dev container
# Called by: ./dev.ps1 up

mkdir -p /tmp/bf

# Kill process listening on a given TCP port using /proc/net/tcp6
kill_port() {
  port=$1
  hex_port=$(printf '%04X' "$port")
  # Find inode listening on this port
  inode=$(awk -v p=":$hex_port " '$2 ~ p && $4 == "0A" {print $10}' /proc/net/tcp6 2>/dev/null | head -1)
  if [ -z "$inode" ]; then
    inode=$(awk -v p=":$hex_port " '$2 ~ p && $4 == "0A" {print $10}' /proc/net/tcp 2>/dev/null | head -1)
  fi
  if [ -n "$inode" ]; then
    # Find PID with this socket inode
    for proc in /proc/[0-9]*/fd/*; do
      if readlink "$proc" 2>/dev/null | grep -q "socket:\[$inode\]"; then
        pid=$(echo "$proc" | cut -d/ -f3)
        echo "  killing PID $pid on port $port"
        kill "$pid" 2>/dev/null
        break
      fi
    done
  fi
}

echo "Stopping any existing services on ports 8080-8085..."
for port in 8080 8081 8082 8083 8084 8085; do
  kill_port $port
done
sleep 2

echo "[1/5] api-gateway (port 8080)..."
cd /workspace/services/api-gateway
go build -o /tmp/bf-gateway . > /tmp/bf/build-gw.log 2>&1
if [ $? -eq 0 ]; then
  nohup /tmp/bf-gateway > /tmp/bf/gateway.log 2>&1 &
  echo "  started OK"
else
  echo "  BUILD FAILED — check /tmp/bf/build-gw.log"
fi

echo "[2/5] deployment (port 8082)..."
cd /workspace/services/deployment
go build -o /tmp/bf-deployment . > /tmp/bf/build-deploy.log 2>&1
if [ $? -eq 0 ]; then
  nohup /tmp/bf-deployment > /tmp/bf/deployment.log 2>&1 &
  echo "  started OK"
else
  echo "  BUILD FAILED — check /tmp/bf/build-deploy.log"
fi

echo "[3/5] sync-server (port 8083)..."
cd /workspace/services/sync-server
go build -o /tmp/bf-sync . > /tmp/bf/build-sync.log 2>&1
if [ $? -eq 0 ]; then
  nohup /tmp/bf-sync > /tmp/bf/sync.log 2>&1 &
  echo "  started OK"
else
  echo "  BUILD FAILED — check /tmp/bf/build-sync.log"
fi

echo "[4/5] code-generator (port 8084)..."
cd /workspace/services/code-generator
go build -o /tmp/bf-codegen . > /tmp/bf/build-codegen.log 2>&1
if [ $? -eq 0 ]; then
  nohup /tmp/bf-codegen > /tmp/bf/codegen.log 2>&1 &
  echo "  started OK"
else
  echo "  BUILD FAILED — check /tmp/bf/build-codegen.log"
fi

echo "[5/5] metrics (port 8085)..."
cd /workspace/services/metrics
go build -o /tmp/bf-metrics . > /tmp/bf/build-metrics.log 2>&1
if [ $? -eq 0 ]; then
  nohup /tmp/bf-metrics > /tmp/bf/metrics.log 2>&1 &
  echo "  started OK"
else
  echo "  BUILD FAILED — check /tmp/bf/build-metrics.log"
fi

if [ -d /workspace/services/frontend-analyzer/.venv ]; then
  echo "[+] analyzer (port 8081)..."
  cd /workspace/services/frontend-analyzer
  nohup sh -c '. .venv/bin/activate && uvicorn src.main:app --host 0.0.0.0 --port 8081' > /tmp/bf/analyzer.log 2>&1 &
  echo "  started OK"
fi

echo ""
echo "All services launched. Logs: /tmp/bf/*.log"
