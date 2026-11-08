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
- `engine/voice.py`, `engine/nvidia_tts.py` - spoken coaching: Windows voice (or NVIDIA Magpie TTS), announcer rules
- `engine/analysis.py` - driving profile, micro-sector splits, run comparison (pure functions over a trace)
- `engine/agent_tools.py`, `engine/plan.py` - agent mode: read tools, plan actions, validation, session plan
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
| `ENGINE_PLAN_THINK_S`, `ENGINE_PLAN_TOTAL_S`, `ENGINE_EVAL_THINK_S`, `ENGINE_EVAL_TOTAL_S` | agent mode deadlines (12 / 15 / 8 / 10; lap mode caps every turn at 8 s) |
| `NVIDIA_TTS_VOICE`, `NVIDIA_TTS_FUNCTION_ID`, `NVIDIA_TTS_URL` | `--voice nvidia` (Magpie TTS Multilingual, uses `NVIDIA_API_KEY`) |

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

Pick a **stoppable** H100 offer (Nebius; `brev search gpu --gpu-name H100 --stoppable`). Lambda and Scaleway offers are "No stop/start" and can only be deleted. On the instance, set `HF_HOME=/home/ubuntu/workspace/hf` so the model download survives a stop.

#### Idle auto-stop

`scripts/brev_idle_stop.py` runs on your machine, reads vLLM's `/metrics` every minute, and runs `brev stop <instance>` after 30 idle minutes. It never deletes. While the box is stopped the engine falls back to build.nvidia.com.

```
NEMOTRON_BASE_URL=http://<brev-host>:8000/v1 uv run python scripts/brev_idle_stop.py --instance <name>
```

- Needs the brev CLI logged in where it runs (Brev supports Windows through WSL; `--brev-bin` points at another command).
- `--idle-min 30`, `--poll-s 60`; `--dry-run` logs instead of stopping.
- Judging: `touch .brev-hold` (or `--hold-until 11:30`) and it will not stop; delete the file after.
- After a stop: `brev start <name>`, restart vLLM, restart the watchdog.

## Coach program

One asyncio process on the Windows PC: telemetry reader, corner scorer, engine `Coach`, reset manager, live audio cue and the dashboard web server. With `--inputs` it is also the input receiver (phone + Arduino -> virtual Xbox 360 pad) and replaces `bridge/bridge.py`. Without `--inputs`, run `bridge/bridge.py` next to it as before. Never run both: they fight over UDP 5005, the COM port and the virtual pad.

```
coach/telemetry.py   Sample + ACSharedMemory (original AC), SimSource, ReplaySource, Recorder
coach/scorer.py      CornerScorer: samples -> runs -> engine Attempt + brake trace
coach/inputs.py      InputHub: phone UDP + Arduino serial/UDP -> one virtual pad; per-run input summary
coach/reset.py       ResetManager: 3-2-1 countdown, load request (udp/hotkey/manual/sim), telemetry confirmation, resume point
coach/app.py         CoachApp: wiring, commands, status
coach/dashboard.py   aiohttp: GET /, GET /ws (events out, commands in), GET /state
csp/nomadsim_reset/  CSP Lua app (draft, untested)
```

Run with the simulator (no game needed; click Accept on the dashboard):

```
uv run python -m coach --telemetry sim --reset sim
```

Run with Assetto Corsa (original AC, offline practice at Monza):

```
uv run python -m coach --telemetry ac --reset udp          # CSP Lua app does the load
uv run python -m coach --telemetry ac --reset hotkey       # presses F7 (load) / F6 (save) via SendInput
uv run python -m coach --telemetry ac --reset manual       # you press your own load key
```

With the coach as the input receiver (instead of `bridge/bridge.py`). The pad and serial packages stay out of the uv `.venv` (see `PC_SETUP.md`), so `--with` adds them for this run only:

```
uv run --with vgamepad --with pyserial python -m coach --telemetry ac --reset udp --inputs
```

### Inputs

| Input | Transport | Format |
| --- | --- | --- |
| Phone (Stealth Racing app) | UDP `--phone-port` (5005), IPv4 + IPv6, Bonjour if `dns-sd` exists | `v1,seq,steer,throttle,brake` ~100 Hz; `evt,id,command,tap/down/up` buttons; replies `ack,seq` every 30 |
| Arduino pedals | serial (`--arduino auto`, a COM port, or `off`) | `gas,brake` ints 0..1000 per line (`hardware/pedals/pedals.ino`) |
| Arduino pedals (wireless) | UDP `--arduino-udp-port` (off by default; e.g. 5006) | same `gas,brake` text, one reading per datagram |

