# SpacetimeDB history for the local coach

Goal: preserve racing sessions, scored attempts, laps, and coaching decisions across trusted PCs while the coach and dashboard continue to run locally.

Architecture: attach an optional background sync service to the coach's existing events. Save compact records to a local outbox, upload them to a TypeScript SpacetimeDB module, and expose cached cloud history through the existing local dashboard. Assetto Corsa shared memory, game controls, Rev, speech, and Brev inference keep their current connections.

Tech stack: Python 3.11+, existing asyncio/aiohttp, a file-based outbox and read cache, TypeScript SpacetimeDB module, existing HTML/JavaScript dashboard. Use HTTP for low-volume writes and paginated history reads; validate this transport before integrating it. No frontend framework migration or Python SDK is required for this approach.

Status: proposed design and implementation plan; no integration code or cloud resources created. Shared-history UI is the proposed final phase; it can be omitted for an upload-only first version.

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
- Cloud uploads exclude raw telemetry, full traces, model reasoning, hardware pairing links, device secrets, and game commands. Existing local recordings and references remain local.
- Single-corner and whole-track modes must both work. Store simulator/replay/AC source labels so demo results are distinguishable.

## File ownership map

| Proposed file | Responsibility |
| --- | --- |
| `spacetime/src/index.ts` and generated module package/config files | Tables, authorized writers, reducers, paginated history procedures |
| `coach/cloud_records.py` | Allowlisted event-to-record conversion, versioned contracts and IDs |
| `coach/cloud_outbox.py` | Background atomic file writes, acknowledgement, quarantine, restart recovery |
| `coach/cloud_client.py` | aiohttp transport, serialization, authentication and error classification |
| `coach/cloud_sync.py` | Capture buffer, ordered upload worker, lifecycle, read cache and status |
| `coach/app.py` | Subscribe/unsubscribe sync service and report its status |
| `coach/__main__.py` | Parse environment configuration and pass telemetry source metadata |
| `coach/dashboard.py` | Local history/status endpoints |
| `coach/static/index.html` | History list, session details, refresh and sync status |
| `tests/test_cloud_records.py`, `tests/test_cloud_outbox.py`, `tests/test_cloud_sync.py`, `tests/test_cloud_history.py` | Contract, durability, failure, lifecycle and dashboard verification |
| `docs/SPACETIMEDB.md` | Setup, identity provisioning, publication, second-PC setup and recovery |

## Record contracts and ownership

All cloud records use a schema version, globally unique record ID, session ID, client capture timestamp and server receipt timestamp. Device IDs are random local identifiers, not a machine fingerprint. The module derives the writer identity from authenticated context rather than a client-supplied owner field.

| Table | Stored data |
| --- | --- |
| `sessions` | Session UUID, owner identity, device ID, start/end timestamps, source, mode, configured track, actual track/car when available, open/closed/incomplete status |
| `laps` | Session, lap number, validity/reason, nullable lap time, delta and compact corner summaries |
| `corner_attempts` | Session, capture sequence, local attempt ID, corner ID, role, validity/reason and scored Attempt metrics |
| `coaching_decisions` | Session, decision ID, attempt ID, corner ID, action, drill/target, cue, reminder, verdict, summary, provider/model, mode and latency |
| `authorized_writers` | Administrative identity allowlist; only the module publisher may grant or revoke access |

The existing local attempt IDs are not globally unique. Cloud IDs must include the unique session and capture occurrence; retain local attempt IDs as source references. A new process creates a new session. The explicit `new_session` command closes the old cloud session and opens a new one; reset/retry/resume events alone do not create sessions.

Reducers `record_session`, `record_lap`, `record_attempt`, and `record_decision` validate ownership, types, limits and schema version. Identical replay of an existing result record is a success; conflicting contents or an owner mismatch is rejected. Only session lifecycle/metadata updates are mutable: give each update a monotonically increasing session revision, treat an older revision as an acknowledged no-op, and reject conflicting contents at the same revision. This prevents a late start message from reopening a finished session. Preserve per-session capture order across outbox recovery and upload each session before its child records.

Use private tables, publisher-only reducers `authorize_writer` and `revoke_writer`, and owner-filtered read procedures `list_sessions` and `get_session`. For the first version, trusted PCs that should see the same history use the same authorized application identity. Unrelated identities must not read or change those sessions. Supporting separate team-member identities and membership management is a later feature.

## Implementation sequence

Each implementation slice starts with the listed failing behavior test, followed by the smallest code change and a passing rerun. Commit coherent passing slices. The commands below name proposed tests to create during implementation; they do not exist yet.

- [ ] **1. Prove the transport and identity contract.** Create the TypeScript module in `spacetime/` and publish it to a local SpacetimeDB server. Exercise a reducer and a read procedure from Python using aiohttp, actual wire-format arguments, a stable Bearer identity, and durability confirmation. Verify the response format, nullable metrics, authenticated reads and repeated requests. Pin the working CLI/module version. Acceptance: Python writes one record and reads it back; a second identity is denied. Do not connect the coach until this round trip passes.

- [ ] **2. Implement session and record contracts.** Test projection of real `run`, `track_lap`, and `decision` payloads from single-corner and track modes, repeated local attempt IDs across sessions, invalid/null lap times, source labels and removal of excluded fields. Verify that `corner_event` and `retry_judged` alone do not generate duplicate scored attempts. Confirm which retry paths already emit `run`; add a single explicit completed-attempt hook only for a path that lacks one. Run `uv run pytest -q tests/test_cloud_records.py`; expected exit 0 with all contract cases passing.

