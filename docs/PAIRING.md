# Phone pairing (QR)

Goal: the **only** setup step is "phone and race PC on the same Wi-Fi". The PC shows a QR code; the
Stealth Racing app scans it and connects. No IP to type, no Bonjour, and only a phone that scanned
the code can drive the car.

Receiver side: done (`coach/pairing.py`, `coach/inputs.py`). App side: plan below.

## Using it on the race PC

```
uv run --with vgamepad --with pyserial python -m coach --telemetry ac --reset udp --inputs
```

With `--inputs` the coach prints the pairing QR in the terminal and shows it on the dashboard
(http://127.0.0.1:8020, "Pair a phone"; also `/pair.svg`). **New pairing code** on the dashboard
replaces the key; every phone must scan again.

| `--pairing` | Who can drive |
| --- | --- |
| `optional` (default for now) | the current unpaired app, **until the first phone pairs**; from then on, like `required` (no unsigned packets from anyone). "New pairing code" clears the pairing and reopens it. |
| `required` | only phones that scanned the code. Switch to this once the app ships pairing. |
| `off` | plain UDP, as before (no QR) |

The key lives in `data/pairing.json` (git-ignored), so a phone stays paired across coach restarts.

### Network requirements (the one-time PC setup that pairing cannot remove)

- **Windows Firewall** must allow inbound UDP 5005 (the existing "NomadSim UDP" rule). Make sure
  it covers the network profile in use: venue and hotspot networks are usually "Public".
- **Client isolation**: some venue Wi-Fi blocks devices from reaching each other. Pairing can't fix
  that; use the iPhone's Personal Hotspot (the PC joins it, the QR then lists the hotspot address).
- The QR lists up to four LAN IPv4 addresses of the PC (VPN and virtual adapters can show up too).
  The app tries them all and keeps the first that answers.

## Protocol (v1)

QR content: `nomadsim://pair?v=1&h=<ipv4>[,<ipv4>...]&p=<port>&k=<key>&n=<pc name>&id=<receiver id>`

- `k`: 16 random bytes, base64url without padding. `id`: first 8 hex digits of SHA-256(key).
- A tag is the lowercase hex of the first N bytes of HMAC-SHA256.

| Step | Direction | Packet | Tag |
| --- | --- | --- | --- |
| hello | phone → PC | `h1,<pn>,<tag32>` | HMAC(K, `h1,<pn>`), 16 bytes |
| welcome | PC → phone | `w1,<pn>,<rn>,<name>,<tag32>` | HMAC(K, `w1,<pn>,<rn>,<name>`), 16 bytes |
| session key | both | S = HMAC(K, `s1,<pn>,<rn>`) (32 bytes) | |
| control | phone → PC | `v1,<seq>,<steer>,<throttle>,<brake>,<tag16>` | HMAC(S, packet), 8 bytes |
| button | phone → PC | `evt,<id>,<command>,<phase>,<tag16>` | same |
| ack | PC → phone | `ack,<seq>,<tag16>` | same |
| rehello | PC → phone | `rehello` (unsigned hint) | |

`pn` / `rn`: 16 lowercase hex digits of fresh randomness from the phone / the PC.

Rules:
- The phone must check the welcome's tag and that `pn` is its own before trusting the receiver.
- In a session, v1 `seq` must keep increasing (the receiver drops anything not newer: no replays).
  A new hello starts a new session and `seq` may start again at 0.
- `rehello` means "no session for you" (receiver restarted, or a new code was made). The app should
  send a new hello without interrupting the driver; if the hello is ignored, the code changed: rescan.
- Everything else is the existing protocol, unchanged: ~100 Hz v1, events sent 3× per id, ack every
  30th seq.

What it protects (in `required` mode, or in `optional` once a phone has paired): nobody without
the QR can steer, press buttons, or fake "Receiver confirmed". A recorded hello can't be replayed
to knock a paired phone off its session.
What it doesn't: packets are signed, not encrypted (steering values are not secret), and anyone who
sees the QR can pair. Show it on the PC's own screen; regenerate it if it was shared.

### Test vectors

Use these to unit-test the app's CryptoKit code against the receiver.

```
K (hex)        000102030405060708090a0b0c0d0e0f
K (base64url)  AAECAwQFBgcICQoLDA0ODw
QR URI         nomadsim://pair?v=1&h=192.168.1.20&p=5005&k=AAECAwQFBgcICQoLDA0ODw&n=RACE-PC&id=be45cb26
pn / rn        0011223344556677 / 8899aabbccddeeff
hello          h1,0011223344556677,1848502b318a1b49b374b83e1078ecae
welcome        w1,0011223344556677,8899aabbccddeeff,RACE-PC,85423be883ccfd4d1085c0216ffab5a0
S (hex)        0bcf001ecf747095b6294c23a8d326db5f2a29b66d9747dfd193b467d1903144
signed v1      v1,30,-0.5,0.75,0,8e0946fe5fa26537
signed evt     evt,12,coach_next,tap,bcb0c5fa3f6514d3
signed ack     ack,30,bb436dcdf47754f4
```

`coach.pairing.PhoneClient` is a reference phone implementation in Python (used by the tests).

## App plan (Swift)

Keep the UI change small: one new entry point on the pairing screen, plus deep links.

1. **Scan entry points**
   - A **Scan QR code** button at the top of the pairing screen's receiver list, opening a scanner
     sheet: VisionKit `DataScannerViewController` (`recognizedDataTypes: [.barcode(symbologies: [.qr])]`)
     wrapped in `UIViewControllerRepresentable`; fall back to `AVCaptureMetadataOutput` when
     `DataScannerViewController.isSupported` is false.
   - Register the `nomadsim` URL scheme (`CFBundleURLTypes` in `Info.plist`) and handle it with
     `.onOpenURL`, so pointing the iPhone **Camera app** at the QR and tapping the banner opens the
     app and connects. This is the zero-tap path for most people.
   - Add `NSCameraUsageDescription` to `Info.plist` (the project already uses an `Info.plist` for the
     Bonjour key, so the project file doesn't need to change).
2. **`PairingCode`** (new file): parse the URI with `URLComponents`, base64url-decode `k` (16 bytes),
   validate `v=1`, hosts, port. Reject anything else with "Not a NomadSim code".
3. **`PairingStore`**: save `{id, name, hosts, port, key}` in the Keychain (generic password,
   service `nomadsim.pairing`, account = id). Paired receivers appear first in the receiver list
   (existing "Last used" styling); swipe to forget.
4. **`PairedConnector`**: for each host, open an `NWConnection(.udp)` and send the hello; accept the
   first welcome whose tag and `pn` check out (`HMAC<SHA256>` from CryptoKit, compare tags in
   constant time), cancel the rest. Retry every 0.5 s for ~3 s, then show "Couldn't reach RACE-PC.
   Same Wi-Fi? Firewall allows UDP 5005?" with a Rescan option.
5. **`ReceiverSession`**: add an optional `sessionKey`.
   - Sign every outgoing v1 and evt packet (`,<16 hex>`).
   - Accept an `ack` only if its tag verifies; the existing "Receiver confirmed" logic otherwise stays.
   - On `rehello`: re-run the hello on the same connection, keep the driving state, and resume
     signing with the new key (seq restarts at 0).
   - Unpaired connections (Bonjour / manual address) keep working unchanged while the receiver is in
     `optional` mode.
6. **Status**: no new screens. The status pill can show a small lock icon for a paired connection.
7. **Tests**: unit tests for `PairingCode` parsing and the crypto against the test vectors above;
   then an on-device run against `python -m coach --telemetry sim --reset sim --inputs --pad none
   --arduino off --pairing required`.
8. **Rollout**: ship the app, confirm it drives the game PC, then make `--pairing required` the
   default on the receiver.
