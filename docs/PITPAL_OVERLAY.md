# Pit Pal overlay (Rev)

Pit Pal is the platform (app, pedals, coach, overlay, website); **Rev** is the mascot. Rev is the pixel companion that sits over Assetto Corsa: pairing QR, live reactions, the coach's cues as short bubbles. It is a separate process (`python -m pitpal`) that is a client of the coach's existing stream, `ws://127.0.0.1:8020/ws`, so a UI problem can never stall telemetry or the pad loop.

## Run it

| What | Command |
| --- | --- |
| Game PC, one click | Double-click `PitPal.bat` (or a desktop shortcut to it). Same as the line below. |
| Game PC, by hand | `uv run --with vgamepad --with pyserial python -m coach --telemetry ac --reset udp --inputs --track fixtures/track_monza.json --overlay` |
| No game (simulator) | `uv run python -m coach --track fixtures/track_monza.json --telemetry sim --inputs --pad none --arduino off --overlay` |
| Overlay alone | `uv run python -m pitpal [--url http://127.0.0.1:8020] [--scale N] [--side left\|right]` |
| Tour of every state, no coach | `uv run python -m pitpal --demo` |

`--overlay` also turns on Rev's own lines (below). Assetto Corsa must run **borderless or windowed**: exclusive fullscreen hides every overlay.

## The flow

1. **Launch.** Rev appears in the bottom-right corner of the screen (a little inward from both edges). Drag him anywhere; he snaps to the screen corners and remembers where he was (`data/pitpal.json`).
2. **Pairing.** If a phone has not connected, Rev shows **SCAN ME** with the pairing QR (drawn from `/pair.json`). A phone that paired before reconnects by itself within a couple of seconds, and then no QR shows. Right-click Rev, *Show pairing code* / *New pairing code* for a fresh one.
3. **Connected.** "Connected." Rev goes idle: "Ready when you are".
4. **Racing.** When the car moves, Rev puts the helmet on and the idle bubble disappears. He reacts to the driving and speaks the coach's cues (bubble = the first sentence, at most 9 words).
5. **Offer, rewind, retry.** Accept the timed offer to rewind once to the corner checkpoint. Rev shows “Rewinding…” while the coach confirms the restore, then “Clean.” or “Not yet.” after the corner. The driver continues from there or explicitly chooses Resume if a resume point was saved.

Rev never takes focus from the game and has no taskbar entry; the see-through parts pass clicks to the game. Hover him for Accept / Resume / Mute, click for the details card, right-click for the menu.

## What Rev wears (design system rules)

| Outfit | When |
| --- | --- |
| `racer` (white, red suit, no helmet) | the main form: idle, thinking, talking, offers |
| `helmet_suit` | while driving (a racing session) |
| `suit` | the rewind countdown |
| `base` (plain white) | pairing, warnings, no coach connection |

An outfit never changes while Rev is talking. Rev moves only in whole art pixels and in steps (idle bob, talk bounce, think sway, warn shake, hop, wince): no easing, no smoothing, as the design system requires.

## Events Rev reads (from `/ws`)

| Event | Rev does |
| --- | --- |
| `health` | pairing / phone / pedal / AI state, mute, Nemotron badge |
| `telemetry` (new, 10 Hz) | racing detection and instant reactions (lock-up, wheels off, slide) |
| `voice` (`speaking` / `spoken`) | talking animation and the bubble text, in sync with the speech |
| `offer`, `retry_started`, `reset_confirmed`, `retry_judged`, `retry_finished`, `reset_failed` | offer bubble, rewind feedback, outcome |
| `corner_event`, `thinking`, `status` (DECIDING) | the "Reading Turn 1…" thinking state |
| `rev_line` (new) | Rev's own line, below |

Commands Rev sends back: `accept`, `resume`, `toggle_mute`, `new_pairing`.

**Coach changes for the overlay (all additive):** the `telemetry` event (10 Hz, only while something is subscribed, never stored in the event history), `GET /pair.json` (the pairing link; as private as `/pair.svg`, keep the dashboard on 127.0.0.1), `--overlay`, `NemotronProvider.say()` (a short plain-text fast-mode call), and `coach/rev_lines.py`.

## Rev's own lines (NVIDIA Nemotron)

`coach/rev_lines.py` reacts to a quick lap (corners 0.15 s or more under the reference), a slow lap (0.5 s or more over), and a corner fixed on a retry. Nemotron writes the line in **fast mode** (about 9 words, a 1.6 s deadline); if no provider answers in time, or the answer is not a short plain sentence, a rules line is used instead. The line goes out as `rev_line` and through the announcer, so it is spoken (NVIDIA Magpie TTS with `--voice nvidia`, else the Windows voice) only on the straights. At most one line every 10 s. The overlay badge under Rev shows which AI is active (Nemotron · fast / thinking, or Rules).

## Tuning on the game PC

`pitpal/reactions.py` `Thresholds` holds every reaction number (lock-up brake and slip, wheels off, slide). The coach's notes say slip units and signs are not verified in the game yet, so these are first guesses: drive, watch Rev, adjust. `pitpal/window.py` sizes everything from the screen height (`ui`) and Rev's zoom is a whole number (`--scale`).

## Brand

Colours, the Pit Pal Bubble and Barlow fonts, the pixel buttons and the stepped bubble are from the Pit Pal design system. The fonts are its woff2 files converted to ttf (`pitpal/assets/fonts`; Pit Pal Bubble's name table was completed so Windows loads it, glyphs untouched). Rev's sprites are in `pitpal/assets/rev`: `src/` are the originals at 14x, the rest are 1 pixel per art pixel with the soft ground shadow dropped (a half-transparent pixel would smear on a see-through window); regenerate with `uv run --no-project --with pillow python pitpal/tools/make_sprites.py`.

## Decisions (2026-11-08)

| Area | Decision |
| --- | --- |
| Toolkit | **Tkinter**: nothing to install, whole-number pixel zoom, colour-key transparency (click-through), no-focus window via a small Windows call. |
| Animation | **Code-driven now**, from the existing stills. Real sprite sheets drop into the same slots later. |
| Launch | **One shortcut** (`PitPal.bat`): coach + overlay, QR shown automatically. |
| Reactions | **Local rules for instant reactions, Nemotron (fast mode) for the lap and retry lines.** |
| Placement | Bottom-right of the screen, bubble up and to the left of Rev. Short text only: the voice carries the detail. |
| iPhone side | Not in this branch: the Swift changes are done separately. |

## Not verified yet

Only the simulator, the unit tests and screenshots of every state on the dev machine. Not yet run: the overlay over a live Assetto Corsa session on the game PC, the telemetry thresholds, and a live Nemotron line. Tests: `uv run pytest -q tests/test_pitpal.py`.
