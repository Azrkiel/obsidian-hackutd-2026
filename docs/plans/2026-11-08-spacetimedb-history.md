# SpacetimeDB history for the local coach

Goal: preserve racing sessions, scored attempts, laps, and coaching decisions across trusted PCs while the coach and dashboard continue to run locally.

Architecture: attach an optional background sync service to the coach's existing events. Save compact records to a local outbox, upload them to a TypeScript SpacetimeDB module in the user's Maincloud account, and expose cached cloud history through the existing local dashboard. Each PC receives a separate runtime identity; registered devices in this database can read shared history, while each writer owns its uploads. Assetto Corsa shared memory, game controls, Rev, speech, and Brev inference keep their current connections.

Tech stack: Python 3.11+, existing asyncio/aiohttp, a file-based outbox and read cache, TypeScript SpacetimeDB module with Vitest tests, and the existing HTML/JavaScript dashboard. Add `keyring` through an optional Python `cloud` extra for Windows Credential Manager storage. Use HTTP for low-volume writes and paginated history reads; validate this transport before integrating it. No frontend framework migration or Python SDK is required for this approach.

Status: steps 1-10 implemented and verified against a local SpacetimeDB 2.14.1 server (2026-11-08). Step 11 (Maincloud publish + PC enrollment) needs the account owner's login; step 12 docs are in docs/SPACETIMEDB.md. It includes shared-history UI and a history-only launcher for the second PC. This revision replaces the earlier shared-token shortcut with separate device identities and explicit device registration.

## Responsibility and deployment boundaries

| Component | Where it runs | Owner/setup |
| --- | --- | --- |
| Assetto Corsa, controls, coach, Rev | Windows game PC | Existing game setup |
| Nemotron/vLLM | Existing Brev GPU | Existing Brev account and tunnel |
| Database module and stored history | SpacetimeDB Maincloud | User's SpacetimeDB account |
| Full dashboard | `http://127.0.0.1:8020` on the game PC | Started by the coach |
| History-only dashboard | `http://127.0.0.1:8020` on the second PC | New history-only launcher |
| Retry files/cache | Each PC's ignored `data/cloud/` directory | Offline support, not the shared database |

The database account belongs to the user, not to the assistant. The user completes account login and selects acceptable cloud billing settings. Implementation and local tests can be completed before that login. Only the module is published to Maincloud; there is no public website deployment and no need to move the Python coach to a cloud host.

GitHub holds source, schema, tests and instructions. Maincloud holds shared driving history. Local files hold current recordings, upload recovery state and cached cloud reads. Cloning the repo on another PC does not copy credentials or private session data.

## Account, publication and device lifecycle

1. **User-owned account.** Open SpacetimeDB's console and sign in using the user's GitHub or Google login. Review its current usage/billing controls; do not enable a paid plan or automatic payment as part of code implementation.
2. **Publisher workstation.** Install the SpacetimeDB CLI and a current supported Node.js runtime. Run `spacetime login` before publishing locally or to Maincloud so the database is associated with the intended recoverable account identity. Publisher credentials stay on this workstation.
3. **Module creation.** Build and test the proposed TypeScript module under `spacetime/`. On first publish, its `init` reducer registers `ctx.sender` as the initial administrator. Do not confuse the publisher identity with the database's own identity. Subsequent module updates must preserve authorization rows and data.
4. **Cloud publication.** From the module directory, publish a uniquely named database owned by that account. The planned name is `pitpal-history`; if it is unavailable, choose a new project name instead of overwriting another database. Record the actual published database identity in local configuration and the deployment notes. Run without a data-deletion flag.
5. **Game-PC enrollment.** The proposed setup helper requests one runtime identity/token from the target cluster, saves the token in Windows Credential Manager, and writes only non-secret profile information to `data/cloud/config.json`. It displays the public identity and device ID for registration, never the private token.
6. **Explicit registration.** Using the publisher's CLI login, the administrator calls the module's `register_device` reducer with that public identity, device ID, label, and `writer` role. The game PC cannot self-approve or grant access to another identity. Test actual CLI argument encoding against the local module before documenting the command.
7. **Second-PC enrollment.** Repeat setup on the second PC to obtain its own runtime identity. Register it as a `viewer` for history only, or as a `writer` if it will also run the game. It points to the same cloud database. No game files or Brev tunnel are required for history-only viewing.
8. **Revocation/replacement.** Administrators disable a device using `revoke_device`. Its subsequent cloud reads/writes fail; other registered devices continue to work. To replace a lost credential, issue a new identity, register it and revoke the old identity. Do not relabel an existing unacknowledged outbox as a new identity.

