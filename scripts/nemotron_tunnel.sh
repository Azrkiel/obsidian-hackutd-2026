#!/usr/bin/env bash
# Keep the Brev tunnel to Nemotron open on the PC (localhost:8000 -> nomadsim-h100:8000).
# Run from Windows:  wsl -d Ubuntu -- bash -l /mnt/<drive>/<path to repo>/scripts/nemotron_tunnel.sh
# Leave the window open. It checks the tunnel every 10 s and re-opens it if it dropped, and it keeps
# WSL awake (Windows stops Ubuntu, and the tunnel with it, when nothing is running there).
export PATH="$HOME/.local/bin:$PATH"
INSTANCE="${1:-nomadsim-h100}"
up() { curl -s -m 3 -o /dev/null http://localhost:8000/v1/models; }
while true; do
  if ! up; then
    echo "$(date +%T) tunnel down: refreshing and re-opening"
    pkill -f "brev port-forward" 2>/dev/null
    pkill -f "ssh.*-L.*8000:" 2>/dev/null
    brev refresh >/dev/null 2>&1
    brev port-forward "$INSTANCE" -p 8000:8000 >/dev/null 2>&1 &
    for _ in $(seq 1 30); do up && break; sleep 2; done
    up && echo "$(date +%T) tunnel up: Nemotron on localhost:8000" || echo "$(date +%T) still down, retrying"
  fi
  sleep 10
done
