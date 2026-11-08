# Whole-lap coaching and retry offers: context for agents

Read this before touching the coach. It describes `main` @ `57b2d33` (2026-11-08), after:

- **PR #7** (Kevin Jiang, `feat/whole-lap`): the **lap coach**.
- **PR #8** (Keven Diaz, `feat/rolling-checkpoints`): **retry offers**, rolling checkpoints and QR
  pairing, merged with #7.

Design history and every decision with its reason: `docs/ROLLING_CHECKPOINTS.md`. Pairing protocol:
`docs/PAIRING.md`. Usage: `README.md`. Game PC: `PC_SETUP.md`.

## The game mechanic (what the driver experiences)

The demo runs **two coaches at once** on Monza. Command: `python -m coach --track fixtures/track_monza.json`.

1. **Lap coach (#7).** It scores every corner of every lap. Once per lap, at Parabolica's exit, it
   speaks one cue about the corner that lost the most time vs the reference. It speaks only inside
   **talk zones** (the straights); every corner is a quiet zone. It never moves the car. The next lap
   is the retry, and the plan advances goal by goal.
2. **Retry offers (#8).**
   - **Error:** any error in any corner (7 corners, incl. Curva Grande for major errors only) raises
     an **event**.
   - **Cue and offer:** the event gets a short cue (spoken first on the next straight) and a **5 s offer**.
     The countdown starts when the cue starts playing, not when the error happens.
   - **Accept:** the driver opts in with **Next on the phone** or Retry on the dashboard. The coach
     saves where the car is (resume point), counts 3-2-1 and **rewinds** to a state held before that
     corner (~4 s before its brake point).
   - **Retries:** the driver retries until the corner is clean or 5 tries, then the car is **put back
     where Retry was pressed**.
   - **While a retry runs:** errors elsewhere are ignored, and the lap coach skips that lap.
   - **Missed offers:** they stay retryable from a history for ~60 s (up to 5); a newer error
     replaces the open offer.

Other launch modes:

| Command | Runs |
| --- | --- |
| `--track fixtures/track_monza.json` | both (the demo). `--telemetry ac` → rewinds via the CSP Lua app (`--reset udp`); `--telemetry sim` → simulator teleports |
| `--track … --no-retries` | lap coach only |
| `--track … --plant t1=late_brake,lesmo1=spin+none` | both, driven by the retry simulator (`LapSim`) with planted mistakes |
| `--whole-lap [--plant …]` | retry coach only, but each retry is judged by the coach's think-mode drill loop (the combined mode uses the error detector) |
| no `--track` / `--whole-lap` | the original single-corner drill / lap / agent modes (`--corner`) |

## Architecture

```
AC shared memory ─► Sample (coach/telemetry.py; incl. tyres_out = numberOfTyresOut)
        │  every sample goes to both:
        ├──► coach/scorer.py TrackScorer (#7) ── one CornerScorer per corner ──► engine/track_coach.py
        │        corner runs; at the last corner's exit: on_lap()            TrackCoach (lap coach):
        │        lap time at the line ("track_lap")                          lap packet → ladder → cue
        │
        └──► coach/lap_coach.py LapCoach (#8) ── coach/corner_pass.py PassScorer ──► CornerPass
                 │  coach/events.py EventDetector (vs coach/reference.py References: PB or AI line)
                 │  coach/events.py CheckpointPicker ──HOLD──► coach/checkpoints.py CheckpointStore
                 │  coach/offers.py OfferManager (waiting_cue → open → accepted/expired/superseded)
                 │  cue: engine/ladder.decide(event packet, 2 s live budget) → Announcer (OFFER kind)
                 │  phone: InputHub.send_phone("ofr,…" / "ofx,…")
                 └─ accept: ResetManager (SAVE resume, 3-2-1, RESTORE held, telemetry confirm)
                            → detector-judged retries → RESUME → retry_finished
```

`coach/app.py` `CoachApp` owns everything.

| Attribute | Holds |
| --- | --- |
| `track` | #7's track config (`engine.models.Track`) |
| `coach` | `TrackCoach` with `--track`, else the single-corner `Coach` |
| `track_model` | #8's model (`coach.track.Track`) |
| `lap_coach` | `LapCoach`, `None` with `--no-retries` |
| `references` | personal bests and the AI line (`coach.reference.References`) |
| `store` | `CheckpointStore` (udp reset only) |
| `settings` | `SettingsStore` |

`LapCoach.standalone` is True when `app.track` is set (combined mode). Then it never touches
`app.coach`: it calls the ladder itself and judges retries with the detector. With `--whole-lap`
alone, it uses `app.select_corner(id)` and today's `Coach` drill loop instead.

## Two track files (keep them in sync)

| File | Owner | Contents |
| --- | --- | --- |
| `fixtures/track_monza.json` | lap coach | **Source of truth.** 6 corners (`t1`, `roggia`, `lesmo1`, `lesmo2`, `ascari`, `parabolica`). Gates are **measured from F1 data** (MultiViewer line + 20 OpenF1 laps). Also: 787B brake points (`_787b`, Track Titan guide), talk zones, shared defaults, per-corner `reference` |
| `fixtures/track_monza_reference.json` | lap coach | sim-generated per-corner reference attempts and traces |
| `fixtures/tracks/monza.json` | retry offers | **Generated** by `python scripts/track_model.py`. Same ids and gates, plus `curva_grande` (flat; F1 T3 marker, 1459 m), brake points, apexes, AI metrics, and a 10 m speed/gas/brake profile from #7's 787B simulator lap |

- **Rebuilding:** after editing `track_monza.json`, run `python scripts/track_model.py`.
  `tests/test_track.py::test_committed_track_matches_the_lap_coach_config` fails until you do.
- **Real AI line:** once `fast_lane.ai` is copied from the game PC, `scripts/ac_track_extract.py`
  writes both formats: `--track-out` (#7 config) and `--model-out` (#8 model).
- **Positions:** metres along the lap from the AC lap line. Lap length is 5793 m (AC Monza).

## Key modules from #8

| Module | What it does |
| --- | --- |
| `coach/track.py` | `Track` (model), `TrackCorner` (`kind` brake/flat, `key_m` = brake point or turn-in). Methods: `anchor_m(corner, lead_s)`, `anchor_splines()` (Lua CFG), `ai_time`, `pos_before`, `corner_at`, `corner_config(corner, base)` → `CornerConfig` |
| `coach/corner_pass.py` | `PassScorer` → `CornerPass`. Data problems (gap, pause, teleport) make the pass `valid=False`. Driving faults stay valid with facts: `tyres_out_s`, `max_body_slip_deg`, `went_backwards`, `peak_slip_f/r`. Spin uses integrated yaw vs path direction, sign auto-selected. `attempt` comes from running `CornerScorer` |
| `coach/events.py` | `EventDetector` + `Thresholds`. **Major:** wheels off >0.3 s, spin >90°, lock-up/wheelspin slip >0.3, apex speed −25%. **Minor:** time lost > sensitivity (0.25 s), brake ±15 m. Flat corners are major only. `CheckpointPicker`: this lap's anchor → buffer save ≥ lead time before the key point → oldest stable save → none. In sim mode, `for_sim()` |
| `coach/offers.py` | `OfferManager`: one current offer plus a bounded history; returns offers whose holds can be dropped |
| `coach/lap_coach.py` | orchestration, cues, voice hand-off (`on_voice`), phone pushes, accept, retry judging, the think-mode analysis at opt-in (`offer_analysis`) |
| `coach/reference.py` | personal best per corner (`data/personal_best.json`, keyed by track name + length, **normal laps only**), AI line fallback, `reset()`. Mode `pb` (default) or `ai` |
| `coach/checkpoints.py` | the coach side of the Lua rolling buffer (see protocol below) |
| `coach/settings.py` | `reference`, `sensitivity_s` 0.1–0.5, `countdown_s` 3–10, `lead_time_s` 3–6, `voice`. Saved in `data/settings.json`, which **wins over CLI defaults**; applied live |
| `coach/lap_sim.py` | `LapSim`: drives the model's profile with consistent x/z/yaw. Mistakes planted per corner and attempt: `early_brake`, `late_brake`, `run_wide`, `slow_exit`, `lockup`, `spin`. Has `teleport_to` |
| `coach/pairing.py`, `coach/qrcodegen.py` | QR pairing, HMAC-signed phone packets (`docs/PAIRING.md`) |
| `scripts/checkpoint_probe.py` | game PC check of HOLD/RESTORE and per-save frame cost (coach stopped) |
| `scripts/track_model.py`, `scripts/synth_track.py` | build the retry model; a synthetic `fast_lane.ai` for extractor tests |

Changes #8 made inside #7's code:
- `TrackSimSource.teleport_to` (for rewinds).
- `CoachApp._on_lap_corners` skips laps while `lap_coach.retrying`.
- The announcer gained the `OFFER` kind: priority 0, max age 20 s.
- `Coach.set_corner` / `restore_offer` / `last_packet` (drill mode only).

## Protocols and ports (additions)

| Port | Between | Messages |
| --- | --- | --- |
| UDP 127.0.0.1:9101 | coach → CSP Lua app v0.2 | existing `SAVE`, `RESET`, `SAVE resume`, `RESUME`. **New:** `CFG period=<s> keep=<n> anchors=<p1,…>` → `CFGOK`, resent every 5 s (Lua stops timed saves 15 s after the last CFG). `HOLD <event> <seq>` → `HELD` / `ERR gone` / `ERR full`. `RESTORE <id> <event>` → `ACK <id>` / `ERR nohold` / `ERR notallowed`. `DROP <event>` → `DROPPED` |
| UDP 127.0.0.1:9102 | Lua app → coach (**new**) | `CK <seq> <a\|t> <spline 0..1> <kmh> <lap> <anchor\|-> <call_ms> <done_ms> <bytes>`, one per save (timed ring of 20 at 1 s, plus one per corner anchor) |
| UDP 5005 | receiver → phone (**new**) | `ofr,<offer id>,<corner>,<ms left>` ~4/s while an offer is open; `ofx,<id>` ×3 when it closes. Signed (`,<tag16>`) when paired. Next (`coach_next`) accepts the open offer |
| UDP 5005 | phone ↔ receiver | QR pairing: `h1,<pn>,<tag>` → `w1,…`, then every packet signed. Modes `--pairing off\|optional\|required`; optional locks once a phone pairs |
| TCP 8020 | dashboard | **New:** `GET /track` (#7), `GET /pair.svg`, `GET/POST /settings`, `POST /personal_best/reset`. `/state` adds `track`, `track_laps`, `focus`, `offers`, `references`, `settings` |

- **Events on `/ws`:**
  - #7: `track_lap`, `lap_summary`, `focus`; `run` with `role: lap`.
  - #8: `corner_event`, `offer` (every state change), `retry_started`, `retry_judged`,
    `retry_finished`, `offer_analysis`, `settings`, `references`, `corner`.
- **Commands:** `accept` (accepts the open offer when there is one), `accept_offer` (`offer_id`
  for a history entry), `settings` (`changes`), `reset_personal_best`, `select_corner`
  (drill mode), `new_pairing`.

## Tests

```
uv run pytest -q
```
Cloud sessions without `aiohttp`/`openai`: ignore `test_dashboard.py`, `test_track_coach.py` (web
parts) and `test_nemotron.py`.

- **#7:** `test_track_coach.py`, `test_track_scorer.py`, `test_track_agent.py`, `test_track_sim.py`.
- **#8:** `test_combined.py` (both coaches in one app), `test_lap_flow.py`, `test_lap_coach.py`,
  `test_events.py`, `test_corner_pass.py`, `test_checkpoints.py` (fake Lua peer over UDP),
  `test_reference.py`, `test_settings.py`, `test_phone_offer.py`, `test_pairing.py`, `test_track.py`.
- **Simulators:** non-realtime simulators run much faster than real time. A test that waits for an
  offer may see the car drive several corners meanwhile, so assert on events, not on positions.

## Verified vs not yet

- **Verified (simulator, unit tests only):** the full flows. Error → cue → offer → accept → rewind →
  retries → resume, in combined and `--whole-lap` modes. Supersede, expiry and history. PB updates.
  Settings applied live. Signed phone pushes. Lua protocol against a fake peer.
- **Not verified in the game:**
  - The Lua app v0.2 has never run. CSP fields marked `TO VERIFY` in `csp/nomadsim_reset`:
    `car.splinePosition`, `car.lapCount`, `sim.isPaused`, `sim.isReplayActive`, `os.preciseClock`.
    Run `scripts/checkpoint_probe.py --seconds 40 --hold-at 10 --restore-at 35` first. It also gives
    the save cost that decides the 1 s cadence (stage B).
  - Lock-up/wheelspin slip units and the yaw-rate sign.
  - #7's corner gates on the real lap line, and the 787B brake points.
  - A live Nemotron endpoint for event cues.
  - The dashboard routes (no `aiohttp` in the cloud).
- **Known gaps:**
  - The iOS side (Pit Pal redesign, QR scanner, signed packets, `ofr`/`ofx` on Next) is on `feat/ios-pit-pal`
    (`docs/IOS_PIT_PAL_PLAN.md`); it builds but hasn't been walked through on device.
  - No dashboard UI for offers or settings: the API only (UI pass later).
  - The think-mode answer after opt-in is spoken or shown but doesn't change how retries are judged.
  - "Stable save" for the picker's fallback is approximated (off every corner, within 25% of AI speed).

## Rules (unchanged, still apply)

- **Git:** no Claude co-author / "Generated by" lines in commits or PRs; merge with a merge
  commit, never squash.
- **Python:** `uv` only, never pip into `.venv`; Windows extras via `uv run --with vgamepad --with pyserial`.
- **Game install:** don't change the AC install / CM / CSP except `apps\lua\nomadsim_reset\`.
- **Ports:** one receiver on UDP 5005.
- **Mascot:** use the team's art, don't draw a new one.
- **Decisions:** run implementation decisions by the user before coding them. Record them in
  `docs/ROLLING_CHECKPOINTS.md` (the Decisions table).
