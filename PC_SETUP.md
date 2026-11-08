# NomadSim: game PC setup and handoff (for teammates and their Claude Code)

Assetto Corsa (AC) only runs on Dhanush's Windows PC, so everything that talks to the game runs there.
This file describes that machine, how the pieces connect, what was changed and tested on
branch `pc-bridge`, and the rules for not breaking the machine.
Last updated: Sun Nov 8 2026, ~00:30 CT.

## TL;DR for a Claude Code session working on this repo
- Do not change anything inside the AC install, Content Manager or CSP. The only folder we own there is
  `apps\lua\nomadsim_reset` (copied from `csp/nomadsim_reset/`).
- Two separate Python environments. Never mix them:
  - repo `.venv` is owned by uv (coach + engine). `uv sync` deletes anything not in `pyproject.toml`.
  - `D:\bridge-venv` holds the bridge deps (`pyserial`, `vgamepad`). Never pip-install into `.venv`.
- C: is nearly full. Put caches, venvs and downloads on D:.
- Brev commands run in WSL Ubuntu, not PowerShell. Creating the H100 bills Kevin's org (~$5.40/hr): ask first.
- Do not touch the Swift/iOS app. Do not draw or reproduce the mascot (Poyo); wait for the team's art.
- The user commits and pushes themselves (GitHub Desktop). Do not commit, and do not add Claude
  co-author trailers.

## Branches
| Branch | Contents |
|---|---|
| `main` | README only |
| `feat/thinking-engine` (Kevin) | engine (Nemotron ladder), coach (telemetry, scorer, reset, dashboard), CSP reset app, Brev scripts, tests |
| `feat/hardware-pedals` (Will) | `hardware/pedals/pedals.ino` (2x HC-SR04 gas+brake, prints `gas,brake` 0..1000) and `hardware/bridge.py` |
| `pc-bridge` (Dhanush) | = `feat/thinking-engine` + PC bridge + CSP reset-app crash fix + Nemotron validator fixes + this file. **Merge into `feat/thinking-engine`.** |

Merge notes:
- `pc-bridge` only adds `bridge/` and `PC_SETUP.md` and edits `csp/nomadsim_reset/nomadsim_reset.lua`,
  `engine/tools.py`, `tests/test_tools.py` and `tests/test_ladder.py`. It should merge cleanly into `feat/thinking-engine`.
- `feat/hardware-pedals` adds `hardware/`. `bridge/bridge.py` (pc-bridge) already reads Will's `gas,brake` format,
  so keep both folders, but **run only one bridge at a time**. Two bridges create two virtual Xbox pads.

## For the iOS teammate (pushing and merging the tilt-wheel app)
1. Push the Xcode project on its **own branch** off `feat/thinking-engine`, e.g. `feat/ios-app`, in its own
   top-level folder (e.g. `ios/`). Do not edit `bridge/`, `coach/`, `engine/` or `csp/` in that branch, so it
   merges without conflicts. Add an `ios/.gitignore` for `xcuserdata/`, `DerivedData/`, `*.xcuserstate`, `build/`.
2. Open a PR `feat/ios-app` -> `feat/thinking-engine` **after** `pc-bridge` has been merged there.
3. What the app must send (already implemented in `bridge/bridge.py`, do not change without telling Dhanush):
   - UDP to `<game PC IP>:5005`, ~60-100 Hz, ASCII: `v1,<seq>,<steer>,<throttle>,<brake>`
     - `seq`: integer, increments every packet (the bridge drops old/out-of-order packets)
     - `steer` -1.0 (full left) .. 1.0 (full right); `throttle`, `brake` 0.0 .. 1.0
     - example: `v1,1042,-0.250,0.800,0.000`
   - If no packet arrives for 200 ms, the bridge centres steering and zeroes the pedals.
   - With Arduino pedals connected, gas/brake come from the pedals and the phone only steers.
4. Planned next (not built yet; agree before implementing): a **reset / next-action button** sent as a
   separate packet on the same port, `c1,<seq>,next`. The bridge will forward it to the coach, which does
   "accept" when a drill is offered and "reset for retry" otherwise. Send it once per tap (not repeated).
5. Networking at the venue: venue Wi-Fi blocks device-to-device traffic. Use the iPhone **Personal Hotspot**,
   connect the PC to it, get the PC's IP with `ipconfig` (IPv4 of the hotspot adapter), enter it in the app.
   Test on the PC with `D:\bridge-venv\Scripts\python.exe bridge\bridge.py --no-arduino --debug` and
   look for `phone True` and moving `steer` values.

