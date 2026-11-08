# Race history

History is opt-in. The coach queues scored events to a SQLite worker; neither disk writes nor network requests run in the telemetry callback. SQLite is the source of truth. An optional second worker copies versioned rows to SpacetimeDB. Spectators subscribe to that copy.

## Start locally

```powershell
uv sync --dev
uv run python -m coach --telemetry sim --reset sim --history --driver-name Kevin
```

Open the dashboard at `http://127.0.0.1:8020`. Its History panel lists saved passes. The full viewer is at `http://127.0.0.1:8020/history-viewer/`. Stop and restart with the same data directory and driver name to see prior sessions. Add `--agent` to give Nemotron the `get_driver_history` read tool and a past-session evidence packet. It works without SpacetimeDB.

`--data-dir` defaults to `data/`; the database is `history.sqlite3` there. `--history` defaults off. Raw telemetry is saved only with the existing `--record` flag, separately under `data/recordings/`.

AC drivers use the static-memory player name, track, and car. `--driver-name` overrides the name. A stable UUID derived from source and name lets returning drivers keep their history; use `--driver-id <UUID>` when two people share a name. Reuse that UUID when changing a driver's name. Simulator and replay sessions have an unknown car unless their source provides one; they do not mix with real-car history.

Session boundaries cover coach start/stop, New session, a new pass after DONE, Retry after DONE, and Resume. A reference selection updates the original lap. Attempt/decision labels are retained for debugging, while database keys are independent UUIDs.

## Enable live sync

