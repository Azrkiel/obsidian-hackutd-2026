#!/usr/bin/env bash
# Keep the tunnel to Nemotron open on the PC (localhost:8000 -> the Brev box's vLLM on port 8000).
# Run from Windows:  wsl -d Ubuntu -- bash -l /mnt/<drive>/<path to repo>/scripts/nemotron_tunnel.sh
# Leave the window open. Every 5 s it checks the tunnel and rebuilds it if it dropped. It uses plain ssh through
# Brev's relay with keepalives (a dead connection is noticed in about 30 s and rebuilt at once), which holds up
# better than `brev port-forward` on campus Wi-Fi. It also keeps WSL awake (Windows stops Ubuntu, and the tunnel
# with it, when nothing is running there).
export PATH="$HOME/.local/bin:$PATH"
INSTANCE="${1:-nomadsim-h100}"
up() { curl -s -m 3 -o /dev/null http://localhost:8000/v1/models; }
open_tunnel() {
  ssh -f -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=10 -o ServerAliveCountMax=3 \
      -o ConnectTimeout=20 -L 8000:127.0.0.1:8000 "$INSTANCE" >/dev/null 2>&1
}
while true; do
  if ! up; then
    echo "$(date +%T) tunnel down: rebuilding"
    pkill -f "L 8000:" 2>/dev/null
    open_tunnel || { brev refresh >/dev/null 2>&1; open_tunnel; }
    for _ in $(seq 1 10); do up && break; sleep 1; done
    up && echo "$(date +%T) tunnel up: Nemotron on localhost:8000" || echo "$(date +%T) still down, retrying"
  fi
  sleep 5
done
