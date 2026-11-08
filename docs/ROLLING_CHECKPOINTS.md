# Rolling checkpoints, error events and opt-in retries: implementation plan

Status: **plan approved, all defaults confirmed 2026-11-08.**

Goal: the sim runs continuously at Monza. Every driving error anywhere on the lap produces a coaching
cue and a 5-second opt-in to rewind and retry that corner, from the phone (Next) or the PC.

## Decisions (made 2026-11-08)

| Area | Decision |
| --- | --- |
| Checkpoints | **Hybrid:** one save per corner at an anchor before its braking zone, plus a rolling 1 s buffer (~15 s) as fallback. |
| AI calls | **Fast mode for the live per-error cue (2 s budget). A longer think-mode budget once the driver opts in to a retry, and while judging retries.** |
| Overlapping errors | **Newest replaces** the open offer. Older ones stay retryable from a ~60 s history while their checkpoint is held. |
| Retry loop | **Keep today's loop:** auto-rewind until the coach says fixed or 5 retries, then return to where Retry was pressed. Resume ends it any time. |
| Scope | **Every corner at Monza.** Every error triggers an event and an offer. |
| Corners | **7 units**, each chicane one corner: Rettifilo, Curva Grande, Roggia, Lesmo 1, Lesmo 2, Ascari, Parabolica. |
| Curva Grande | Flat out, so **major errors only** (wheels off, spin, big speed loss). Its anchor counts back from turn-in. |
| Error cue | Reuses the coach's **`offer_drill`** decision (drill, target, cue) instead of a new `offer_retry` tool; the accepted offer runs today's retry loop. |
| Stable save (retry start, fallback 3) | **Approximated:** off every corner and within 25% of the AI speed there (the Lua save report has only position and speed). Revisit in B. |
| Errors during a retry loop | **Ignored** until the loop ends and the car is back where Retry was pressed. |
| Personal best | **Normal laps only**: passes during a retry loop never set a best. |
| Track data | **Kevin's F1-measured corners** (`fixtures/track_monza.json`, PR #7) for both coaches. The retry model `fixtures/tracks/monza.json` is built from it by `scripts/track_model.py` (787B sim lap as the speed profile, Curva Grande added from the F1 T3 marker). The real `fast_lane.ai` replaces the profile later (`ac_track_extract.py --model-out`). |
| Reference | **AI racing line or personal best**, chosen **globally** (no per-corner override). |
| Personal best | **Saved on disk**, with a **reset** button. |
| Settings | **Dashboard `/settings` page now**, Pit Pal panel later (same API). Settings: reference, error sensitivity, countdown length, retry lead time, voice on/off. |
| PC-side display | **Dashboard + voice now.** Pit Pal is a separate plan that plugs into the same events. |
| PC-side overlay | **Built** (PR #11): Rev reads the same `/ws` events (offers, countdown, retry outcomes) over the game. See `docs/PITPAL_OVERLAY.md`. |
| iPhone offer | The existing **Next button lights up with a countdown ring and the corner name, plus a haptic tap**. **Tap Next** to opt in. Text: **corner + countdown** only (e.g. "Retry T1 · 4"). |
| iPhone status | **Offer only**: no retry-loop progress on the phone. |
| Phone link | **Merge QR pairing first.** It stays on UDP; signing costs ~3 µs and 17 bytes per packet (measured), so no added input lag. Offer messages are signed. |

## Work breakdown (pull requests, in order)

```
A  QR pairing (receiver + iOS) ─────────────────────────────┐
B  Feasibility measurements (game PC) ──┐                   │
C  Lua rolling buffer + anchors + holds ┤                   │
D  Track model + multi-corner scoring ──┼─► E  Events, AI cue, offer, retry ─► F  Phone offer
                                        │                                    G  Settings page
```

A and B–D can proceed in parallel. E needs C and D. F needs A and E. G needs D, and plugs into E.

### A. Merge QR pairing (prerequisite for the phone offer)

- Rebase `feat/qr-pairing` onto `main`. Expect conflicts in `coach/inputs.py` with Dhanush's
  `2cf1a7a` (exclusive port binding, `InputHub.__init__` pedal curves). Keep both.
- iOS, per `docs/PAIRING.md`:
  - **Scan QR** button on the pairing screen, plus the `nomadsim://` deep link.
  - Keychain storage.
  - Hello/welcome with CryptoKit.
  - Signed v1/evt packets and signed-ack checks.
  - Re-hello on `rehello`.
- Tests: Swift unit tests against the test vectors in `PAIRING.md`, then an on-device run against
  `--pairing required`.
- Done: the phone pairs by scanning, drives in AC with signed packets, and survives a coach restart.

### B. Feasibility measurements (game PC, ~30 min with Dhanush)

- A measurement build of the Lua app: times each state save, logs blob size, and saves every 1 s
  for 5 minutes while lapping. We watch frame times.
- Load a held state at speed and confirm from telemetry: how often is the 20 m / 10 km/h check
  met, and how fast?
- A latency script: Nemotron fast and think mode from the game PC (Brev, and the hosted
  NVIDIA/OpenRouter fallback), 20 calls each, with a sample event packet.
- Output: numbers in this doc. Go/no-go for a 1 s cadence (fallback: anchors plus a 2–3 s buffer).

### C. Lua rolling buffer, anchors and holds (`csp/nomadsim_reset/`, `coach/checkpoints.py`)

Proposed protocol additions. The existing `SAVE`, `RESET`, `SAVE resume` and `RESUME` stay
unchanged.

| Message | Direction | Purpose |
| --- | --- | --- |
| `CFG period=<s> keep=<n> anchors=<s1>,<s2>,…` | coach → app (9101) | buffer cadence/size; anchors as track positions 0..1 |
| `CK <seq> <a\|t> <spline> <kmh> <lap>` | app → coach (new UDP 9102) | a state was saved (anchor or timed) |
| `HOLD <event> <seq>` → `HELD <event> <seq>` / `ERR gone` | coach → app | copy a state out of the ring so it survives eviction |
| `RESTORE <id> <event>` → `ACK <id>` | coach → app | load a held state |
| `DROP <event>` | coach → app | release a held state |

- `coach/checkpoints.py` (`CheckpointStore`): keeps an index of the ring from `CK` lines (no blobs),
  sends `CFG` at start, and manages holds (expiry and limits).
- Safety: timed saves only while the session is live and the car is moving. API names are verified
  against the CSP SDK on the game PC before coding (`extension\internal\lua-sdk\ac_apps\lib.lua`).
- Tests: a fake Lua peer over UDP in pytest (ring index, holds, eviction, restore round trip).
- Done: in game, `HOLD` then `RESTORE` brings the car back to a state from up to ~60 s earlier.

### D. Track model and multi-corner scoring (`scripts/ac_track_extract.py`, `fixtures/tracks/monza.json`, `coach/track.py`, `coach/scorer.py`)

- **Extractor:** from `fast_lane.ai`, split the lap into corners (AI speed drops → braking zone,
  speed minimum → apex, acceleration → exit). Hand-check and name the Monza corners. Each corner
  gets: entry, brake-zone start, apex window, exit, anchor (lead time before the brake zone at AI
  speed), boards, and AI-line metrics (the file has speed, gas and brake per point).
- **TrackScorer** generalises `CornerScorer` to every corner. Each pass gives a `CornerPass`: brake
  onset, peak, release, min speed, throttle pickup, entry/exit speed, segment time, wheels-out
  (`numberOfTyresOut`, added to the telemetry reader), peak slip and yaw.
- **Reference:** `AiLineReference` (from the track file) and `PersonalBestReference`
  (`data/personal_best.json`: per corner, the fastest valid pass; reset clears it).
- **Coach refactor:** today `Coach`, the evidence packet and `SimSource` are built around one
  `CornerConfig`. They need the corner of the event or drill passed in per decision. The drill loop
  keeps its current behaviour, now for whichever corner is being retried.
- **Full-lap simulator:** `SimSource` drives the Monza AI line, with planted errors (late brake, run
  wide, early brake, slow exit) at chosen corners, so the whole flow is testable without the game.
- Tests: extractor on a real `fast_lane.ai` (copied from the game PC), scorer on recorded laps
  (`--record` → replay fixtures), personal-best update and reset.
- Done: a recorded clean lap gives no events; a lap with planted mistakes gives exactly those.

### E. Error events, AI cue, offer and retry (`coach/events.py`, `coach/offers.py`, `engine/`, `coach/app.py`, dashboard)

1. **Detection** (`EventDetector`, after each `CornerPass`):
   - **Major:** wheels off track, spin/backwards, lock-up/wheelspin, large speed loss.
   - **Minor:** time lost vs the reference above the sensitivity setting, or braked early/late
     beyond a distance threshold.
   - Every error raises an event.
2. **Pin the retry start** at once (`CheckpointPicker`):
   1. This lap's anchor for the corner.
   2. Else the latest buffer state at least the lead time before the brake point.
   3. Else the oldest stable state.
   4. Else no retry.

   Stable means wheels on track, low yaw and slip, near-straight steering, normal speed for the
   spot. The chosen state is `HOLD`-ed.
3. **AI cue:** an event packet with the event, this pass, the reference plus deltas, inputs and the
   last 2–3 passes there. It goes to the ladder in **fast mode** with a live budget. On timeout the
   rules coach's cue is used, and a late model answer is shown in history only. A new action tool,
   `offer_retry {drill, target, cue}`, is validated like today's tools.
4. **Offer** (`OfferManager`): states `waiting_cue` → `open` (countdown) → `accepted` / `expired` /
   `superseded`.
   - One open offer; the newest supersedes.
   - History holds earlier events while their hold is alive.
   - The countdown starts when the cue is delivered (the voice starts, or the text is shown if voice
     is off).
5. **Accept** (dashboard button, phone Next, or a history entry):
   1. `SAVE resume` at that moment.
   2. 3-2-1.
   3. `RESTORE` the held state.
   4. Confirm from telemetry.
   5. Then **today's retry loop**: retries judged with think mode, auto-rewind to the same held
      state, end on fixed or 5 tries, `RESUME` to the return point.
6. **Dashboard:** an offer card (corner, cue, facts, countdown, Retry) and a history list. Events go
   over the existing `/ws` stream, so Pit Pal can use them later.
- Tests: detector and picker unit tests, the offer state machine (supersede, expiry, history), and
  the full flow in the full-lap simulator (sim reset mode).
- Done: in game, every error gets a cue and a working retry, and the driver ends up back where they
  pressed Retry.

### F. Phone offer (`coach/inputs.py`, `phone/stealth-racing/`)

- **Receiver → phone:**
  - `ofr,<offer id>,<corner label>,<ms left>`, signed, sent ~4×/s while the offer is open (UDP can
    drop packets).
  - `ofx,<offer id>` when it closes.
- **Phone → receiver:** no new message. Tapping Next sends today's `coach_next`. While an offer is
  open the coach treats it as "accept this offer"; otherwise as today (accept a drill, or rewind
  for a retry).
- **Swift:**
  - `ReceiverSession` parses `ofr`/`ofx` and verifies them.
  - `DrivingView`'s Next button shows a countdown ring and "Retry T1 · 4", with one haptic tap when
    the offer appears.
  - No other UI change.
- Tests: Swift parsing against fixed signed vectors, then on device against the simulator flow.
- Done: on the phone, an error lights Next for 5 s, and a tap starts the retry.

### G. Settings (`coach/settings.py`, dashboard `/settings`)

- `data/settings.json`:
  - `reference` (`ai_line` | `personal_best`)
  - `error_threshold_s`
  - `countdown_s`
  - `lead_time_s`
  - `voice` (on/off)
- `GET`/`POST /settings` on the dashboard server. Changes apply live and are broadcast as a
  `settings` event. Pit Pal will use the same API later.
- The page: reference choice, the three sliders, voice toggle, and **Reset personal bests** (with
  a confirmation).
- Tests: load/save/validate, the live-apply event, and a page check (buttons wired, values sent).

## Confirmed defaults (2026-11-08)

| Item | Value |
| --- | --- |
| Default reference | Personal best, falling back to the AI line until a corner has a valid pass |
| Error sensitivity | 0.25 s lost in a corner (editable in settings, 0.1–0.5 s) |
| Brake early/late threshold | 15 m from the reference brake point |
| Countdown | 5 s (editable, 3–10 s) |
| Rolling buffer | 1 s cadence, 20 states (if B shows no frame hitches) |
| Held events / history | up to 5, each kept ~60 s |
| Live AI budget (the cue that opens the offer) | 2 s, then the rules cue |
| Retry lead time | 4 s before the braking point (editable, 3–6 s) |
| AI budget after the driver opts in | Think mode requested at once, with the existing deadlines (15 s per call, 22 s total). If it arrives before the braking point it replaces the cue (spoken and shown); otherwise it's shown only and used to judge the retry. Retry judging also uses think mode. |
| Major-error rules for the demo | wheels out ≥ 3 for > 0.3 s; spin (yaw vs track > 90°); lock-up/wheelspin above a slip threshold set in B; speed loss > 25% vs reference at the apex |
| Phone offer resend rate | 4 per second while open |

## Risks

- **Save cost:** a 1 s save cadence may cause frame hitches. Phase B decides; the fallback is
  anchors plus a 2–3 s buffer.
- **AI-line extraction:** untested on a real file. Phase D starts with the game PC's copy.
- **The multi-corner refactor** touches the coach core (`Coach`, evidence, simulator). It's done
  behind the existing tests, and the single-corner drill mode keeps working until the switch.
- **Error clusters** in chicanes produce many offers. Newest wins, and history keeps the rest.