- Steering always comes from the phone.
- Gas and brake come from the Arduino while it is fresh (under 200 ms old), otherwise from the phone's fallback pedals, otherwise 0.
- If the phone goes silent, steering centres and the phone's held buttons are released. If both go silent, the pad goes fully neutral.
- Phone buttons map to pad buttons in `BINDINGS` (`coach/inputs.py`): paddles are RB/LB.
- `--pad none` reads and mixes inputs without a virtual pad (default off Windows).
- `--invert-steer` flips steering.
- **Pairing:** with `--inputs` the coach prints a QR code (also on the dashboard, "Pair a phone"). The app scans it and connects with only "same Wi-Fi" as a requirement; after that every packet is signed, so only paired phones can drive. `--pairing optional|required|off` (default `optional`, which also accepts the current unpaired app). Protocol, test vectors and the app plan: `docs/PAIRING.md`.
- The receiver is off unless `--inputs` is given. If UDP 5005 is already taken (by `bridge/bridge.py` or `listen.py`), the coach stops with an error naming them.
- Phone coach buttons are events too. `evt,<id>,coach_next,tap` accepts the offered drill, or rewinds for a retry when nothing is offered. `evt,<id>,coach_resume,tap` ends the drill and loads the resume point. Both are ignored by `bridge/bridge.py`.

Each scored run carries an `inputs` summary into the evidence packet and the trace: which device drove the pedals, the phone-fallback share, link drops, and the gap between the pedal input and what the game reported. The dashboard's inputs badge shows the live pedal source.

**Input dropouts don't count.** A run is marked invalid before any coaching if the phone dropped out (`steering_dropout`: steering went to centre). It is also marked invalid if the Arduino dropped out, or the pedals were missing for more than 10% of the run (`pedal_dropout`: the game saw the pedals let go). Then every mode treats it like any other invalid run: a baseline is declined, a retry is "that lap did not count, same again". Both Nemotron prompts (normal and agent) say to blame the input, not the driver. Runs where the receiver never saw pedals or the phone (e.g. a real wheel) are left alone.

### Drill loop and resume

- Accepting a drill saves a **resume point** (where the car is now), then rewinds to the checkpoint.
- With `--auto-retry` (the default), each retry is scored and judged. If the coach offers the same drill again, the car rewinds automatically. The loop ends when the coach ends the drill (target hit, or no progress), or after `--max-retries` retries (default 5). The car is then loaded back at the resume point.
- In `--agent` mode, moving to the plan's next goal waits for Accept (or the phone's `coach_next`), so the new cue is heard before the car is rewound. Retries of the same goal loop on their own.
- Lap mode never rewinds, so none of this applies there.
- **Resume (end drill)** on the dashboard stops the loop at any time. It aborts a retry in progress and loads the resume point.
- Use `--no-auto-retry` to confirm each retry with Accept.
- Resume needs a second saved state, so it works with `--reset udp` (CSP app `SAVE resume` / `RESUME <id>`) and `--reset sim`. In hotkey and manual modes the drill just ends where the car is.

Dashboard: http://127.0.0.1:8020 (second screen; `--host 0.0.0.0` to open it on the LAN, `--port` to change; 8000 is the vLLM port-forward). Space/Enter = Accept.

Flow: drive the corner once, then **Save checkpoint** on the approach (a few hundred metres before the start gate, at speed), drive the baseline, accept the offered drill, the car is reset, the retry is scored and judged. **Set reference** makes the last valid run the reference (`data/reference.json` + `data/reference_trace.json`; default is `fixtures/reference.json`). Checkpoint is `data/checkpoint.json`. Other flags: `--corner`, `--reference`, `--record` (samples to `data/recordings/*.jsonl`, replay with `--telemetry replay FILE`), `--sound/--no-sound` (winsound cues, on by default on Windows), `--countdown N`, `--traces DIR`. The AI badge and engine env vars are the ones in the table above (`NEMOTRON_BASE_URL`, `NVIDIA_API_KEY`, ...); with none set the rules coach runs and the badge says so.

CSP reset app (draft): copy `csp/nomadsim_reset/` to `<assettocorsa>/apps/lua/nomadsim_reset/`, enable it in the in-game app list (needs Custom Shaders Patch with Lua apps). It listens on UDP 127.0.0.1:9101 (`SAVE` -> `SAVED x y z speed`, `RESET <id>` -> `ACK <id>`, plus the resume slot: `SAVE resume`, `RESUME <id>`). Offline practice only; loading a state invalidates the lap. Verify the `TODO(verify)` API calls in `nomadsim_reset.lua` first; if they fail use `--reset hotkey` with a key bound to your own save/load state.

Not tested without AC: the shared-memory struct offsets against a live game (layout copied from the CSP `sim_info.py`, parsing is unit-tested on fake buffers), the CSP Lua API calls, `SendInput` hotkeys, `winsound` playback, and the corner positions (placeholders until real laps are logged).