## The machine
| What | Where |
|---|---|
| OS | Windows 11, user `batcomputer\dhanush koyi` (profile `C:\Users\nivas`) |
| Repo | `D:\D-Downloads\obsidian-hackutd-2026` |
| AC root (note the space) | `D:\Documents\GTA 5\steamapps\common\assettocorsa`; AC 1.16.4, CSP 0.2.11 |
| CSP Lua apps | `<AC root>\apps\lua\` (ours: `nomadsim_reset`) |
| CSP Lua SDK (ground truth for API names) | `<AC root>\extension\internal\lua-sdk\ac_apps\lib.lua` |
| AC logs | `C:\Users\nivas\Documents\Assetto Corsa\logs\` (`log.txt`, `custom_shaders_patch.log`) |
| Content Manager | `D:\Tools\ContentManager\Content Manager.exe`. Always launch AC from it. CM logs: `%LOCALAPPDATA%\AcTools Content Manager\Logs` |
| Python | 3.12 at `D:\Python312` |
| Coach/engine env | repo `.venv` (uv); `uv` 0.13.7; `UV_CACHE_DIR=D:\uvcache`, `UV_PYTHON_INSTALL_DIR=D:\uvpython` |
| Bridge env | `D:\bridge-venv` (pyserial 3.5, vgamepad); deps in `bridge/requirements.txt` |
| pip cache | `PIP_CACHE_DIR=D:\pipcache` |
| WSL | Ubuntu (moved to `D:\WSL\Ubuntu`), Linux user `cryptoleum`, Brev CLI 0.6.337 in `~/.local/bin`, logged into org `jiang.kevin28-08d502-5yum`. Repo path in WSL: `/mnt/d/D-Downloads/obsidian-hackutd-2026` |
| Drivers | ViGEmBus installed (virtual Xbox 360 pad works). Firewall rule "NomadSim UDP" allows port 5005 |
| COM ports | COM3 and COM5 are **Bluetooth**, not the Arduino. The bridge auto-detects the Arduino by VID / description |

## Ports
| Port | Who | What |
|---|---|---|
| UDP 5005 | phone -> bridge | `v1,seq,steer,throttle,brake` (steer -1..1, others 0..1) |
| UDP 127.0.0.1:9101 | coach -> CSP app | `SAVE` -> `SAVED x y z kmh`; `RESET <id>` -> `ACK <id>` / `ERR <reason>` |
| TCP 8020 | coach | dashboard `http://127.0.0.1:8020` (`/`, `/state`, `/ws`) |
| TCP 8000 | Brev tunnel | Nemotron (vLLM, OpenAI-compatible) at `http://localhost:8000/v1`, model name `nemotron` |

## Nemotron (NVIDIA track: record this)
- Model: `nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4`, served as `nemotron` by vLLM `v0.28.0`
  (`scripts/brev_vllm_startup.sh`) on a Brev H100 (`nomadsim-h100`, `gpu-h100-sxm.1gpu-16vcpu-200gb`).
- Provider order in the engine: brev -> nvidia (hosted, `NVIDIA_API_KEY`) -> openrouter -> deterministic rules.
- **Required settings on Brev/vLLM** (vLLM has no reasoning budget; with the default 900 tokens the model
  ran out mid-reasoning and never produced a tool call):
  ```
  NEMOTRON_BASE_URL=http://localhost:8000/v1
  NEMOTRON_MAX_TOKENS_THINK=3000
  ENGINE_THINK_DEADLINE_S=15
  ENGINE_TOTAL_DEADLINE_S=22
  ```
- Live results with these settings and the validator fix: all 5 baseline fixtures got the correct decision
  from Nemotron itself (late_brake -> brake_point, early_throttle -> throttle_pickup, clean -> no coaching,
  invalid -> invalid_run, not_comparable -> declined). Think mode takes 4-10 s per decision; fast mode < 1 s.

## How to run (on the game PC)
1. **Tunnel** (WSL must stay alive; Windows stops Ubuntu when no window uses it, which kills the tunnel):
   - PowerShell window 1, leave open: `wsl ~`
   - PowerShell window 2: `wsl -d Ubuntu -- bash -lc "brev port-forward nomadsim-h100 -p 8000:8000"`
     (prints "waiting for SSH..." and returns: that is normal, the tunnel keeps running in the background)
   - Check: `curl.exe http://localhost:8000/v1/models` lists `nemotron`
2. **AC**: Content Manager -> Practice, Monza, Mazda MX-5 -> drive. AC pauses when it loses focus/Esc menu;
   the dashboard then shows telemetry `paused` / `no data`. Click back into AC.
3. **Coach** (normal, non-admin PowerShell):
   ```powershell
   cd D:\D-Downloads\obsidian-hackutd-2026
   $env:NEMOTRON_BASE_URL = "http://localhost:8000/v1"
   $env:NEMOTRON_MAX_TOKENS_THINK = "3000"
   $env:ENGINE_THINK_DEADLINE_S = "15"
   $env:ENGINE_TOTAL_DEADLINE_S = "22"
   uv run python -m coach --telemetry ac --reset udp
   ```
   Open `http://127.0.0.1:8020` (second screen). It should say "Nemotron · ready". Save checkpoint on the
   T1 approach at speed -> drive baseline -> Accept -> 3-2-1 -> car resets -> retry.
   No game: `--telemetry sim --reset sim`. Reset fallbacks: `--reset manual` or `--reset hotkey`.