For this trusted-PC hackathon version, server-issued runtime tokens are a deliberate development credential choice. SpacetimeDB documents them as non-expiring and unrecoverable if lost, and recommends an OIDC provider for production. Before opening this app to general users, replace this enrollment path with SpacetimeAuth/OIDC sign-in, refresh and logout. The cloud-history feature is not production account management.

Publishing commands, executed only after the module exists and local checks pass:

```bash
spacetime login
spacetime publish pitpal-history --server maincloud
```

Expected outcome: the CLI prints a published database identity and it appears under the user's account. A successful CLI login alone does not grant runtime devices access; registration is a separate module permission check.

## Data and failure flow

```text
Assetto Corsa --shared memory--> local Python coach <--> localhost:8020 + Rev
                                      |
                                      +--> localhost:8000 --Brev tunnel--> Nemotron
                                      |
                         allowlisted result events
                                      v
                         bounded capture buffer
                           |                 |
                     background writer      full/disk error
                           |                 v
                    durable file outbox   show incomplete capture;
                           |             keep coaching running
                           v
                    HTTPS uploader --> SpacetimeDB module
                           |                    |
                 timeout/429/5xx          durable success
                           |                    v
                 retain + backoff          acknowledge file
                           |
                  401/403 -> pause sync; show authentication error
                  invalid record -> quarantine; show rejected count

User opens History at localhost:8020
              |
              v
GET /history -> local cache -> sessions/results displayed
              |
POST /history/refresh -> background authorized cloud read
              |                          |
          unavailable              successful response
              |                          v
       show stale timestamp      update cache + history_updated event
```

## Scope and alternatives

- Recommended: optional background uploads plus cached, manually refreshed history. This fits the existing Python app and its low result-event rate.
- Smaller first delivery: uploads only; inspect stored records through SpacetimeDB until the History UI is implemented.
- A direct browser SDK subscription is a future choice for continuous shared live state. It adds browser authentication and generated bindings and is unnecessary for paginated session history.
- One database is one trusted workspace in this version. All enabled registered devices can read its history. A writer may append only to its own sessions; a viewer cannot upload. Separate users with independent private workspaces, remote game commands, online leaderboards, automatic coaching from cloud history and public website hosting are separate features.
- Cloud uploads exclude raw telemetry, full traces, model reasoning, hardware pairing links, device secrets, and game commands. Existing local recordings and references remain local.
- Single-corner and whole-track modes must both work. Store simulator/replay/AC source labels so demo results are distinguishable.

## File ownership map

| Proposed file | Responsibility |
| --- | --- |
| `spacetime/src/index.ts` and generated module package/config files | Tables, authorized writers, reducers, paginated history procedures |
| `coach/cloud_records.py` | Allowlisted event-to-record conversion, versioned contracts and IDs |
| `coach/cloud_config.py` | Validated cluster/database profile, identity binding and optional cloud settings |
| `coach/cloud_credentials.py` | Credential Manager access, runtime token loading and redaction |
| `coach/cloud_outbox.py` | Background atomic file writes, acknowledgement, quarantine, restart recovery |
| `coach/cloud_client.py` | aiohttp transport, serialization, authentication and error classification |
| `coach/cloud_sync.py` | Capture buffer, ordered upload worker, lifecycle and upload status |
| `coach/cloud_history.py` | Paginated history requests, disk cache and read freshness |
| `coach/history_routes.py` | Shared same-origin history routes for the full coach and viewer launcher |
| `coach/history.py` | History-only localhost server without telemetry, controller inputs or inference |
| `coach/app.py` | Subscribe/unsubscribe sync service and report its status |
| `coach/__main__.py` | Parse environment configuration and pass telemetry source metadata |
| `coach/dashboard.py` | Local history/status endpoints |
| `coach/static/index.html`, `coach/static/history.html`, `coach/static/history.js` | History link/page, session details, refresh, sync status and shared viewer UI |
| `scripts/spacetime_device.py` | Setup/status/export commands for per-PC runtime credentials and backups; never publishes a database |
| `scripts/spike_spacetime.py` | Local/cloud round-trip and durability verification without game dependencies |
| `spacetime/src/history.test.ts` | Module permissions, idempotency, ordering, pagination and validation tests |
| `tests/test_cloud_config.py`, `tests/test_cloud_records.py`, `tests/test_cloud_outbox.py`, `tests/test_cloud_sync.py`, `tests/test_cloud_history.py` | Configuration, contracts, durability, failure, lifecycle and dashboard verification |
| `pyproject.toml`, `uv.lock` | Optional `cloud` dependency extra and resolved lockfile |
| `docs/SPACETIMEDB.md` | Setup, identity provisioning, publication, second-PC setup and recovery |

