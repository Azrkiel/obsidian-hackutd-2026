#!/usr/bin/env bash
# Brev startup recipe: Lambda H100 PCIe, 80 GB VRAM (one GPU).
# Name the instance nomadsim-h100 so the PC's tunnel commands stay the same.
# CLI alternative to the Brev console (preview the offer with --dry-run first):
#   brev create nomadsim-h100 --provider lambda --gpu-name H100 --min-vram 80 --min-disk 200 \
#     --startup-script @scripts/brev_vllm_startup.sh
# Lambda's selected offer has NO STOP/START. Delete the instance to end the rental;
# deletion removes the cached model and all other instance data. Do not use the idle-stop script.
# --restart unless-stopped restarts the container after a host reboot, not a deleted instance.
# Model downloads are cached in /home/ubuntu/workspace/hf for the life of the instance.
# Port 8000 is bound to 127.0.0.1 only: reach it with `brev port-forward`, not the internet.
# No NVIDIA_API_KEY or NEMOTRON_API_KEY is needed with this localhost-only recipe.
# H100 PCIe uses the same model and vLLM flags as the previous H100 SXM setup.
# Logs: docker logs -f vllm      Optional: put HF_TOKEN in /home/ubuntu/workspace/.hf_token
set -euo pipefail

IMAGE=vllm/vllm-openai:v0.28.0
MODEL=nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4
CACHE=/home/ubuntu/workspace/hf

log() { echo "[pitpal-startup] $*"; }

if ! command -v docker >/dev/null 2>&1; then
  log "docker not found; install it (curl -fsSL https://get.docker.com | sh) and the NVIDIA container toolkit, then rerun"
  exit 1
fi

mkdir -p "$CACHE"
TOKEN_ARGS=()
if [ -s /home/ubuntu/workspace/.hf_token ]; then
  TOKEN_ARGS=(-e "HF_TOKEN=$(cat /home/ubuntu/workspace/.hf_token)")
fi

if docker ps -a --format '{{.Names}}' | grep -qx vllm; then
  log "container vllm exists; starting it"
  docker start vllm
  exit 0
fi

log "pulling $IMAGE"
docker pull "$IMAGE"

log "starting vllm ($MODEL)"
docker run -d --name vllm --restart unless-stopped --gpus all --ipc=host \
  -p 127.0.0.1:8000:8000 \
  -v "$CACHE":/root/.cache/huggingface \
  "${TOKEN_ARGS[@]}" \
  "$IMAGE" \
  "$MODEL" \
  --served-model-name nemotron --host 0.0.0.0 --port 8000 \
  --quantization modelopt_fp4 --kv-cache-dtype fp8 \
  --max-model-len 32768 --max-num-seqs 8 --enable-prefix-caching \
  --mamba-backend flashinfer --mamba-cache-mode align \
  --moe-backend humming --linear-backend humming \
  --reasoning-parser nemotron_v3 --enable-auto-tool-choice --tool-call-parser qwen3_coder

log "started; follow with: docker logs -f vllm   (ready when it prints 'Application startup complete')"
