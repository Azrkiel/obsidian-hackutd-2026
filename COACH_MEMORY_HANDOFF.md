# Coach memory handoff

Branch: `coach-memory`. Scope: coach memory M1–M4 from the supplied artifact,
plus the prompt/read-tool integration needed to use that memory. The artifact's
separate drill-registry and new-drills proposal is not implemented.

## Implemented

- **M1 — identity:** `--driver NAME`, dashboard Driver prompt and
  `{"type":"set_driver","driver":"NAME"}` over `/ws`. Names are trimmed,
  case-sensitive labels, not authenticated identities. Blank means anonymous.
  Anonymous sessions are recorded but history returns `{"error":"no driver"}`.
  Changing drivers finishes the old session without reassigning its laps.
- **M2 — corner safety:** each SQLite session stores a SHA-1 over gates,
  apex window, board zero and tolerances. History is scoped to driver and corner
  name. If any of the last three returned sessions has a different hash,
  `corner_changed` is true and times/tendencies are omitted; outcomes and
  summaries remain available. This deliberately suppresses all comparisons in
  a mixed group, including otherwise matching sessions.
- **M3 — tendencies:** computed on read from the last three sessions, excluding
  the current session. Each metric uses valid, comparable laps and the reference
  saved with each lap. A session contributes its mean delta; the result averages
  those session means and counts sessions whose mean is outside tolerance.
  Missing metrics do not contribute. Metrics/reference metrics are JSON, so
  existing profile metrics can be added to tolerances without adding SQL columns.
- **M4 — summaries:** rules write a deterministic line on DONE, new session,
  resume, driver switch or orderly shutdown. A model's closing summary replaces
  it only after `check_spoken` succeeds. Partial goals are marked `unfinished`.
- `get_driver_history` is an agent read tool. The plan prompt asks for it first
  and says not to repeat a previously met goal unless its current delta is over
  tolerance. Numeric evidence from tool results uses the existing validator.

Implementation: `engine/memory.py`, `engine/state.py`, `engine/agent_tools.py`,
`coach/app.py`, `coach/__main__.py`, `coach/static/index.html`.
No extra dependency or lockfile change. Storage is
`<data-dir>/coach-memory.sqlite3`; the default `data/` is Git-ignored.

## Verified here

Validation ran in Linux with Python 3.12.14 and uv 0.13.5.

| Check | Result and limits |
| --- | --- |
| Full suite | **207 passed, 3 skipped**. No failures. |
| `tests/test_memory.py` | **12 passed**, including parameterized corner changes. Covers anonymous/driver isolation, database reopening, SQLite deletion cascade, three-session limit, invalid/noncomparable exclusions, future profile metrics, tolerance boundary, summaries and WebSocket driver switching. |
| Two-session agent integration | Scripted OpenAI-compatible client calls `get_driver_history`, cites a stored number in a validated cue, omits the met brake-point goal, then writes a validated closing summary. This tests plumbing and validation, not a live model's compliance. |
| Browser | Chromium loaded the dashboard; clicking Driver opened the prompt, sent the WebSocket command and updated both the displayed name and `/state`. Dashboard JavaScript also passed `node --check`. |
| Two real CLI server processes | Real-time simulator, HTTP/WebSocket dashboard, normal SIGINT shutdown and restart using the same SQLite file all worked. First session: **4 laps**, brake point met in **2 retries**, brake release met in **1 retry**, best section **6.831965229678935 s**. Second process started with a corrected brake point and planned only brake release. A separate invocation of the real history tool read the first session and its saved summary. |
| Repository checks | `git diff --check` passed. |

Important: the real CLI run used the rules fallback. Rules choose goals from
current deltas and do not call the history tool. That run proves persistence,
restart and current-delta planning; only the scripted-provider test proves the
history tool/citation path so far. No live AI call has been validated.

Run existing automated checks from the checkout:

```bash
export UV_CACHE_DIR=/workspace/.cache/uv  # writable cache for this cloud environment
uv sync --frozen --system-certs
uv run --frozen pytest -q -rs
uv run --frozen pytest -q tests/test_memory.py
```

The standalone CLI/browser smoke checks were run manually and are not checked
in as reusable test scripts. Their temporary databases are not repository assets.

## Remaining acceptance tests

### 1. Live model memory test — highest priority

Requires an existing supported provider: NVIDIA, OpenRouter, or a configured
self-hosted OpenAI-compatible Nemotron endpoint. No provider credentials or
endpoint were configured in this cloud instance. Supply credentials through
secure environment settings, never in source, handoff files or chat. In a
restricted cloud environment, permit the chosen destination, such as
`integrate.api.nvidia.com` or `openrouter.ai`, and recheck access. See the README
for provider variables and the existing provider spike scripts.