## Record contracts and ownership

All history records use a schema version, globally unique record ID, session ID, per-session capture sequence, client capture timestamp and server receipt timestamp. Store timestamps in UTC; use server receipt time for stable cross-device history ordering, since PC clocks can differ. Device IDs are random local identifiers, not a machine fingerprint. The module derives the writer identity and registered device ID from authenticated context rather than trusting client-supplied ownership. Persist owner/cluster/database binding beside outbox records and cached results.

| Table | Stored data |
| --- | --- |
| `sessions` | Session UUID, writer identity, device ID, revision, client/server start times, client end time, last server activity time, source, mode, configured track, actual track/car when available, open/closed/incomplete status |
| `laps` | Session, lap number, validity/reason, nullable lap time, delta and compact corner summaries |
| `corner_attempts` | Session, capture sequence, local attempt ID, corner ID, role, validity/reason and scored Attempt metrics |
| `coaching_decisions` | Session, decision ID, attempt ID, corner ID, action, drill/target, cue, reminder, verdict, summary, provider/model, mode and latency |
| `authorized_devices` | Identity primary key, unique device ID, label, admin/writer/viewer role and enabled state; initial admin is seeded from the first publisher |

The existing local attempt IDs are not globally unique. Cloud IDs must include the unique session and capture occurrence; retain local attempt IDs as source references. Preserve the originating session/context when scheduling a decision so a late asynchronous response is attached to the attempt that caused it, rather than whichever session is currently active. A new process creates a new session. The explicit `new_session` command closes the old cloud session and opens a new one; reset/retry/resume events alone do not create sessions. A changed track or car starts a new history session once confirmed from telemetry, while missing telemetry metadata remains unknown instead of being invented.

Reducers `record_session`, `record_lap`, `record_attempt`, and `record_decision` validate ownership, types, limits and schema version. Identical replay of an existing result record is a success; conflicting contents or an owner mismatch is rejected. Only session lifecycle/metadata updates are mutable: give each update a monotonically increasing session revision, treat an older revision as an acknowledged no-op, and reject conflicting contents at the same revision. This prevents a late start message from reopening a finished session. Preserve per-session capture order across outbox recovery and upload each session before its child records.

Use private tables, admin-only reducers `register_device` and `revoke_device`, and membership-checked read procedures `list_sessions` and `get_session`. Runtime registration permits writer/viewer roles only; it cannot grant admin or revoke the initial admin. Registration is idempotent for identical parameters and rejects reassignment of another device's ID. All enabled members may read shared history; only the creating writer may change session metadata or upload its children. Revoke access by disabling a row, preserving historical attribution.

Validate finite numbers, nullable values, UTF-8 text length and a 32 KiB per-record size limit before persistence and again in the module. Put full traces and reasoning outside the cloud record contract. Page sessions by `(server_started_at, session_id)`, at most 50 per request. Index child tables by session and sequence. Return at most 100 attempts/decisions per details page, with explicit next cursors; never load all historical sessions or an unbounded session into a single response.

## Configuration and proposed user commands

The following helper commands are planned interfaces, not implemented commands yet. Their docs become executable setup instructions only after the corresponding tests pass.

