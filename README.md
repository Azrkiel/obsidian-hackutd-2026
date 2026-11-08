# NomadSim

One-corner practice coach for Assetto Corsa (HackUTD 2026).

## Thinking engine

Nemotron reads a scored attempt's metrics and picks one coaching action; the car is reset and the retry is scored.
This package is the engine only. The game, telemetry reader, input bridge and dashboard integrate through injected callables.

Layout:

- `engine/models.py`, `config.py` - dataclasses, corner/attempt loaders
- `engine/evidence.py` - `build_packet(...)` evidence packet
- `engine/tools.py` - tool schemas + `validate(call, packet)`
- `engine/rules.py` - `rule_decide(packet)` deterministic fallback
- `engine/nemotron.py` - NVIDIA / OpenRouter clients (think/fast, streaming, json transport)
- `engine/ladder.py` - `decide()` deadlines, fallback ladder, circuit breaker, `warm_up()`
- `engine/state.py` - `Coach` state machine
- `engine/trace.py` - JSONL decision traces (`traces/<session>.jsonl`)
- `engine/live_cue.py` - live audio cues during retries (no LLM)
- `fixtures/` - placeholder Monza T1 corner, reference lap, sample attempts
- `scripts/spike_nemotron.py` - live API latency/reliability spike

Setup and tests (needs `--system-certs` behind TLS interception):

```
uv sync --system-certs
uv run pytest -q
```

Demo (falls back to rules without keys):

```
uv run python -m engine.demo fixtures/attempts/late_brake.json
uv run python -m engine.demo fixtures/attempts/late_brake.json --retry fixtures/attempts/retry_close.json
```

Live spike (needs `NVIDIA_API_KEY`; run once keys exist):

```
uv run python scripts/spike_nemotron.py --n 5
```

Env vars:

| Var | Purpose |
| --- | --- |
| `NEMOTRON_BASE_URL` | self-hosted vLLM on Brev, e.g. `http://<brev-host>:8000/v1`; tried first when set |
| `NEMOTRON_API_KEY` | the `--api-key` the vLLM server was started with (optional) |
| `NVIDIA_API_KEY`, `OPENROUTER_API_KEY` | hosted provider keys (provider skipped if unset) |
| `NEMOTRON_BREV_MODEL`, `NEMOTRON_MODEL`, `NEMOTRON_OPENROUTER_MODEL` | model ids (brev default `nemotron`) |
| `NEMOTRON_REASONING_BUDGET`, `NEMOTRON_MAX_TOKENS_THINK`, `NEMOTRON_MAX_TOKENS_FAST` | budgets (512 / 900 / 200) |
| `NEMOTRON_TRANSPORT` | `tools` (default) or `json` |
| `ENGINE_THINK_DEADLINE_S`, `ENGINE_FAST_DEADLINE_S`, `ENGINE_TOTAL_DEADLINE_S` | deadlines (6 / 4 / 10) |

### Self-hosting on Brev

One H100 80GB, NVFP4 checkpoint, vLLM >= 0.27.1 (`vllm/vllm-openai:v0.28.0`):

```
vllm serve nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4 \
  --served-model-name nemotron --port 8000 --api-key $ENGINE_KEY \
  --quantization modelopt_fp4 --kv-cache-dtype fp8 \
  --max-model-len 32768 --max-num-seqs 8 --enable-prefix-caching \
  --mamba-backend flashinfer --mamba-cache-mode align \
  --moe-backend humming --linear-backend humming \
  --reasoning-parser nemotron_v3 --enable-auto-tool-choice --tool-call-parser qwen3_coder
```

Then on the PC: `NEMOTRON_BASE_URL=http://<brev-host>:8000/v1 NEMOTRON_API_KEY=$ENGINE_KEY uv run python scripts/spike_nemotron.py --provider brev`.
vLLM has no hosted-style `reasoning_budget`; thinking length is bounded by the prompt, `max_tokens` and the ladder deadline.

Corner positions in `fixtures/corner_monza_t1.json` are placeholders; replace after logging real laps.
