# Stealth Racing handoff

Open Claude Code in `/Users/kevendiaz/projects/hack-utd-2026/stealth-racing` and read this file before continuing. The iOS app and Python receiver already exist. Keep changes small and focused on the hackathon MVP.

## Goal and source material

Build an iPhone tilt controller for the NomadSim AI HackUTD 2026 project. The phone sends steering, throttle, and optional backup brake over UDP to a computer. The Mac was the initial test receiver. The eventual receiver may run on Windows alongside the Assetto Corsa bridge.

The original project plan is at `/Users/kevendiaz/Library/Mobile Documents/iCloud~md~obsidian/Documents/Personal/Projects/hack-utd-2026/claude-artifact.pdf`. The relevant section is **iPhone steering app**, on page 7. The artifact also describes an Arduino ultrasonic brake, virtual Xbox controller, and AI coaching loop. This app and listener cover the phone-to-computer link.

## Current implementation

| File | Role |
| --- | --- |
| `stealth-racing.xcodeproj` | Xcode project. The app target is iOS 26.6 and uses Swift 6 language mode. The last build used Xcode 27.2 and Swift 6.4.2. |
| `stealth-racing/ContentView.swift` | Owns the session and switches between setup and driving. Disconnects on backgrounding. |
| `stealth-racing/ReceiverSetupView.swift` | Landscape pairing screen: mascot hero plus a grouped list of nearby Bonjour receivers (last used is highlighted). `ManualAddressView` handles IPv4, IPv6, or hostname entry with a configurable UDP port. |
| `stealth-racing/Theme.swift` | Palette from `stealth-mascot-final` (dark #12141C ground, racing red #D92B1F) and the pixel-art `MascotImage`. Mascot PNGs live in `Assets.xcassets` (`Mascot`, `MascotBase`). |
| `stealth-racing/SimCommand.swift` | Assetto Corsa command stubs (gear shifts, pit limiter, DRS, lights, horn, look back, TC/ABS, camera) and their wire names. |
| `stealth-racing/ControlsSheet.swift` | In-drive settings: on-screen pedals, full-lock angle, haptics, assist buttons, command list. |
| `stealth-racing/ReceiverSession.swift` and `ReceiverStatus.swift` | Main-actor observable session, Bonjour discovery, Core Motion, UDP, and receipt confirmation. |
| `stealth-racing/DrivingView.swift` | Landscape cockpit: touch-down paddle shifters (top corners), spring-loaded fallback brake/throttle pads, steering gauge with tilting mascot, Recenter, and a grid of sim buttons. |
| `Info.plist` | Declares the Bonjour service type. The project build settings provide the Local Network permission text. |
| `listen.py` | Python 3.9+ receiver with no pip dependencies. Prints the first-packet success message and every payload. Binds to IPv4 and IPv6 where supported, with an IPv4 fallback. |

## Wire format

- Transport is UDP, default port `5005`. The app sends roughly 100 packets per second while the UDP path is ready.
- Payload is UTF-8 CSV: `v1,seq,steer,throttle,brake`. Example: `v1,42,-0.5,0.75,0`.
- `seq` increases for each packet sent. `steer` is normalized to `-1...1`, with negative left and positive right. Hold the phone upright like a wheel. Core Motion's estimated gravity vector supplies the wheel angle. Recenter records neutral, rotations below 2° are ignored, and 45° in either direction reaches full lock. Raw gyroscope axes are not transmitted.
- Throttle and brake come from the on-screen pedal pads in `0...1` (fallback for the Arduino pedals). Both are zero when **On-screen pedals** is off; the bridge should combine phone and Arduino values with `max()`. Full lock is configurable (30/45/60/90°, default 45°).
- Discrete actions use a separate event packet: `evt,<id>,<command>,<phase>`, e.g. `evt,12,shift_up,tap`. `phase` is `tap`, or `down`/`up` for held commands (horn, look back). Each event is sent three times with the same ID; `listen.py` de-duplicates per sender and calls `handle_event`, where `AC_BINDINGS` is the stub to map commands to Assetto Corsa inputs. Legacy receivers just print these lines.
- The updated listener replies with `ack,<seq>` when it receives a v1 packet whose sequence is divisible by 30. The app displays **Receiver confirmed** after a matching reply and **Sending · No reply** after roughly three seconds without one. A legacy receiver can still consume the same v1 packets.
- Bonjour advertises `_stealth-racing._udp` in `local.` using the computer's `dns-sd` command when available. The app connects directly to the selected service endpoint.

## Run and connect

1. On macOS, run `python3 listen.py` from this directory. On Windows, run `py listen.py` from the directory containing the script. Use `--port 5012` for a custom port and enter the same port in the app.
2. Run the app on a physical iPhone from Xcode. Put the iPhone and receiver on the same network and allow Local Network access.
3. Choose a nearby receiver if one appears. For Windows without Bonjour, tap **Enter address** and enter the address for the active Windows network adapter from `ipconfig`.
4. Tap **Recenter** with the phone held at neutral. Confirm the Mac or Windows terminal prints the packets. If Windows receives nothing, check its inbound firewall rule for the configured UDP port.

The iPhone hotspot previously gave the Mac a translation-only IPv4 address in `192.0.0.0/29`. In that setup, use the computer's current IPv6 address or Bonjour if discovery works across the hotspot. Addresses from the old chat were specific to that network and should be checked again.

## Verification and remaining work

- The iOS app built successfully in Swift 6 mode for a generic iOS device. Build from this directory with:

  ```sh
  xcodebuild -project stealth-racing.xcodeproj -scheme stealth-racing \
    -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build
  ```

- On the Mac, the listener received and acknowledged IPv4 and IPv6 test packets without Bonjour. A separate Swift Network framework test discovered the listener via Bonjour, sent a v1 packet, and received its reply.
- The current UI has not been exercised on a supported simulator or a physical iPhone. A live iPhone-to-Windows test and iPhone-to-Mac Bonjour test over the hotspot are still open.
- For the next live test, verify steering direction and recentering, slider values, receipt confirmation, and reconnect after stopping and restarting the receiver. If you extend the Windows game bridge, preserve the v1 payload and add the optional reply only if the app should confirm receipt from that bridge.