- `uv sync --extra cloud`: install the optional cloud credential-store dependency.
- `uv run --extra cloud python scripts/spacetime_device.py setup --label game-pc`: prompt for cluster/database, create a runtime identity, save its private token in Credential Manager and print the public enrollment values. Expected state: registered profile with access pending administrator registration. Re-running setup must not silently replace a valid identity or abandon pending uploads.
- `uv run --extra cloud python scripts/spacetime_device.py status`: verify the stored identity/token with the host, check module access, and print only public identity, role, database, counts and safe status.
- `uv run --extra cloud python scripts/spacetime_device.py export --output data/cloud/exports/history.json`: fetch every authorized history page and stream a versioned JSON backup through a temporary file, atomically replacing the destination only on complete success. Do not change an earlier backup on authentication, network or disk failure.
- `uv run --extra cloud python -m coach.history`: start the history-only server at `http://127.0.0.1:8020`. It must not start the telemetry reader, virtual controller or model warm-up.
- Normal game launch remains `PitPal.bat --voice windows`; a configured, enabled writer profile activates background history sync.

Local profile fields: cluster URL, published database identity, public runtime identity, device ID, label and `enabled`. A profile must be bound to the credential entry for that exact target. Environment overrides `SPACETIMEDB_URL`, `SPACETIMEDB_DATABASE`, and `SPACETIMEDB_TOKEN` are supported together for automated tests or a temporary session; no variable or token value is logged. Configuration is selected once at startup, not switched beneath an active session.

With no profile/overrides, the game coach runs with cloud sync disabled. A partial/invalid profile produces a configuration status error while game coaching remains usable. The history-only launcher displays a setup-required page when unconfigured. Credential-store failure has an explicit error and does not fall back to a plaintext token file. Each browser talks only to its own local Python server; no cloud credential is served to JavaScript.

## Implementation sequence

Each implementation slice starts with the listed failing behavior test, followed by the smallest code change and a passing rerun. Commit coherent passing slices. The commands below name proposed tests to create during implementation; they do not exist yet.

- [x] **1. Prove the transport and identity contract.** Create the TypeScript module in `spacetime/` and publish it to a local SpacetimeDB server. Exercise a reducer and a read procedure from Python using aiohttp, actual wire-format arguments, a stable Bearer identity, and durability confirmation. Verify the response format, nullable metrics, authenticated reads and repeated requests. Pin mutually compatible CLI, host, SDK and test-library versions; current module test utilities require SDK 2.12.0 or newer. Acceptance: a registered writer writes and reads one record, a registered viewer reads it, and an unregistered identity is denied. Do not connect the coach until this round trip passes.

- [x] **2. Implement session and record contracts.** Test projection of real `run`, `track_lap`, and `decision` payloads from single-corner and track modes, repeated local attempt IDs across sessions, invalid/null lap times, source labels and removal of excluded fields. Include a late decision after a session transition, unknown track/car metadata, simulated/replay source separation and the confirmed track/car transition rule. Verify that `corner_event` and `retry_judged` alone do not generate duplicate scored attempts. Confirm which retry paths already emit `run`; add a single explicit completed-attempt hook only for a path that lacks one. Run `uv run pytest -q tests/test_cloud_records.py`; expected exit 0 with all contract cases passing.

- [x] **3. Implement tables and server validation.** Add the four history tables, private device membership table, four record reducers, two admin-only registration reducers and two read procedures. Seed initial admin from the publisher in `init`. Reject unregistered/disabled identities, viewer writes, cross-writer mutations, unsupported schema versions, non-finite numbers and oversized payloads. Test admin-only registration/revocation, an identical duplicate write, a conflicting duplicate write, null invalid-lap timing, stale session revisions, reused local attempt IDs and paginated results larger than one page. From `spacetime/`, run `npm test` with `test` defined as `vitest run`; expected exit 0. The module harness tests policy, while live integration tests must verify actual token signatures and publication ownership.

- [x] **4. Implement the durable outbox.** Save record files under `data/cloud/outbox/` through a background worker using same-directory temporary files and atomic rename. Remove a file only after confirmed cloud success; put permanently invalid records under `data/cloud/rejected/`. Recover unacknowledged records after a process restart. Keep a bounded in-memory capture buffer; if it fills or the disk fails, mark capture incomplete and show the count rather than blocking telemetry. Records committed to the outbox survive restart; an abrupt crash can lose records still in the memory buffer, and the UI/docs must state that boundary. Run `uv run pytest -q tests/test_cloud_outbox.py`; expected exit 0 covering crash/restart, duplicate acknowledgement and disk failures.