Install the [official SpacetimeDB CLI](https://spacetimedb.com/docs/quickstarts/typescript/). The module and generated bindings use **SpacetimeDB 2.14.1**. For development use Node **24.22.1+** on the 24.x line, or a version allowed by the SDK's `engines` field. The demo PC needs only Python and the CLI for publishing; the viewer assets are committed.

From the repository root:

```powershell
npm --prefix spacetime ci
spacetime publish YOUR-DATABASE --module-path spacetime --server maincloud
```

Set these variables in the shell that starts the coach:

```powershell
$env:SPACETIME_URL = 'https://maincloud.spacetimedb.com'
$env:SPACETIME_DB = 'YOUR-DATABASE'
$env:SPACETIME_TOKEN = '<stable coach identity token>'
uv run python -m coach --history --telemetry sim --reset sim --driver-name Kevin
```

Use a SpacetimeDB identity token, not an NVIDIA token. Keep it private and stable across coach restarts. An authenticated identity can be created via `POST /v1/identity` on your SpacetimeDB server; save its returned token securely. The [HTTP authentication documentation](https://spacetimedb.com/docs/http/authorization/) describes token use. Never put the writer token in the viewer URL, browser storage, committed files, or an iPhone setting.

**Claim the database before sharing it:** the first successful `register_coach` call becomes the sole writer. The sync worker makes this call first. Anyone who reaches an unclaimed database could claim it, so start the coach and verify sync before exposing the spectator link. Later calls from that same identity are harmless; other identities cannot register again or write any row. Losing that token requires an operator migration; restarting the coach does not transfer ownership.

All five history tables are public, as specified in the plan; the owner table is private. Driver names and measured history are visible to viewers. The local dashboard should be used on the trusted rig/LAN, like its existing coach controls.

With any sync variable missing, sync is off and local history still works. Outages retain rows in SQLite and retry with 1–60 second backoff. New rows wake the worker immediately; a five-second poll catches anything missed. It sends drivers before sessions, then laps with their traces atomically, then decisions. A revision check prevents an old HTTP response from acknowledging a newer local edit. Restarting with the same database and token drains the retained rows.

The `start_session`, `end_session`, and `set_plan` reducers accept the same full versioned session row. The outbox uses `start_session` to reconcile all session changes, including closure and plan updates, in one idempotent call. Reducer arguments are a positional JSON array containing one JSON string, except `register_coach`, which takes `[]`.

```powershell
spacetime sql YOUR-DATABASE 'SELECT * FROM lap' --server maincloud
```

For a local server, use the vendor CLI's `spacetime start` or its Docker image and set `SPACETIME_URL` to that server's HTTP origin. Use the race PC's LAN address for other devices; `localhost` on a phone refers to the phone. Local hosting has no public spectator URL by itself.

## Viewer and QR code

The dashboard embeds the subscription viewer when a server URL and database are configured. The standalone viewer also works against local SQLite without cloud settings. It provides driver/session filters, best valid section, lap metrics and coach output, brake-board averages across sessions, and a leaderboard grouped by **track, car, and corner**. Invalid passes never enter best times or leaderboards. Times refer to scored corner sections, not full laps.

The leaderboard QR opens a read-only viewer URL with public connection settings. For internet access, host the contents of `coach/static/history/` on a static HTTPS host and set:

```powershell
$env:HISTORY_PUBLIC_URL = 'https://YOUR-HOST/history-viewer/'
```

The QR adds the selected server, database, track, car, and corner to that URL. A standalone static viewer can also be opened with `?server=https%3A%2F%2Fmaincloud.spacetimedb.com&db=YOUR-DATABASE&view=leaderboard`. No writer token is needed. Maincloud hosts the database; it does not automatically host this project's static page.

The viewer subscribes to lightweight tables. Best-lap trace rows are fetched on demand. In the embedded dashboard, “Show best-lap ghost” draws the saved trace under the baseline/live retry trace. After a connection loss, the UI marks cached results as stale and reconnects; the coach-hosted viewer can fall back to local history.

## iPhone cockpit

Build the updated `phone/stealth-racing` project in Xcode and connect to a coach running with `--inputs --history`. The cockpit shows **Last section** and **Best today**, scoped to that driver, track, car and corner.

The coach sends a `race_history` JSON datagram after each steering acknowledgement, with cached last/best times and public cloud coordinates. Paired phones receive signed history packets, and unpaired phones receive plain JSON when the receiver allows unpaired input. Older apps ignore that datagram. The new app works from local packets offline. When a new lap UUID arrives with cloud settings, it polls public HTTP SQL up to four times while the outbox catches up. Steering continues during those reads. Invalid latest passes show no time. Today uses the local calendar day on each device. Keep the rig and phone in the same timezone for matching best-today values.

Swift compilation and on-device layout/network checks require macOS/Xcode and remain a deployment check.

## Rebuild and verify

From the repository root:

```powershell
uv run pytest -q
npm --prefix spacetime ci
npm --prefix spacetime test
npm --prefix spacetime run check
spacetime build --module-path spacetime
spacetime generate --lang typescript --module-path spacetime --out-dir history-viewer/src/module_bindings
npm --prefix history-viewer ci
npm --prefix history-viewer test
npm --prefix history-viewer run build
```

Commit generated bindings and `coach/static/history/` after schema or viewer changes. The dashboard never requires npm on the demo PC.

For real HTTP/auth and browser tests, start a local server and publish a **fresh disposable database for each run**; the tests claim its writer identity. Do not point these tests at your booth database.

```powershell
spacetime publish history-http-test --module-path spacetime --server local
$env:HISTORY_TEST_URL = 'http://127.0.0.1:3000'
$env:HISTORY_TEST_DB = 'history-http-test'
uv run pytest tests/test_history_live.py -q

spacetime publish history-browser-test --module-path spacetime --server local
$env:HISTORY_TEST_DB = 'history-browser-test'
cd history-viewer
npx playwright install chromium --only-shell
npm run test:e2e
```

The Python integration test checks real reducer calls, SQL representation, and second-identity denial. The browser test checks local persistence rendering, two simultaneous live viewers, QR generation, a sub-second local-server update, safe name rendering, and trace retrieval. Maincloud latency, real Wi-Fi disconnection, rig session soak, and native iPhone checks still need the deployment environment.

SQLite commits survive restart; events still in memory at a forced process kill cannot be recovered. Normal stop drains the worker. A machine shutdown or process kill may leave a session without `ended_at`; its saved laps remain readable. Keep the SQLite file and its WAL together while running; use SQLite's backup API for a live backup.