Corner positions in `fixtures/corner_monza_t1.json` are placeholders; replace after logging real laps.

### Whole lap: every error gets a retry (`--whole-lap`)

Plan and decisions: `docs/ROLLING_CHECKPOINTS.md`. Every corner of `--track` is scored; each error
gets a cue and a 5 s retry offer (dashboard Retry, or phone Next). Accepting rewinds to a state held
before that corner, runs the retry loop, then puts the car back where Retry was pressed.

```bash
# no game: the lap simulator, with planted mistakes per corner (per attempt, + separated)
uv run python -m coach --whole-lap --plant c1=late_brake,c4=spin+none,c6=slow_exit
# game PC: rolling checkpoints from the CSP Lua app (install csp/nomadsim_reset v0.2 first)
uv run python -m coach --whole-lap --telemetry ac --reset udp --inputs
```

- Settings (saved in `data/settings.json`, applied live): `GET/POST /settings`, with fields
  `reference` (`pb`|`ai`), `sensitivity_s`, `countdown_s`, `lead_time_s` and `voice`.
  `POST /personal_best/reset` clears the personal bests.
- `fixtures/tracks/monza.json` is **synthetic** until the real AI line is in:
  `uv run python scripts/ac_track_extract.py "<assettocorsa>/content/tracks/monza" --track-out fixtures/tracks/monza.json --names "Rettifilo,Curva Grande,Roggia,Lesmo 1,Lesmo 2,Ascari,Parabolica"`,
  then check the printed corner table. Personal bests from the synthetic track are not reused.
- Before the first in-game run (coach stopped):
  `uv run python scripts/checkpoint_probe.py --seconds 40 --hold-at 10 --restore-at 35`.
  It checks hold and restore in game and prints the frame cost of each save.

## Live voice coach and agent mode

Lap mode (the demo mode): keep driving, no Accept and no reset. After the corner exit the coach speaks one short sentence, says a reminder (at most 4 words) about 300 m before the braking zone on the next lap, beeps at the target, then gives a spoken verdict after the next exit.

```
uv run python -m coach --mode lap --telemetry sim                      # simulator, Windows voice
uv run python -m coach --mode lap --telemetry ac --voice windows       # in the game
uv run python -m coach --mode lap --agent --telemetry sim --brake-board 86 --release 0.15
```

- `--voice auto|windows|nvidia|silent|off` (default: auto in lap mode, off in drill mode); `--mute` or **M** mutes. `nvidia` falls back to the Windows voice per message.
- Voice rules: nothing is spoken inside the scored corner (start gate to exit gate); at least 5 s between messages; advice older than 10 s (reminders 3 s) is dropped, never played late. A turn slower than 8 s gets the rules coach's sentence instead.
- Spoken text is validated: cue and summary at most 12 words, reminder at most 4, every number from the evidence (or a tool result).
- `--agent`: Nemotron runs the session. After the baseline it may call read tools for up to 3 rounds (`get_driving_profile`, `get_splits`, `compare_runs`, `get_session_history`, `get_corner_info`), then `set_plan` with 1 to 3 goals. After each retry: `offer_drill` (repeat/adjust), `advance_plan` (met / skipped), `revise_plan` or `end_session`. The dashboard shows the checklist and every tool call. Without a model the rules coach builds the same kind of plan.
- Drills: `brake_point`, `brake_release` (new: seconds from peak brake to off, beep at turn-in), `throttle_pickup`.
- Simulator knobs: `--brake-board` (first-lap board), `--release` (first-lap release time; 0.15 triggers the release drill), `--lap-gap` (seconds between corner passes).
- **B** (or Mark board) logs the car position to `data/boards.json`: drive slowly past each brake board and press it (step 0).

Corner data from the game (step 0, untested on a real file):

```
uv run python scripts/ac_track_extract.py "<assettocorsa>/content/tracks/monza" --dump data/fast_lane.csv
uv run python scripts/ac_track_extract.py "<assettocorsa>/content/tracks/monza" --out fixtures/corner_monza_t1.json --ref-out fixtures/reference_ai.json
```

It prints a before/after diff of the corner keys it changes (gates, apex window, track length) before writing.

Speed test for agent turns (step 7, needs a live provider; `--fake` checks the script offline):

```
uv run python scripts/speed_agent.py --n 10 --provider brev --voice
```

Done when at least 9 of 10 turns of each kind end in a valid action within the budget (plan 15 s, evaluate 10 s).

Still unverified without the game: the new shared-memory fields (yaw-rate sign, g-forces, wheel slip units, so the lock-up/wheelspin thresholds), the reminder position on the real Monza line, and the extractor on Kunos' `fast_lane.ai`.