1. Run a named session and complete a goal. Preserve the same `--data-dir`.
2. Restart with that driver and corner, with the met metric inside tolerance
   and a different metric outside tolerance. For example:

   ```bash
   uv run --frozen python -m coach --agent --driver memory-qa \
     --telemetry sim --mode lap --lap-gap 0.05 --brake-board 86 \
     --release 0.15 --voice off --data-dir data/memory-qa
   # After the first plan finishes, stop normally, then restart:
   uv run --frozen python -m coach --agent --driver memory-qa \
     --telemetry sim --mode lap --lap-gap 0.05 --brake-board 100 \
     --release 0.15 --voice off --data-dir data/memory-qa
   ```

3. Inspect dashboard tool events and the decision traces. Require a genuine
   provider decision (`think`/`fast`, not `rules`), `get_driver_history` as the
   first plan-turn read, a correct cited history number, and no brake-point
   goal while its current delta is inside tolerance.
4. Make that previously met metric exceed tolerance again. Confirm it may
   legitimately return to the plan.
5. Verify the stored closing summary and its grounding. Exercise the provider's
   supported tool and JSON transports, repair and fallback paths if used.

### 2. Windows-only skipped checks

Run these on Windows; the Linux skips are intentional:

```bash
uv run --frozen pytest -q tests/test_telemetry.py::test_struct_layout_matches_ac
uv run --frozen pytest -q tests/test_analysis.py::test_physics_extras_offsets_and_parse
```

For real Windows SAPI voice, set `NOMADSIM_SAPI_TEST=1` in that shell, then run:

```bash
uv run --frozen pytest -q tests/test_voice.py::test_sapi_speaker_null_output
```

The layout checks use constructed buffers. Also validate against a live original
Assetto Corsa session, real Monza gates/reference data and the selected reset
method. Phone/Arduino, virtual pad, CSP resets, hotkeys, sound and NVIDIA TTS
still need their normal rig-specific checks; simulated memory success does not
validate that hardware.

### 3. Additional memory QA to automate

- Three stored sessions mixing matching and changed corner hashes; assert no
  metric comparisons leak while outcomes remain available.
- Several laps with unequal lap counts per session, changed references, missing
  metrics and no valid laps; confirm the documented session-weighted means.
- Driver switch rejection during DECIDING/AWAIT_RESET, same-driver reconnect,
  new session/resume/shutdown boundaries, and cancellation of an active turn.
- Many plan revisions and long summaries: measure actual model-token usage
  against the artifact's **roughly 600-token** history budget. The three-session
  limit exists, but a hard token/output bound does not.
- Interrupted processes, database lock contention, disk-full/read-only storage
  and concurrent launches using one data directory. Error recovery has not been
  hardened or validated. Abrupt termination can leave a session without an
  `ended_at` or closing summary.
- Manual browser QA for blank/cancelled/invalid names and two connected dashboard
  tabs. The backend has automated coverage; the browser smoke covered the normal
  named-driver path.

## Remaining implementation and product work

1. **Live-model acceptance above is still outstanding.** The history-first rule
   is prompt guidance, not enforced by a validator or forced initial tool call.
   Evaluate live behavior before deciding whether enforcement is needed.
2. **History budget:** bound or compact response size if long revised plans
   exceed the approximately 600-token requirement; add a representative test.
3. **Delete-me flow:** `MemoryStore.delete_driver(name)` deletes SQLite sessions
   and laps and is tested. There is no dashboard/API deletion flow, identity
   authorization model or cross-backend deletion. Decide the product behavior
   before exposing a destructive action.
4. **SpacetimeDB:** this checkout has no such backend/module. Implement history
   sync and coordinated deletion separately if it remains a requirement. Do not
   treat SQLite deletion as remote deletion.
5. **Identity:** named labels are the interim solution from the artifact. Resolve
   account/driver identity and privacy/retention before a shared deployment.
6. **Crash/storage recovery:** decide treatment of unfinished sessions and expose
   actionable storage errors without interrupting coaching.
7. **Separate drill proposal:** registry and brake_bite/no_coast/apex_position are
   not part of this branch. Later drills requiring verified steering/slip units
   and racing-line extraction remain separate rig-dependent work.

## Operational notes

Keep the data directory between launches. Do not commit SQLite files, driver
history, traces, secrets or `.env`. Use a disposable directory for manual QA.
Case variants of a driver name are distinct. A changed corner name starts a
separate history rather than setting `corner_changed`.

The earlier cloud onboarding install/start configuration draft could not be
saved by the platform tool. Local installation and validation succeeded, but
reusable environment publication/restoration is not established. If needed,
configure the frozen uv install and simulator startup steps in environment
settings separately. Existing cloud tasks are isolated; use their checkout and
do not create a worktree unless explicitly requested.