- [x] **5. Implement device setup and configuration.** Add the `cloud` dependency extra, Credential Manager adapter, setup/status helper and target-bound non-secret profile. Test initial setup, idempotent setup, denied registration, store failure, partial overrides, profile disabled, revoked identity and changing cluster/database while pending files exist. Run `uv run --extra cloud pytest -q tests/test_cloud_config.py`; expected exit 0. A disposable live identity must verify with HTTP 204, show access pending before registration and acquire exactly its registered role afterward. No token may appear in stdout, browser output or a git-tracked file.

- [x] **6. Implement asynchronous syncing.** Use one ordered uploader, a 5-second request timeout, and jittered backoff capped at 30 seconds for network errors, 429 and 5xx; honor a longer valid Retry-After. Pause uploads on invalid/expired/revoked credentials until corrected and restarted. Classify module access denials even if the HTTP API wraps them in an application-level error. Classify validation failures separately; quarantine an invalid parent and its blocked children instead of retrying forever. Keep session creation before child uploads. Retain the original target/identity for old files after profile changes, and never upload them to a new target automatically. Run `uv run --extra cloud pytest -q tests/test_cloud_sync.py`; expected exit 0 including timeout-after-commit followed by duplicate-safe replay.

- [x] **7. Connect the lifecycle and local status.** Construct the optional service in `coach/__main__.py`, subscribe through `CoachApp.subscribe`, and keep the callback limited to bounded projection/enqueue with no network/disk work. Report disabled/syncing/synced/offline/auth-error/storage-error states, pending and rejected counts, last successful upload and capture completeness. On graceful stop, allow at most 2 seconds for local persistence; leave network work in the outbox, mark the session ended when possible, and close workers/client cleanly. An interrupted process remains open or becomes stale in history instead of being falsely marked complete. Run the cloud tests plus `tests/test_coach_app.py`, `tests/test_combined.py` and `tests/test_pitpal.py`; expected exit 0 with coaching and overlay behavior intact. A viewer profile does not subscribe a capture/upload worker.

- [x] **8. Add the shared History service and UI.** Python calls `list_sessions`/`get_session`, membership is checked in the module, and successful responses are saved under target/identity-specific `data/cloud/cache/`. Add `GET /history` and `GET /history/{session_id}` for paginated cached reads, `POST /history/refresh` to schedule a fetch, `GET /history/status` for refresh state and `GET /history-view` for the shared HTML page. Register fixed paths before the session-ID route. The dashboard gets a History link. Render device/source, track/car, lap validity, attempts, decisions and freshness. Preserve cached pages on temporary cloud failure; distinguish empty, not-yet-fetched and stale states. Escape all stored text. An explicit permission denial clears that identity's served history cache; it does not erase the game's own recordings. Read requests never wait on cloud I/O. Run `uv run --extra cloud pytest -q tests/test_cloud_history.py`; expected exit 0 covering these states and pagination without duplicates.

- [x] **9. Add the history-only launcher.** Implement `python -m coach.history` using the same credentials, history service and routes. Serve the History page at `/` as well as `/history-view`, listen on 127.0.0.1:8020 by default, and fetch history on initial page load or explicit Refresh with a short status poll only while fetching. It must not construct CoachApp, InputHub, telemetry sources, reset clients or Nemotron providers. Explain a port conflict instead of silently starting a second server. Extend `tests/test_cloud_history.py` to prove no game/model startup and same cross-PC records. Expected test exit: 0.

- [x] **10. Run complete local acceptance tests.** Run `uv run --extra cloud pytest -q` from the repo root and `npm test` from `spacetime/`; expected exit 0. Module tests and Python unit tests must not contact Maincloud. Against a disposable local server, use two registered identities and one outsider. Capture results, wait for local persistence, disconnect database networking, create/persist more results, restart the coach, reconnect and check exact record counts. Also kill during an in-memory write to verify that incomplete capture is reported within the documented durability boundary. Test replays, device revocation and profile changes. The second history-only process must show the cloud records while neither process has a Brev provider configured.

- [ ] **11. Publish under the user's account and enroll PCs.** Complete the account/publication/device lifecycle above, with the user performing the browser login. Record the deployed commit, module/CLI versions, database identity, admin public identity and public device registrations in `docs/SPACETIMEDB.md` or private deployment notes as appropriate; never record tokens. Verify that module updates preserve admin/device/session rows. Run a Maincloud round trip with each authorized device, then verify an outsider and revoked identity are denied before enabling the game session.