4. **Bridge** (only when driving with phone/pedals):
   `D:\bridge-venv\Scripts\python.exe bridge\bridge.py --debug` (auto-detects Arduino) or `--no-arduino --debug`.
   Pedals silent > 200 ms or unplugged -> gas/brake 0 and prints `INVALID` (not yet reported to the coach).
5. **Brev lifecycle** (WSL). Status as of Sun 00:45 CT: `nomadsim-h100` was **deleted** (no billing).
   - Recreate (~10-15 min, re-downloads the 18 GB model):
     `cd /mnt/d/D-Downloads/obsidian-hackutd-2026 && brev create nomadsim-h100 --type gpu-h100-sxm.1gpu-16vcpu-200gb --min-disk 200 --startup-script @scripts/brev_vllm_startup.sh`
     then repeat `brev exec nomadsim-h100 "docker logs --tail 5 vllm"` until `Application startup complete`.
   - Short breaks: `brev stop nomadsim-h100` / `brev start nomadsim-h100` (keeps the model, restarts in
     minutes, but storage still bills while stopped).
   - **End of hackathon: `brev delete nomadsim-h100`.**
   - Before judging: create `.brev-hold` in the repo so `scripts/brev_idle_stop.py` cannot stop the box.

## What was changed on `pc-bridge` and why
1. `bridge/bridge.py` (new): phone UDP + Arduino serial -> one virtual Xbox 360 pad (vgamepad/ViGEmBus).
   Steering from phone; gas/brake from pedals when fresh, from phone with `--no-arduino`. Reads Will's
   `gas,brake` (0..1000) and the older `B,<mm>,<valid>` format. Failsafe: neutral + INVALID when pedals drop.
2. `csp/nomadsim_reset/nomadsim_reset.lua`: verified against the CSP 0.2.11 SDK and tested in AC.
   - socket opened under `pcall`, closed in `ac.onRelease` (log: `NomadSim: socket closed on release`)
   - `ac.saveCarStateAsync` callback is `(err, data)`: the draft stored the error string and later passed
     it to `ac.loadCarState`; fixed
   - checks `ac.loadCarState`'s boolean return (`ERR notallowed` outside offline single-car practice)
   - `ac.log('NomadSim: ...')` at each stage; grep `custom_shaders_patch.log` for `NomadSim:`
3. `engine/tools.py` validator (+ tests): Nemotron's answers were being thrown away or wrong.
   - stray `verdict` on a baseline offer is dropped instead of rejecting the whole offer
   - target keys valid for the other drill (e.g. `peak_brake` on `throttle_pickup`) are dropped
   - `end_drill no_coaching_needed` rejected when a baseline delta is over tolerance
   - `offer_drill` on a baseline rejected when that drill's delta is inside tolerance
     (same mapping as `rules.rule_decide`), so the ladder repairs or falls back to rules
   - tests: 67 passed (`tests/test_tools.py`, `test_ladder.py`, `test_rules.py`, `test_nemotron.py`,
     `test_state.py`, `test_coach_app.py`, `test_evidence.py`)

## Known issues
- **AC crashes on exit** (heap corruption `0xc0000374` in ntdll, after `CLEAN EXIT` in `log.txt`). It happens
  after our Lua app has released its socket, so it looks like AC/CSP/overlays (NVIDIA overlay, Steam overlay
  are loaded into acs.exe), not our app. Driving and resets are unaffected. Demo rule: do not quit AC
  mid-demo. If Content Manager says "waiting to end the race", kill the leftover process:
  `Get-Process acs -ErrorAction SilentlyContinue | Stop-Process -Force`.
- `tests/test_telemetry.py::test_ac_source_errors_cleanly_off_windows_or_without_ac` hangs on Windows when
  AC is not running: opening `Local\acpmf_physics` with `mmap` creates an empty mapping instead of failing,
  so the source waits forever. Start the coach after AC is on track.
- `tests/test_ladder.py::test_total_deadline_rules` is timing-sensitive (flaky: failed once, passed after).
- The tunnel drops when WSL shuts down (see "How to run").
- Decisions take 4-10 s in think mode (user finds this slow).
- Pedal failsafe `INVALID` is printed by the bridge but not sent to the coach yet.

## Next up (agreed, not started)
1. **Phone reset/next-action button**: waiting for teammate B to merge the iOS app. Proposed protocol so the
   Swift side does not change the existing packet: a separate UDP packet to the bridge on 5005,
   `c1,<seq>,next`; the bridge forwards it to the coach, which does "accept" when a drill is offered and
   "reset for retry" otherwise.
2. **Mascot overlay**: transparent always-on-top Python (tkinter) window over AC (AC in borderless
   windowed), polling `http://127.0.0.1:8020/state`, showing Nemotron's cue as a speech bubble, the countdown
   and a "thinking" state. Placeholder image until the Poyo art exists (`mascot.png`).
3. **One-command start** `start.ps1`: start the tunnel hidden and keep WSL alive, check `/v1/models`, set the
   Nemotron env vars, start coach (+ overlay, + `-Bridge`), open the dashboard.
4. **Faster decisions**: measure fast-first vs think-first on the fixtures now that the validator rejects
   wrong answers; pick whichever is both correct and quick.
