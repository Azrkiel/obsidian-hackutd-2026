# NomadSim

One-corner practice coach for Assetto Corsa (HackUTD 2026).

Optional persistent race history: start with `--history`. See [HISTORY.md](HISTORY.md) for local storage, SpacetimeDB sync, the live leaderboard, coach memory, and iPhone setup.

## Race PC: one command (no hosting)

```
uv run python scripts/rig.py          # Assetto Corsa: shared memory, CSP reset (UDP 9101), phone/Arduino inputs
uv run python scripts/rig.py --sim    # same, with the simulated car
uv run python scripts/rig.py --lan    # phones on the same Wi-Fi can open the dashboard and the leaderboard
uv run python scripts/rig.py -- --agent --track fixtures/track_monza.json   # extra coach flags after --
```

Everything runs on the race PC. Nemotron coaching (`--agent`) and the spoken coach (`--voice nvidia`: NVIDIA Magpie TTS with an `NVIDIA_API_KEY`, else the Windows voice) are on by default; Nemotron needs `NEMOTRON_BASE_URL` (Brev/vLLM), `NVIDIA_API_KEY` or `OPENROUTER_API_KEY`, otherwise the rules coach answers and the dashboard says so. The dashboard (http://127.0.0.1:8020) shows live telemetry, the Nemotron coach, the Monza map and the brake chart, and its buttons control the game through the coach (rewind, retry, resume, checkpoint, mark board). Race history is saved in `data/history.sqlite3`. If the SpacetimeDB CLI is installed (`spacetime` on PATH or `SPACETIME_CLI`), the script also starts a local SpacetimeDB server on 127.0.0.1:3000 (data in `data/spacetime`), publishes the race-history module from `spacetime/prebuilt/` (no Node or npm needed) and gives the coach a writer identity kept in `data/spacetime_local.json`; the header then shows "Synced to SpacetimeDB". Keep `data/` between sessions. Ctrl+C stops the coach and the local server.

### Control the game from a laptop

The coach has to run on the PC that runs Assetto Corsa (it reads AC's shared memory and talks to the CSP reset app on 127.0.0.1:9101). A laptop on the same Wi-Fi only needs a browser:

1. On the game PC: install the CSP reset app (see "Coach program" below), start AC, then `uv run python scripts/rig.py --lan`. Allow Python through the Windows firewall when asked (dashboard port 8020, SpacetimeDB 3000).
2. The script prints the game PC's address, for example `dashboard: http://192.168.1.20:8020/`. Open it on the laptop. Every button there (Accept, Retry, Resume, Save checkpoint, Set reference, Mark board) controls the game through the coach, and the leaderboard is at `/history-viewer/`.
3. Phones on the same network can open the same address or scan the leaderboard's QR code.

`--lan` makes the dashboard reachable by anyone on that network, controls included: use it on a network you trust.

## Optional shared session history (multi-PC)

This is separate from `--history` above: it syncs to a SpacetimeDB module in `spacetime-cloud/` with per-PC enrollment, and its pages live at `/cloud-history-view`.

The coach can upload completed sessions, laps, scored attempts and coaching decisions to a
SpacetimeDB database in your account. The game PC keeps its local dashboard, Rev overlay and Brev
connection; cloud failures leave coaching running and pending uploads on disk.

Install the optional credential-store dependency, then follow [the SpacetimeDB setup runbook](docs/SPACETIMEDB.md)
to publish the database and register each PC:

```powershell
uv sync --system-certs --extra cloud
uv run --system-certs --extra cloud python scripts/spacetime_device.py setup --label game-pc
```

Setup stores a runtime token in Windows Credential Manager and prints public enrollment values.
An administrator must register that device before uploads or reads are allowed. An unconfigured
installation continues to run locally.

After enrolling a second PC as a viewer, run its history-only dashboard:

```powershell
uv run --system-certs --extra cloud python -m coach.cloud_viewer
```

Open `http://127.0.0.1:8020`. The viewer needs no game, controller bridge or Brev GPU connection.
The module source, tests, publication steps, per-device permissions and recovery procedures are
documented in [docs/SPACETIMEDB.md](docs/SPACETIMEDB.md).

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

Live spike (configure a Brev endpoint or a hosted provider key first):

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

Current recipe: **Lambda H100 PCIe, 80 GB VRAM, one GPU**, with the NVFP4 checkpoint
and `vllm/vllm-openai:v0.28.0`. The H100 PCIe uses the same inference flags as H100 SXM.
The selected Lambda offer has **no stop/start**. Save anything needed before deleting it;
deletion removes the instance and its cached model. Do not run the idle-stop watchdog on this offer.

In the Brev console, name the instance `nomadsim-h100`, select the Lambda H100 PCIe 80 GB offer,
and paste the contents of `scripts/brev_vllm_startup.sh` into the startup script field. The script
requires Docker and NVIDIA container support in the selected environment. It binds the API to
the server's localhost and does not require an NVIDIA Build or inference API key.

CLI alternative, from the repo root in WSL (the second command creates a paid instance):

```bash
brev create nomadsim-h100 --provider lambda --gpu-name H100 --min-vram 80 --min-disk 200 --startup-script @scripts/brev_vllm_startup.sh --dry-run
brev create nomadsim-h100 --provider lambda --gpu-name H100 --min-vram 80 --min-disk 200 --startup-script @scripts/brev_vllm_startup.sh
```

Once the instance is ready, repeat the log check until `Application startup complete`, then open
the tunnel and keep WSL open:

```bash
brev refresh
brev exec nomadsim-h100 "docker logs --tail 30 vllm"
brev port-forward nomadsim-h100 --port 8000:8000
```

In Windows PowerShell, from the repo root:

```powershell
curl.exe http://localhost:8000/v1/models
$env:NEMOTRON_BASE_URL = "http://localhost:8000/v1"
$env:NEMOTRON_BREV_MODEL = "nemotron"
$env:NEMOTRON_MAX_TOKENS_THINK = "3000"
$env:ENGINE_THINK_DEADLINE_S = "15"
$env:ENGINE_TOTAL_DEADLINE_S = "22"
uv run python scripts/spike_nemotron.py --provider brev --n 1
uv run python -m coach --track fixtures/track_monza.json --telemetry sim --no-retries --overlay --voice windows
```

The models endpoint must list `nemotron`; the spike should produce valid decisions. Stop the simulator
with Ctrl+C before launching the game coach. Without hosted keys, a Brev outage falls back to rules.
Lap mode still caps decisions at 8 s, live corner cues at 2 s, and Rev reactions at 1.6 s per provider.

For reference, a direct vLLM invocation (an explicit server API key is optional):

```
vllm serve nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4 \
  --served-model-name nemotron --host 127.0.0.1 --port 8000 \
  --quantization modelopt_fp4 --kv-cache-dtype fp8 \
  --max-model-len 32768 --max-num-seqs 8 --enable-prefix-caching \
  --mamba-backend flashinfer --mamba-cache-mode align \
  --moe-backend humming --linear-backend humming \
  --reasoning-parser nemotron_v3 --enable-auto-tool-choice --tool-call-parser qwen3_coder
```

Only set `NEMOTRON_API_KEY` if the server was explicitly started with `--api-key`.
vLLM has no hosted-style `reasoning_budget`; thinking length is bounded by the prompt, `max_tokens` and the ladder deadline.

When finished with the selected Lambda offer, save required files and delete `nomadsim-h100` in
the Brev console to end the rental. For a future setup requiring stop/start, choose an offer explicitly
marked stoppable; the idle-stop section below applies only to those offers.

#### Idle auto-stop

**Stoppable offers only; do not use on the selected Lambda offer.**

`scripts/brev_idle_stop.py` runs on your machine, reads vLLM's `/metrics` every minute, and runs `brev stop <instance>` after 30 idle minutes. It never deletes. While the box is stopped the engine falls back to the next configured provider, or to rules when no provider succeeds.

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

Single-corner mode uses `fixtures/corner_monza_t1_measured.json` by default: Monza T1 at its position measured from F1 data (start 520, apexes 875-955, exit 1060 m), with a simulator reference braking at the 100 m board (`scripts/make_t1_fixture.py`). `fixtures/corner_monza_t1.json` keeps the old placeholder gates for the unit tests. Check the boards in the game (press B) and press Set reference after a clean real lap.

### Whole lap: every error gets a retry (`--whole-lap`)

Plan and decisions: `docs/ROLLING_CHECKPOINTS.md`. Every corner of `--track` is scored; each error
gets a cue and a 5 s retry offer (dashboard Retry, or phone Next). Accepting rewinds to a state held
before that corner, runs the retry loop, then puts the car back where Retry was pressed.

**The demo runs both coaches together**: the lap coach's per-lap voice cue (above) plus a retry
offer for every error. Retries are judged by the error detector (fixed = the corner is clean),
the offer's cue is spoken first on the next straight, and its countdown starts when it's spoken.
The lap coach skips laps while a retry rewinds the car.

```bash
# no game: the lap coach's simulator (its demo knobs brake early at Roggia and Ascari)
uv run python -m coach --track fixtures/track_monza.json
# no game, planted mistakes per corner and attempt (+ separated): the retry simulator
uv run python -m coach --track fixtures/track_monza.json --plant t1=late_brake,lesmo1=spin+none
# game PC: rewinds through the CSP Lua app (install csp/nomadsim_reset v0.2 first)
uv run --with vgamepad --with pyserial python -m coach --track fixtures/track_monza.json --telemetry ac --inputs
# the lap coach alone, or the retry coach alone (think-mode drill loop per retry)
uv run python -m coach --track fixtures/track_monza.json --no-retries
uv run python -m coach --whole-lap --plant t1=late_brake
```

- Settings (saved in `data/settings.json`, applied live): `GET/POST /settings`, with fields
  `reference` (`pb`|`ai`), `sensitivity_s`, `countdown_s`, `lead_time_s` and `voice`.
  `POST /personal_best/reset` clears the personal bests.
- Corners come from the lap coach's `fixtures/track_monza.json` (F1-measured, 787B boards).
  `fixtures/tracks/monza.json` (the retry model: AI speed profile, Curva Grande for major errors)
  is built from it with `python scripts/track_model.py`; rebuild it after changing the config.
- Before the first in-game run (coach stopped):
  `uv run python scripts/checkpoint_probe.py --seconds 40 --hold-at 10 --restore-at 35`.
  It checks hold and restore in game and prints the frame cost of each save.

## Pit Pal overlay (Rev)

Rev, the Pit Pal mascot, sits over Assetto Corsa: pairing QR, live reactions, the coach's cues as short
bubbles. Add `--overlay` to the coach, or double-click `PitPal.bat`. Details: `docs/PITPAL_OVERLAY.md`.

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

## Drill registry and telemetry (D1–D12)

`engine/drills.py` defines all 13 drill types, their metric and target keys, units,
coaching priority, cue gate, reminders, and evidence prerequisites. Tool enums,
target schemas, model prompt drill descriptions, plan titles, and dashboard target
metadata derive from this registry. Corner JSON supplies permitted target ranges
and per-metric tolerances. The original three drills retain their board/apex marker
semantics; new targets use the metric's own units.

| Drill | Metric / target key | Live cue |
| --- | --- | --- |
| brake_bite | time_to_peak_s | Brake gate |
| no_coast | coast_s | Turn-in gate |
| apex_position | min_vs_apex_m | Target minimum-speed position relative to apex midpoint |
| trail_brake | trail_brake_share | Turn-in gate |
| throttle_roll_on | full_throttle_s | Second apex |
| lockup | lockup_s | Brake gate |
| min_speed | min_kmh | First apex |
| turn_in | turn_in_m | Target position |
| downshift | last_downshift_m | Target position |
| racing_line | line_offset_m | Turn-in gate |

All metrics flow from the driving profile into `Attempt`, evidence, agent session
history (`laps[].metrics`), run events, and dashboard rows. Old attempts and traces
remain supported: unavailable measurements stay absent/`None` and cannot produce a
drill or a successful retry. A measured reference is required for each metric;
use **Set reference** after a valid recorded run. The placeholder reference does
not contain evidence for every new drill.

`turn_in_m` is the first steering magnitude strictly above 0.05 at or after brake
onset. `last_downshift_m` is the last forward-gear reduction from brake onset to
the first apex; neutral blips are ignored. Gear uses -1 reverse, 0 neutral, and
1.. forward gears. Trace columns append gear, world x, and world z to the original
nine columns, preserving old column indices and old replay files.

Minimum-speed advice is offered only when minimum-speed position is already
within apex-position tolerance. No-coast, lockup, and racing-line goals penalize
excess; minimum speed penalizes a deficit. Improving past those targets still
counts as success. Other drills compare both sides of the reference target.

### O2 calibration and racing line

The fixture explicitly sets `telemetry_verified.steering`, `.slip`, and
`.coordinates` to false. Set these flags in a measured corner configuration only
after checking the corresponding live AC telemetry. `steering` gates trail braking;
`slip` gates throttle roll-on and lockup (verify wheelSlip units and the 0.15
thresholds in `engine/analysis.py`); `coordinates` gates racing-line advice (verify
world x/z axes, metres, and AI cumulative distance vs normalized lap position).
These real-game checks cannot be established by simulator tests.

Extract a real track without overwriting the fixtures:

```sh
uv run python scripts/ac_track_extract.py /path/to/track --out data/corner.json --ref-out data/ai_reference.json
uv run python -m coach --telemetry sim --reset sim --corner data/corner.json --reference data/ai_reference.json --voice off
```

The extractor preserves `racing_line` as `[track_metres, world_x, world_z]` points;
its bundled reference attempt and trace load directly into the coach. Racing-line
error is RMS distance to local AI line segments through the turn, constrained by
track progress to avoid nearby parallel sections. Missing coordinates, insufficient
line coverage, or invalid geometry produce no line metric. AI-derived reference
profiles cannot supply steering, slip, or gear evidence; record a real reference
for those drills. Synthetic telemetry supports development but does not validate
a real AC track's geometry or make the synthetic driver learn every drill.

## Whole-lap coaching

`--track` scores every corner of the lap and coaches the one or two corners that lose the most time. Lap mode only; drill mode (rewind per corner) stays single-corner with `--corner`.

```
uv run python -m coach --track fixtures/track_monza.json                    # track sim, rules coach
uv run python -m coach --track fixtures/track_monza.json --agent            # Nemotron plans across corners
uv run python -m coach --track fixtures/track_monza.json --telemetry ac     # in the game
uv run python -m coach --track fixtures/track_monza.json --sim-corner ascari:board_m=135 --sim-corner parabolica:release_s=0.15
```

- One decision per lap, started at the last corner's exit (Parabolica), so the cue plays on the main straight. Corners a few seconds apart (Lesmo 1 and 2) would get stale per-corner advice.
- The lap packet (`packet.lap`): last full lap time, `delta_s` (time lost in the scored corners vs the reference) and the top 3 corners by time lost that have a metric over tolerance, each with its worst metric, deltas and suggested targets. The rest of the packet is the full single-corner evidence for the corner being decided on, so the rules coach, validators and drills are unchanged.
- Plan goals are keyed by (corner, drill): the same drill may be planned at two corners, at most 3 goals, goal 1 = the corner losing the most time. Only the active goal is cued on a lap (one live cue, armed for the next lap). Read tools take `corner_id`; `get_lap_summary` gives every corner's time lost.
- Voice: quiet inside every corner (start gate to exit gate) and speech only inside the track's `talk_zones` (the straights; a zone may wrap the lap line).
- If the coached corner does not score on a lap (went off, data gap), the goal and its cue carry over.
- Set reference uses every valid corner of the last lap and writes `data/track_reference.json` (used on the next start).
- Dashboard: a Laps table (lap time, seconds lost per corner, the coached corner outlined); the metrics and trace show the coached corner. `GET /track` returns the corners, talk zones and recent laps.
- Sim: `--sim-corner ID:KEY=V[,KEY=V]` sets per-corner knobs (`board_m`, `release_s`, `apex_kmh`, `pickup_after_apex_m`); without it a demo set has three mistakes (Ascari 35 m and Roggia 25 m early, Parabolica snaps off the brake). The sim drives 787B minimum speeds and brake boards.

`fixtures/track_monza.json` positions are measured (W3): MultiViewer's official circuit line and corner markers plus the 20 fastest 2024/2025 Monza qualifying laps from OpenF1 (`scripts/monza_f1/`, numbers in `fixtures/monza_f1_corners.json`). Brake points for the car we drive come from Track Titan's Mazda 787B guide for AC Monza (1:43.2 lap): the 787B brakes 25 to 120 m earlier than F1 (T1 about 232 m before the apex, about the 215 m board) and every 787B brake point sits 67 to 186 m inside its start gate. Still to check in the game: the lap line, the board positions (press B at each board) and a clean 787B lap as the reference (Set reference). Or build the track from the AI line:

```
uv run python scripts/ac_track_extract.py "<assettocorsa>/content/tracks/monza" --track-out fixtures/track_monza.json --track-ref-out fixtures/track_monza_reference.json
```

`fixtures/track_monza_reference.json` comes from the track simulator driving 787B speeds and boards (99.2 s lap vs 103.2 s for the Track Titan 787B lap; `scripts/track_sim_reference.py`); it is only right for the sim. In the game, press Set reference after a clean lap.
