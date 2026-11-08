# iOS app: Pit Pal redesign, QR pairing and retry offers (plan)

Status: **built on `feat/ios-pit-pal`** (2026-11-08). The app builds with no issues in Xcode and runs on the iPhone. On-device walkthrough and a run against the coach are still to do (Stage H). Decisions are in section 4.
Scope: **the iPhone app only** (`phone/stealth-racing/`). The receiver side is already on `main`
(PRs #7 and #8, see `docs/AGENT_CONTEXT.md`); no Python changes are planned.

**Sources:**
- **"Pit Pal" design system** (claude.ai artifact). Brand, voice rules, colours (Pit = dark,
  Paper = light), the Pit Pal Bubble and Barlow typefaces, pixel grid, hard shadows, stepped motion,
  components, and assets (Mascot, Logos, AppIcon, Graphics).
- **"Pit Pal: mobile app flow"** (claude.ai artifact). Eight landscape iPhone screens:
  1 Launch, 2 Pairing, 3 Scan QR, 4 Connecting, 5 Connected, 6 Cockpit, 7 Controls, 8 Error states.
  Plus the PC overlay (not in scope).
- **Protocol:** `docs/PAIRING.md` (QR URI, hello/welcome, signing, `ofr`/`ofx`, test vectors).

## 1. Where the app is today vs the design

| Area | Today (`main`) | Target |
| --- | --- | --- |
| Brand | "Stealth Racing", old mascot (`Mascot`, `MascotBase`), SF fonts | Pit Pal: white creature in a red suit (helmet only in the cockpit), Bubble display face + Barlow, Pit tokens |
| App icon | none (no AppIcon set in `Assets.xcassets`) | AppIcon from the design system (racer on graphite, 1024 px, no baked mask) |
| Launch | straight to setup | **1 Launch**: LED loader (green → amber), "Warming up the pit wall", Skip, checker strip |
| Pairing | Bonjour list + manual address | **2 Pairing**: "Scan QR code" primary button, nearby receivers (Last used / Bonjour), "Enter address manually", pills (Same Wi-Fi, UDP 5005) |
| QR | none; packets unsigned | **3 Scan QR**: camera with red corner frame, sweeping scan line, "Looking for a Pit Pal code" pill, torch, "How it works", manual fallback. Packets signed per `PAIRING.md` |
| Connecting | "Receiver confirmed" pill only | **4 Connecting**: four numbered steps (Found receiver, Pairing code verified, Sending test packets, Receiver confirmed), LED meter, Cancel. **5 Connected**: all green, "Drive" |
| Cockpit | paddles, pedal pads, steering gauge, buttons | **6 Cockpit**, same functions in the new skin: Shift up/down tiles, Brake/Throttle pads ("Arduino brake/throttle"), tach roundel with the helmeted racer and shift lights, STEER readout + Recenter, Next / Resume / Pit limiter / DRS / Horn / Look back, status pill, Controls (sliders) and X (back to Pairing) |
| Retry offers | none | **Not in the mockups**: see Stage F and question 2 |
| Settings | Controls sheet | **7 Controls**: Pedals (on-screen pedals + help), Steering (full lock 30/45/60/90, haptics), Assetto Corsa buttons list with wire names and pad letters; Done |
| Errors | inline text | **8 Error states**: Sending · No reply, Local Network is off, That's not a Pit Pal code, Receiver lost (each with an action) |

Navigation, from the canvas note: Launch → Pairing → (Scan QR or a receiver) → Connecting →
Connected → Drive. In the cockpit, X goes back to Pairing and the sliders button opens Controls.

## 2. Work breakdown (one branch `feat/ios-pit-pal` off `main`, one commit per stage, then a PR)

### Stage A: assets, fonts and tokens
- Import the design-system files into `Assets.xcassets`:
  - Mascot: `stealth-base`, `stealth-racer`, `stealth-suit`, `stealth-bust`, `mascot_helmet_suit_v2`.
  - Logos: wordmark and stacked, on-dark.
  - AppIcon: the chosen variant, 1024 px single-size.
  - Graphics: checker, tach parts, if needed.
  - Pixel art renders with `.interpolation(.none)` at integer scales.
- **Fonts:** `PitPalBubble.woff2` and Barlow 400/500/600/700 ship as woff2, which iOS can't load.
  Convert to TTF (fontTools), add them to the target and to `UIAppFonts`. Check Barlow's licence
  (expected SIL OFL) and Pit Pal Bubble's origin before bundling.
- **`Theme.swift` → Pit tokens:**
  - Surfaces: bg `#12141C`, surface `#1C1F2A`, raised `#222633`, hairline `#2B2F3A`,
    outline-strong `#616B83`, pixel-outline `#0A0B10`.
  - Text: ink `#E8EBF2`, ink-muted `#8D96AD`, ink-faint `#5A6277` (flagged low contrast: use
    sparingly).
  - Brand: brand `#D92B1F`, brand-deep `#8A150F`, brand-tint `#3A1512`, accent `#FF6A58`.
  - Status: go `#3FD17A`, caution `#FFC233`, led `#FF7A1A`, signal-blue (value from the tokens).
  - Spacing on a 4 px unit, radii 10/16/pill, a hard 1-cell `shadow-pixel`.
- **Display text style:** the `.pp-display` recipe as a SwiftUI modifier (white face, 1-cell black
  outline, 1-cell red drop shadow, sized at multiples of 22 pt). Uppercase only.
- **Done:** a preview catalogue of the tokens, type and mascot builds.

### Stage B: design-system components (SwiftUI)
- **Shared pieces:**
  - `PixelButton`: stepped corners, hard shadow; press drops 4 px; primary/secondary/destructive.
  - `StatusPill`: dot plus label; go, caution, signal-blue, brand.
  - `LedMeter` / `LoadingBar`: cells fill one at a time, green → amber → red.
  - `CheckerStrip`.
  - `PairingStep`: number, check/working/empty box, title and detail.
  - `ScannerFrame`: red corners and a scan line sweeping in 16 steps.
  - `PedalPad`, `SteeringGauge` (tach roundel: graphite disc, white sweep ticks, red redline arc,
    shift-light LEDs, racer inside), `CommandButton`.
- **Motion:** the design system specifies stepped, sprite-frame motion: whole steps, no easing
  (press 90 ms; enter 320 ms with 60 ms stagger; mascot bob 7 px on a 1.1 s two-step loop; blinks
  1 s on/off). All of it is off under Reduce Motion.
- **Glyphs:** a plain 2 px line set (SF Symbols with a matching weight, or Lucide paths). Never emoji.

### Stage C: screens and flow
- **Routing:** `ContentView` becomes a small router. Launch → Pairing → Scanner / Connecting →
  Connected → Cockpit, plus the Controls sheet and error presentation. Landscape only, as today.
- **Screens:**
  - **Launch:** the loader runs while the app checks for a saved pairing and Local Network
    permission; Skip goes straight to Pairing.
  - **Pairing:** the Bonjour list (reuses `ReceiverSession` discovery), "Last used" first, manual
    address (reuses `ManualAddressView`, restyled).
  - **Connected:** the copy "Hold the phone upright like a wheel, then tap Recenter."
  - **Cockpit:** the current `DrivingView` behaviour, re-skinned to the mockup. Multitouch paddles
    with a pedal held, spring-back pads, recenter and the steering readout all stay. X disconnects
    and returns to Pairing.
- **Copy** follows the voice rules: sentence case, uppercase buttons, "Next" and "Resume" exactly,
  no exclamation marks.

### Stage D: QR pairing (receiver protocol already on `main`)
- **Scanner:** a camera preview inside `ScannerFrame` with torch control. Camera permission text
  goes in the build settings. Proposal: AVFoundation (`AVCaptureMetadataOutput`), which allows the
  custom frame and the torch; VisionKit's scanner is less customisable.
- **URI:** parse `nomadsim://pair?v=1&h=…&p=…&k=…&n=…&id=…`. Anything else shows the
  "That's not a Pit Pal code" error.
- **Keychain:** keep `{receiver id, name, hosts, port, key}` per receiver; the newest is "Last used".
- **Handshake:**
  1. Try each host in `h` in order and send `h1,<pn>,<tag32>`.
  2. Accept `w1` only if its tag verifies.
  3. Derive the session key `S = HMAC(K, "s1,pn,rn")` with CryptoKit.
  4. Show "Pairing code verified".
- **Signing:**
  - Append `,<tag16>` to every `v1` and `evt`.
  - Accept `ack` / `ofr` / `ofx` only with a valid tag.
  - On `rehello`, redo the hello once. If that fails, show the wrong-code error (the receiver made
    a new code, so the phone must scan again).
- **Deep link (proposal):** register `nomadsim://` so the iOS Camera app can open the app straight
  into pairing.
- **Tests:** unit tests against the `PAIRING.md` test vectors (hello, welcome, session key, signed
  ack).

### Stage E: real connecting steps
Drive the four Connecting steps from the session state instead of timers:
1. **Found receiver:** endpoint resolved / UDP ready.
2. **Pairing code verified:** welcome OK; skipped or marked differently when unpaired, see question 3.
3. **Sending test packets:** v1 going out.
4. **Receiver confirmed:** first matching `ack`.

Cancel tears down the connection. "Drive" is enabled after step 4.

### Stage F: retry offers in the cockpit (receiver: `ofr` / `ofx` on UDP 5005)
- **Messages:** parse `ofr,<id>,<corner>,<ms left>` (~4 per second while an offer is open) and
  `ofx,<id>` (sent 3 times), verified when paired.
- **Offer state:** `OfferState {id, corner, deadline}`. The deadline is refreshed from each `ofr`.
  The offer clears on `ofx` or if no `ofr` arrives for about 1 s.
- **Decided UI** (2026-11-08):
  - The existing **Next** button lights up with a countdown ring and "RETRY \<CORNER> · \<s>".
  - One haptic tap when an offer appears.
  - **Tapping Next sends today's `coach_next`**: the receiver treats it as "accept this offer".
  - The phone shows the offer only, no retry-loop progress.
- **Visual details aren't in the mockups.** See question 2.
- **Tests:** offer parsing and timing (refresh, expiry, a new id replacing the old one).

### Stage G: errors and resilience
- **Sending · No reply:** no `ack` for 3 s while sending. Try again.
- **Local Network is off:** detect the `NWBrowser` / `NWConnection` policy-denied state and open
  Settings.
- **That's not a Pit Pal code:** a bad URI, a failed `w1` tag, or `rehello` after a re-hello.
  Scan again.
- **Receiver lost:** acks stopped mid-drive. The receiver's 200 ms failsafe already lets the car
  coast. Offer Reconnect; this keeps the current auto-reconnect behaviour if there is one, else adds
  it.
- These show as the design's cards (presentation: sheet over the current screen).

### Stage H: verification
- Unit tests: crypto vectors, URI parser, offer state.
- `xcodebuild` for a generic iOS device with no warnings, plus SwiftUI previews of every screen and
  error.
- On device against `python -m coach --track fixtures/track_monza.json --inputs` (simulator lap,
  `--pairing required`):
  1. Scan.
  2. Drive.
  3. An offer lights Next.
  4. Tapping it rewinds.
  5. Repeat with `--pairing optional` and an unpaired phone.
- VoiceOver labels on all controls; Reduce Motion respected.
- Update `phone/CLAUDE_HANDOFF.md` and `docs/AGENT_CONTEXT.md`.

## 3. Proposals that need a yes
- **Scanner:** AVFoundation scanner (custom frame + torch) rather than VisionKit's
  `DataScannerViewController`.
- **Deep link:** register `nomadsim://` so the Camera app can pair too.
- **Fonts:** convert the woff2 fonts to TTF in the repo (fontTools); keep the woff2 originals out of
  the app bundle.
- **Delivery:** one PR with stages A–H as separate commits.

## 4. Decisions (2026-11-08)

| # | Question | Decision |
| --- | --- | --- |
| 1 | App icon | A **"P" monogram** variant (`logo-short-monogram`: white P on brand red), whichever reads best at icon sizes. Rendered from the SVG at 1024 px, full bleed (no baked corner mask: iOS applies its own). |
| 2 | Retry-offer look | No preference given, so it's **built from the Stage F spec** with the system's colours and LED style, and reviewed on device (the design artifact can't be edited from here). |
| 3 | Pairing | **QR is the primary method** (biggest button, first in the flow). **Manual stays open:** the nearby list and manual address still connect without a code, unsigned, while the receiver allows it. A receiver paired before reconnects signed with its saved key. Connecting step 2 then reads "Not paired" instead of "Pairing code verified". |
| 4 | Home-screen name | **Pit Pal** (`CFBundleDisplayName`). The Xcode project and target keep the name `stealth-racing`. |

| 5 | Design files | **Keven downloads** the Mascot, Logos, AppIcon and fonts folders (and `tokens.json`) from the Pit Pal design system into `~/projects/hack-utd-2026/stealth-racing/PitPalDesign/`. Stage A imports from there. |
| 6 | Mascot | **Suit out, helmet in the cockpit.** `stealth-racer` (red suit, no helmet; the design system's main form) on Launch, Pairing, Connecting and Connected; `mascot_helmet_suit_v2` (helmet) in the cockpit gauge; `stealth-base` (plain creature) for empty and error states. Note: `stealth-suit` is the *helmeted* art, despite its name. |
| 7 | Proposals | **All approved:** AVFoundation scanner, `nomadsim://` deep link, fonts converted to TTF, and one PR (`feat/ios-pit-pal`) with a commit per stage. |

All questions are answered. Stage A starts when the design files are in `PitPalDesign/`.

## 5. What was built (2026-11-08)

| Stage | Files |
| --- | --- |
| A assets, fonts, tokens | `Assets.xcassets` (AppIcon = P monogram, PitPalRacer / PitPalHelmet / PitPalBase, Wordmark), `Fonts/*.ttf`, `Info.plist` (UIAppFonts, `nomadsim` URL scheme), build settings (display name, camera text, app icon), `Theme.swift`, `phone/FONTS.md` |
| B components | `PixelUI.swift` |
| D pairing | `Pairing.swift` (URI, handshake, signing, Keychain store, debug self-test of the PAIRING.md vectors), `ScannerView.swift` |
| E-G link | `ReceiverSession.swift` (signed link, connecting steps, `ofr`/`ofx`, errors), `ErrorCard.swift` |
| C screens | `ContentView.swift` (router), `LaunchView`, `PairingView` (+ manual address), `ConnectingView`, `CockpitView` (tach roundel, retry offer on Next), `ControlsView` |

The removed files are `ReceiverSetupView`, `DrivingView` and `ControlsSheet`.

**Not verified yet:**
- The debug self-test result in the console.
- The on-device walkthrough.
- A scan against `python -m coach --track fixtures/track_monza.json --inputs`.
- A retry offer lighting Next.
- VoiceOver.

**No unit-test target:** the pairing vectors run at launch in debug builds instead.