- [ ] **12. Deliver operating instructions and rollback.** Document first-PC setup, second-PC viewer setup, ordinary game launch, token loss/replacement, upload quarantine, cache freshness, backup/export and safe schema updates. Disabling the local cloud profile returns the game coach to local-only operation and preserves pending files. To roll back an app release, use the previous app commit with cloud disabled; do not assume a schema rollback is safe. Use additive schema changes and test against a copy/export before destructive migrations. Remove unused cloud resources only after a deliberate export and explicit data-deletion decision.

## Operational bounds and acceptance matrix

- Use a 256-record memory buffer and a 256 MiB local outbox budget. On limit exhaustion, retain unacknowledged files, stop accepting new cloud records, mark the session incomplete and keep local coaching alive. Resume capture only when capacity returns, preserving an explicit missing-data indicator.
- Keep a 50 MiB cloud-read cache and evict oldest cached pages first. Cache expiry is a freshness label, not evidence that a cloud record was deleted. Revocation prevents fresh reads but cannot retroactively erase files previously copied from a trusted PC.
- Keep acknowledged session history in Maincloud until explicitly deleted. Do not implement automatic cloud retention/deletion in this delivery. Monitor usage in the user's account; a database billing/quota failure becomes a retryable or paused sync status, not a game failure.
- Export paginated, authorized history to JSON for backup before schema changes. The export includes source IDs, record IDs and timestamps, and excludes runtime credentials. Import/migration of all old pre-integration JSONL traces is a separate task because those files do not consistently contain complete session/lap metadata.

| Scenario | Required outcome |
| --- | --- |
| Cloud not configured | Current local coaching works; setup-required state only in History |
| Database offline/slow | Local dashboard and Rev remain responsive; committed outbox records retained |
| HTTP success lost after commit | Same record replay succeeds without duplication |
| Process restart after persistence | Pending records upload to original identity/target |
| Credential invalid or revoked | Cloud operations pause; no browser token exposure; clear access error |
| Registered PC B viewer | Reads PC A's uploaded history; cannot write or change permissions |
| Registered PC B writer | Reads shared history and writes its own sessions; cannot mutate PC A's sessions |
| Unknown device | No history reads, uploads or registrations |
| Buffer/disk limit | Capture marked incomplete; game loop continues |
| Maincloud module update | Existing rows and device permissions preserved |
| Brev unavailable | Current model fallback behavior continues independently of history sync |

## Completion checks

- An unconfigured installation starts with current local behavior.
- Database loss does not block telemetry, controls, speech, coaching or the existing WebSocket.
- A record acknowledged after a lost response is replayed without duplication.
- Validity and source labels survive the complete write/read path.
- A second registered identity can retrieve shared history from another PC; an unregistered identity cannot. A registered viewer cannot write, and writers cannot mutate another device's sessions.
- Tokens and pairing links do not appear in cloud records, dashboard responses, logs or commits.
- The local dashboard remains at port 8020 and inference continues through the current Brev tunnel.
- Only the SpacetimeDB module needs cloud publication; a public website is outside this scope.
- The history-only launcher can show PC A's uploaded session on PC B without Assetto Corsa, a virtual controller, or Brev on PC B.
- PC A uploads a new session and is then shut down. PC B, with an empty cache and a separate registered identity, must fetch that session directly from Maincloud. A populated local cache alone is not accepted as cloud verification.

## Current reference material

- [HTTP reducer/procedure calls and transport caveats](https://spacetimedb.com/docs/http/database/)
- [Bearer tokens and stable identities](https://spacetimedb.com/docs/http/authorization/)
- [Runtime identity creation and verification](https://spacetimedb.com/docs/http/identity/)
- [Development-token limitations and production OIDC guidance](https://spacetimedb.com/docs/intro/faq/)
- [Private tables and access permissions](https://spacetimedb.com/docs/tables/access-permissions/)
- [Procedures for authorized history results](https://spacetimedb.com/docs/functions/procedures/)
- [Maincloud publication](https://spacetimedb.com/docs/how-to/deploy/maincloud/)
- [Module test harness and first-publisher identity](https://spacetimedb.com/docs/how-to/unit-testing/)

HTTP is a deliberate low-volume first implementation, not a high-frequency telemetry transport. The official docs describe its performance limitations relative to SDK WebSockets; transport acceptance is therefore an explicit first gate.