- [ ] **3. Implement tables and server validation.** Add the four history tables, private writer allowlist, four record reducers, two publisher-only authorization reducers and two read procedures. Reject unknown writers, cross-owner references, unsupported schema versions, non-finite numbers and oversized payloads (32 KiB per record). Test an identical duplicate write, a conflicting duplicate write, null invalid-lap timing, stale session revisions and deletion/recreation of local attempt IDs under a different session. Paginate session history with a stable `(started_at, session_id)` cursor and limit pages to 50. Acceptance: authorized records persist, replay does not duplicate data, and a second identity cannot list or mutate the first identity's sessions.

- [ ] **4. Implement the durable outbox.** Save record files under `data/cloud/outbox/` through a background worker using same-directory temporary files and atomic rename. Remove a file only after confirmed cloud success; put permanently invalid records under `data/cloud/rejected/`. Recover unacknowledged records after a process restart. Keep a bounded in-memory capture buffer; if it fills or the disk fails, mark capture incomplete and show the count rather than blocking telemetry. Records committed to the outbox survive restart; an abrupt crash can lose records still in the memory buffer, and the UI/docs must state that boundary. Run `uv run pytest -q tests/test_cloud_outbox.py`; expected exit 0 covering crash/restart, duplicate acknowledgement and disk failures.

- [ ] **5. Implement asynchronous syncing and configuration.** Proposed environment variables are `SPACETIMEDB_URL`, `SPACETIMEDB_DATABASE`, and `SPACETIMEDB_TOKEN`. With none set, cloud sync is disabled. Partial configuration reports a configuration error while the local app remains usable. Use one ordered uploader, a 5-second request timeout, and jittered backoff capped at 30 seconds for network errors, 429 and 5xx; honor a longer valid Retry-After. Pause uploads on 401/403 until credentials are corrected and the app restarted. Classify module validation rejections separately from transport failures. Keep parent session failures from being bypassed. Run `uv run pytest -q tests/test_cloud_sync.py`; expected exit 0 including timeout-after-commit followed by duplicate-safe replay.

- [ ] **6. Connect the lifecycle and local status.** Construct the optional service in `coach/__main__.py`, subscribe through `CoachApp.subscribe`, and keep the callback limited to projection/enqueue. Report disabled/syncing/synced/offline/auth-error/storage-error states, pending and rejected counts, last successful upload and capture completeness. On graceful stop, allow at most 2 seconds for local persistence; leave network work in the outbox, mark the session ended when possible, and close workers/client cleanly. An interrupted process remains open or becomes stale in history instead of being falsely marked complete. Run the cloud tests plus `tests/test_coach_app.py` and `tests/test_pitpal.py`; expected exit 0 with coaching and overlay behavior intact.

- [ ] **7. Add local History UI if shared reads are wanted.** Python calls `list_sessions`/`get_session`, applies owner checks server-side, and saves successful responses under `data/cloud/cache/`. Add `GET /history` and `GET /history/{session_id}` for cached reads, plus `POST /history/refresh` to schedule a background cloud fetch. Cache entries are separated by cluster, database and identity. Render session source, track/car, laps, validity, coaching advice and last refresh time. Preserve a previously cached page on cloud failure; distinguish empty history from unavailable history. Never return the token or internal error details to the browser. Run `uv run pytest -q tests/test_cloud_history.py`; expected exit 0 for initial empty state, stale cache, pagination, escaping untrusted strings and two-PC history access.

- [ ] **8. Verify locally, then publish only the database module.** Run the cloud tests and existing coach/overlay regressions. In simulation, capture a lap, disconnect database networking, create more results, restart the coach, reconnect and check exact record counts. Repeat with a second trusted PC; history should appear through its localhost dashboard. From the module project directory, run `spacetime login` and `spacetime publish pitpal-history --server maincloud`; expected result is a published database identity. Configure runtime tokens separately on each PC. Do not use a delete-data publication flag. Maincloud smoke checks repeat duplicate writes and cross-identity denial before the feature is enabled for a game session.

## Completion checks

- An unconfigured installation starts with current local behavior.
- Database loss does not block telemetry, controls, speech, coaching or the existing WebSocket.
- A record acknowledged after a lost response is replayed without duplication.
- Validity and source labels survive the complete write/read path.
- The same authorized identity can retrieve history from another PC; a different identity cannot.
- Tokens and pairing links do not appear in cloud records, dashboard responses, logs or commits.
- The local dashboard remains at port 8020 and inference continues through the current Brev tunnel.
- Only the SpacetimeDB module needs cloud publication; a public website is outside this scope.

## Current reference material

- [HTTP reducer/procedure calls and transport caveats](https://spacetimedb.com/docs/http/database/)
- [Bearer tokens and stable identities](https://spacetimedb.com/docs/http/authorization/)
- [Private tables and access permissions](https://spacetimedb.com/docs/tables/access-permissions/)
- [Procedures for authorized history results](https://spacetimedb.com/docs/functions/procedures/)
- [Maincloud publication](https://spacetimedb.com/docs/how-to/deploy/maincloud/)

HTTP is a deliberate low-volume first implementation, not a high-frequency telemetry transport. The official docs describe its performance limitations relative to SDK WebSockets; transport acceptance is therefore an explicit first gate.
