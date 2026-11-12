# Pit Pal: game PC setup

Assetto Corsa (AC) runs on one Windows PC, so everything that talks to the game runs there:
the coach, the input receiver (phone + Arduino pedals), the CSP reset app and Rev, the overlay.

## Requirements
- Windows 11, Assetto Corsa 1.16+ with Custom Shaders Patch 0.2.11+ (Lua apps), launched from Content Manager.
- `uv` for the coach and engine. The repo `.venv` is owned by uv: `uv sync` removes anything not in
  `pyproject.toml`, so never `pip install` into it. The pad and serial packages (`vgamepad`, `pyserial`)
  stay out of `.venv` and are added per run with `uv run --with vgamepad --with pyserial ...`.
- ViGEmBus (virtual Xbox 360 pad).
- A Windows Firewall rule allowing inbound UDP 5005 (phone packets).
- The only folder Pit Pal installs inside AC is `apps\lua\nomadsim_reset` (copied from `csp/nomadsim_reset/`).
  Nothing else in the AC install, Content Manager or CSP is changed.
- COM ports used by Bluetooth are not the Arduino; the receiver auto-detects the Arduino by VID / description.

## Ports
| Port | Who | What |
|---|---|---|
| UDP 5005 | phone -> `coach --inputs` (or `devices/bridge/bridge.py`) | `v1,seq,steer,throttle,brake` (steer -1..1, others 0..1); `evt,id,command,phase` buttons (coach only) |
| UDP 127.0.0.1:9101 | coach -> CSP app | `SAVE` -> `SAVED x y z kmh`; `RESET <id>` -> `ACK <id>` / `ERR <reason>` |
| TCP 8020 | coach | dashboard `http://127.0.0.1:8020` (`/`, `/state`, `/ws`) |
| TCP 8000 | Brev tunnel | Nemotron (vLLM, OpenAI-compatible) at `http://localhost:8000/v1`, model name `nemotron` |

## Nemotron
- Model: `nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4`, served as `nemotron` by vLLM `v0.28.0`
  (`scripts/brev_vllm_startup.sh`) on a Brev H100 80 GB instance, reached through a localhost tunnel.
- Provider order in the engine: brev -> nvidia (hosted, `NVIDIA_API_KEY`) -> openrouter -> deterministic rules.
- **Required settings on Brev/vLLM** (vLLM has no hosted-style reasoning budget; with the default 900 tokens
  the model can run out mid-reasoning before it makes a tool call):
  ```
  NEMOTRON_BASE_URL=http://localhost:8000/v1
  NEMOTRON_MAX_TOKENS_THINK=3000
  ENGINE_THINK_DEADLINE_S=15
  ENGINE_TOTAL_DEADLINE_S=22
  ```
- Results with these settings: all 5 baseline fixtures got the correct decision from Nemotron itself
  (late_brake -> brake_point, early_throttle -> throttle_pickup, clean -> no coaching,
  invalid -> invalid_run, not_comparable -> declined). Think mode takes 4-10 s per decision; fast mode < 1 s.

## How to run
1. **Tunnel** (Brev CLI runs in WSL; Windows stops WSL when no window uses it, which closes the tunnel):
   - PowerShell window 1, leave open: `wsl ~`
   - PowerShell window 2: `wsl -d Ubuntu -- bash -lc "brev port-forward nomadsim-h100 -p 8000:8000"`
     (or `scripts/nemotron_tunnel.sh`, which reconnects if it drops)
   - Check: `curl.exe http://localhost:8000/v1/models` lists `nemotron`
2. **AC**: Content Manager -> Practice -> drive. AC pauses when it loses focus or in the Esc menu;
   the dashboard then shows telemetry `paused` / `no data`. Click back into AC.
3. **Pit Pal**: double-click `PitPal.bat` (coach + receiver + Rev). Or by hand, from the repo folder:
   ```powershell
   $env:NEMOTRON_BASE_URL = "http://localhost:8000/v1"
   $env:NEMOTRON_MAX_TOKENS_THINK = "3000"
   $env:ENGINE_THINK_DEADLINE_S = "15"
   $env:ENGINE_TOTAL_DEADLINE_S = "22"
   uv run --with vgamepad --with pyserial python -m coach --telemetry ac --reset udp --inputs --track fixtures/track_monza.json --overlay
   ```
   Open `http://127.0.0.1:8020` (second screen). It should say "Nemotron · ready".
   No game: `--telemetry sim --reset sim`. Reset fallbacks: `--reset manual` or `--reset hotkey`.
4. **Inputs**: with `--inputs` the coach is the receiver; do not also start `devices/bridge/bridge.py`
   (two receivers fight over UDP 5005 and create two virtual pads). When the Arduino drops, the phone's
   on-screen pedals take over; a run with a dropout is marked invalid and not coached.
   `devices/bridge/bridge.py` remains as a standalone receiver without the coach.
5. **Brev lifecycle** (WSL):
   - Create from the repo root (starts a paid rental; preview first with `--dry-run`):
     `brev create nomadsim-h100 --provider lambda --gpu-name H100 --min-vram 80 --min-disk 200 --startup-script @scripts/brev_vllm_startup.sh`
     then repeat `brev exec nomadsim-h100 "docker logs --tail 5 vllm"` until `Application startup complete`.
   - Offers without stop/start keep billing while the instance runs. On a stoppable offer,
     `scripts/brev_idle_stop.py` stops it after 30 idle minutes.
   - To end the rental, save required files first, then delete the instance in the Brev console.
     Deletion removes all instance data; recreating it downloads the model again.

## Known issues
- **AC can crash on exit** (heap corruption `0xc0000374` in ntdll, after `CLEAN EXIT` in `log.txt`). It happens
  after the Lua app has released its socket, so it points at AC/CSP/overlays loaded into acs.exe, not the app.
  Driving and resets are unaffected. Do not quit AC mid-session. If Content Manager says
  "waiting to end the race", stop the leftover process:
  `Get-Process acs -ErrorAction SilentlyContinue | Stop-Process -Force`.
- Start the coach after AC is on track: opening `Local\acpmf_physics` before AC creates it gives an empty mapping.
- `tests/test_ladder.py::test_total_deadline_rules` is timing-sensitive under heavy load.
- The tunnel drops when WSL shuts down (see "How to run").
