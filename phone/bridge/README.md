# Assetto Corsa bridge (Windows)

`ac_bridge.py` receives the Stealth Racing phone's UDP packets and drives a virtual Xbox 360 controller that Assetto Corsa binds like any other gamepad.

> **Status:** the dry-run backend and the tests pass on macOS and Linux. The Windows gamepad path has **not** been run on real hardware yet. Its `vgamepad` calls have only been checked against a fake module.

## 1. Install

1. Install the **ViGEmBus** driver, which `vgamepad` needs to create the virtual controller. `pip install vgamepad` may offer to install it. If it doesn't, install it from the ViGEmBus releases page. `[VERIFY IN GAME]`: confirm a new "Xbox 360 Controller for Windows" appears in *Set up USB game controllers* (`joy.cpl`) once the bridge is running.
2. From the `phone/` folder of the repository:

   ```bat
   py -m pip install -r bridge\requirements.txt
   ```

## 2. Run

```bat
py bridge\ac_bridge.py --backend gamepad
```

| Flag | Default | Purpose |
| --- | --- | --- |
| `--port` | `5005` | UDP port. Enter the same port in the app. |
| `--backend` | `dryrun` | `dryrun` only logs. `gamepad` drives the virtual controller. |
| `--invert-steer` | off | Flip the steering direction. |
| `--pulse INPUT` | — | Pulse one input for about 5 s for binding, then exit (see below). |
| `--arduino-port` | — | Reserved for the Arduino pedals. It does nothing yet. |

The first time it runs, allow Python through Windows Firewall, or add an inbound rule for **UDP 5005**. Windows has no Bonjour by default, so pair from the app with **Enter address manually** and the IPv4 address from `ipconfig`. The app shows **Receiver confirmed** once the bridge answers its `ack` replies.

Try it without a game first: `py bridge\ac_bridge.py` (dry run) prints every axis change and button press.

## 3. Bind the controller in Assetto Corsa

Menu names below are generic. Check each one in your copy of the game.

1. Start the bridge with `--backend gamepad` so the virtual controller exists, then launch Assetto Corsa.
2. Open the controls settings and choose the gamepad or controller input mode. Then select the virtual Xbox 360 controller. `[VERIFY IN GAME]`
3. For each binding, click it in the game. Then, in a second terminal within about 5 s, run the matching pulse command:

   ```bat
   py bridge\ac_bridge.py --backend gamepad --pulse steer-left
   py bridge\ac_bridge.py --backend gamepad --pulse throttle
   py bridge\ac_bridge.py --backend gamepad --pulse brake
   py bridge\ac_bridge.py --backend gamepad --pulse shift_up
   ```

   Steering is one axis (left stick X). If the game asks for left and right separately, pulse `steer-left`, then `steer-right`.
4. Set the steering deadzone to 0 and linearity to 1 if the game offers them, because the phone already applies a 2° deadzone. `[VERIFY IN GAME]`
5. Save the controls preset.

Running `--pulse` while the main bridge is also running creates a second virtual controller. Stop the main bridge while you bind.

## 4. Button map

Edit `bridge/bindings.py` to change any of these. Start is deliberately unbound.

| Phone button | Wire command | Virtual controller | Status |
| --- | --- | --- | --- |
| Up paddle | `shift_up` | RB | Mapped |
| Down paddle | `shift_down` | LB | Mapped |
| Pit limiter | `pit_limiter` | Y | Mapped, untested in game |
| DRS | `drs` | X | Mapped, untested in game |
| Lights | `headlights` | D-pad up | Mapped, untested in game |
| Horn (held) | `horn` | A | Mapped, untested in game |
| Look back (held) | `look_back` | B | Mapped, untested in game |
| TC − | `tc_down` | D-pad left | Mapped, untested in game |
| TC + | `tc_up` | D-pad right | Mapped, untested in game |
| ABS − | `abs_down` | Left stick click | Mapped, untested in game |
| ABS + | `abs_up` | Right stick click | Mapped, untested in game |
| Camera | `camera` | Back | Mapped, untested in game |
| Steering | `v1` steer | Left stick X | Mapped |
| Throttle pad | `v1` throttle | Right trigger | Mapped |
| Brake pad | `v1` brake | Left trigger | Mapped |

Each command still has to be bound to its action in Assetto Corsa's controls (step 3). The app shows a **Stub** badge on everything except the paddles until that's confirmed.

Taps hold the button for 60 ms. Horn and look back stay pressed from `down` until `up`. Throttle and brake take the `max()` of the phone and the Arduino once the Arduino reader exists.

## 5. Troubleshooting

- **No packets arrive.** Check that the phone and PC are on the same network, that the app's address is the right adapter's IPv4 address from `ipconfig`, and that UDP 5005 is allowed through the firewall. Run `py listen.py` to rule out the bridge.
- **Steering is reversed.** Restart with `--invert-steer`. Recenter in the app while holding the phone level.
- **A button or pedal is stuck.** If the phone stops sending for 250 ms (app closed, Wi-Fi drop, bridge restarted), the bridge centers the stick, lifts both pedals and releases every button. Pressing Ctrl+C does the same before it exits. If a button is still stuck, the game is probably holding the old state. Tap the button once.
- **`vgamepad is not installed`.** Run the install step from the same Python you launch the bridge with (`py -m pip ...`).
