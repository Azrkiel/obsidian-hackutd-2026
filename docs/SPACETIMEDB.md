# Shared history with SpacetimeDB

Use this runbook to store racing history in **your SpacetimeDB Maincloud account** and read it
from another PC. The Python coach, game connection and Rev overlay stay on the Windows game PC.
Nemotron continues to run on Brev. Publishing the database does not publish a public website.

```text
Game PC: Assetto Corsa -> coach -> local dashboard + Rev
                           |
                           +-> Brev Nemotron
                           |
                           +-> local outbox -> your Maincloud database
                                                      ^
                                                      |
Second PC: local history viewer -----------------------+
```

GitHub contains the implementation and instructions. Maincloud contains shared session records.
Each PC keeps its own credentials, pending uploads and cached reads. Cloning the repository does
not copy private credentials or history. The integration is optional; a PC without a cloud profile
continues running the existing local coach.

## What you need

| Device | Required tools and access |
| --- | --- |
| Publisher workstation | Your SpacetimeDB account, Git, uv, Node.js **24.22.1 or newer**, SpacetimeDB CLI **2.14.1**, and administrator access to this database |
| Windows game PC | Existing Assetto Corsa/PitPal setup, Git, uv, the `cloud` extra, and its own registered writer identity |
| Windows history-only PC | Git, uv, the `cloud` extra, and its own registered viewer identity; no game, virtual controller or Brev tunnel |

The module is pinned to SpacetimeDB SDK 2.14.1 in `spacetime/package.json` and the npm lockfile.
Use the same CLI version when building/publishing it. Follow the [official CLI installation
instructions](https://spacetimedb.com/install) if `spacetime` is missing. A runtime PC does not need
publisher CLI credentials; only the owner workstation performs publication and registration.

## 1. Get the code on each PC

For a new checkout, run in Windows PowerShell:

```powershell
git clone --branch rev-overlay https://github.com/Azrkiel/obsidian-hackutd-2026.git "$env:USERPROFILE\pitpal-brev"
cd "$env:USERPROFILE\pitpal-brev"
uv sync --system-certs --extra cloud
```

For an existing **clean** checkout on `rev-overlay`, run from its repo folder:

```powershell
git status --short
git pull --ff-only
uv sync --system-certs --extra cloud
```

If `git status --short` shows local edits, preserve them before updating. All later Python commands
run from the repo root. `--system-certs` supports machines with an enterprise certificate chain;
it does not disable certificate verification.

## 2. Publish the module under your account

On the publisher workstation, sign into the [SpacetimeDB console](https://spacetimedb.com/), review
the current usage and billing settings, and choose settings you accept. No NVIDIA API key is needed
for the database or for self-hosted Brev inference.

Open PowerShell in the repo root and verify the tool versions:

```powershell
node --version
spacetime --version
```

Build and test the module, then complete the browser login:

```powershell
cd spacetime
npm ci
npm test
npm run typecheck
spacetime login
```

**Log in with your intended account before the first publication.** The first publisher becomes
the module's administrator. The database identity is different from that administrator identity.
The [Maincloud publication guide](https://spacetimedb.com/docs/how-to/deploy/maincloud/) explains
how this CLI login links the deployment to your account.

Choose a project-specific database name. The following uses `pitpal-history`; if that name already
belongs to another project, change the variable instead of attempting to replace it:

```powershell
$Database = "pitpal-history"
spacetime publish --module-path . --server maincloud $Database
```

Expected result: the CLI prints the published database identity and the database appears in your
SpacetimeDB account. Record the exact name/identity and deployed Git commit. Keep this publisher
login on the owner workstation. **Do not use a data-deletion flag when updating this database.**

Return to the repo root:

```powershell
cd ..
```

## 3. Enroll the game PC

On the Windows game PC, from the repo root:

```powershell
uv run --system-certs --extra cloud python scripts/spacetime_device.py setup --label game-pc
```

At the prompts:

1. Press Enter to use `https://maincloud.spacetimedb.com`.
2. Enter the exact database name or identity from publication.

For noninteractive target selection:

```powershell
uv run --system-certs --extra cloud python scripts/spacetime_device.py setup --server https://maincloud.spacetimedb.com --database pitpal-history --label game-pc
```

Change `pitpal-history` if you published under a different name. The helper issues a runtime identity,
verifies its credential, stores its private token in Windows Credential Manager and writes a
non-secret profile to `data/cloud/config.json`. It prints public `identity`, `device_id` and `label`
values. **It does not grant database access.**

On the publisher workstation, in PowerShell with the owner CLI login, enter those public values:

```powershell
$Database = Read-Host "Published database name or identity"
$Identity = Read-Host "Public identity printed by setup"
$DeviceId = Read-Host "Device ID printed by setup"
$Label = Read-Host "Device label, for example game-pc"
spacetime call --server maincloud $Database register_device $Identity $DeviceId $Label writer
```

CLI 2.14.1 accepts these as plain argument values; do not add JSON wrappers around them.
Registration is allowed only to the administrator. The game PC cannot approve itself.

Back on the game PC, run:

```powershell
uv run --system-certs --extra cloud python scripts/spacetime_device.py status
```

Expected result: public status JSON with `"status": "registered"` and `"role": "writer"`. This
also saves the verified role in the non-secret profile so an already enrolled writer can capture
pending results during a later network outage. A newly configured identity must be registered and
verified before uploads can start.

## 4. Test and run the game PC

First use simulated telemetry to verify the local dashboard and upload path:

```powershell
uv run --system-certs --extra cloud python -m coach --track fixtures/track_monza.json --telemetry sim --no-retries --overlay --voice windows
```

Open `http://127.0.0.1:8020`, let a lap finish, and open History. Simulator results carry a simulator
source label. No Brev provider is required to test the database; the existing rules coach remains
available when inference is not configured.

Stop the simulator with Ctrl+C before starting the live game. With the existing phone/pedal/CSP
setup installed and Assetto Corsa in borderless/windowed practice, use the normal launcher:

```powershell
.\PitPal.bat --voice windows
```

The cloud integration uses the existing profile automatically. Your Brev tunnel and Nemotron
environment settings are separate; see the [Brev setup](../README.md#self-hosting-on-brev).

## 5. Enroll the second PC as a viewer

Clone/update the same branch and install the cloud extra using step 1. From that PC's repo root:

```powershell
uv run --system-certs --extra cloud python scripts/spacetime_device.py setup --label history-pc
```

Enter the **same Maincloud server and database** as the game PC. This PC gets a different runtime
identity and private credential. On the publisher workstation, register its public setup values:

```powershell
$Database = Read-Host "Published database name or identity"
$Identity = Read-Host "Second PC public identity"
$DeviceId = Read-Host "Second PC device ID"
$Label = Read-Host "Device label, for example history-pc"
spacetime call --server maincloud $Database register_device $Identity $DeviceId $Label viewer
```

On the second PC:

```powershell
uv run --system-certs --extra cloud python scripts/spacetime_device.py status
uv run --system-certs --extra cloud python -m coach.history
```

Open `http://127.0.0.1:8020` **on that second PC** and refresh History. Its local Python server fetches
records from Maincloud. The history-only launcher starts no game reader, controller bridge, reset
client or model warm-up. If port 8020 is already in use, stop the other local server or choose:

```powershell
uv run --system-certs --extra cloud python -m coach.history --port 8021
```

Then open `http://127.0.0.1:8021`. A viewer cannot upload records or modify device permissions.
Register a PC as `writer` instead only when it should run its own driving sessions too.

## How data and failures are handled

The module stores compact session metadata, completed laps, scored corner attempts and coaching
decisions. It derives the writer identity from the authenticated caller. All registered devices in
this database can read shared history; writers can modify only their own sessions. Tables are
private and exposed through permission-checked procedures.

The event callback does no network or disk work. A background worker saves pending records to
`data/cloud/outbox/`; a separate uploader sends them with confirmed writes. Duplicate-safe record
IDs prevent a retry after a lost response from creating a second copy. Successful uploads remove
the corresponding pending file. Temporary network failures keep pending records for retry;
authentication errors pause cloud operations; permanently rejected records are quarantined.

Only records persisted to the outbox have restart recovery. A sudden process/power failure can
lose events still in the bounded memory buffer. A full buffer, disk failure or capture gap is
reported as incomplete capture; the game and coach continue running. Retain rejected/pending
files while investigating rather than deleting them to hide a sync error.

Raw telemetry traces, full model reasoning, phone pairing links, tokens and driving/reset commands
are not uploaded. Cloud-read caches are separated by server, database and identity. A temporary
outage can display cached history with its last-refresh time. An explicit access denial stops
serving that identity's cloud cache. Revoking access cannot erase private files that were already
copied from a trusted device.

## Configuration and credentials

The normal profile is `data/cloud/config.json`. It contains only server URL, database, public
identity, device ID, label, enabled flag and last verified role. The token stays in Windows Credential
Manager under a service bound to that server/database/identity. A credential-store failure produces
an error; there is no plaintext fallback. Keep the Windows user profile that owns the vault entry.

For a temporary test or automation, set all three environment overrides together in the process
that starts the app:

```text
SPACETIMEDB_URL
SPACETIMEDB_DATABASE
SPACETIMEDB_TOKEN
```

Optional `SPACETIMEDB_IDENTITY`, `SPACETIMEDB_DEVICE_ID` and `SPACETIMEDB_LABEL` supply public metadata.
When public IDs are absent, the service must resolve them from authenticated `device_status` before
binding uploads/cache. Do not derive authorization from unverified JWT claims. Environment-only
credentials do not create a vault-backed profile; use setup for ordinary PC enrollment.

Use HTTPS for remote servers. HTTP is accepted only for loopback development servers such as
`http://127.0.0.1:3000`. Profiles cannot contain URL credentials, query strings or arbitrary API paths.
The code does not automatically load `.env` files. Never put tokens in README files, screenshots,
browser JavaScript, shell transcripts or Git commits.

Server-issued runtime tokens are a **development-only choice for this trusted-PC demo**. They do
not expire and cannot be recovered if lost. A production release should use SpacetimeAuth/OIDC
sign-in with refresh/logout and appropriate identity policies. See the [official authentication
guidance](https://spacetimedb.com/docs/intro/faq/).

## Export a backup

On a registered device with read access:

```powershell
uv run --system-certs --extra cloud python scripts/spacetime_device.py export --output data/cloud/exports/history.json
```

The helper fetches every authorized session and child page. It writes through a temporary file,
flushes it, and replaces the destination only after the full export succeeds. A network, permission
or disk failure leaves the previous backup intact. The export includes record IDs and timestamps
and excludes credentials. Store a copy outside the game PC before a destructive database change.

## Revoke or replace a device

From the publisher workstation, revoke the public identity of a lost or retired PC:

```powershell
$Database = Read-Host "Published database name or identity"
$Identity = Read-Host "Public identity to revoke"
spacetime call --server maincloud $Database revoke_device $Identity
```

Revocation disables future reads and writes while preserving historical attribution. It does not
delete the device's history. The initial administrator cannot be revoked through this reducer.

If a runtime credential is lost or needs replacement, run on the affected PC:

```powershell
uv run --system-certs --extra cloud python scripts/spacetime_device.py setup --label game-pc --replace
```

Register the new public identity, revoke the old one, then run status. `--replace` preserves the
previous public profile and pending files. Old outbox files stay bound to their original identity
and target; they are not silently uploaded under the replacement identity. Recover the original
credential to retry them, or retain/export the local evidence for a deliberate recovery operation.

## Troubleshooting and rollback

| Symptom | What to check |
| --- | --- |
| Setup required / cloud disabled | Run setup, register the device, then run status; check the profile's `enabled` flag |
| Credential store unavailable | Run `uv sync --system-certs --extra cloud` on Windows; use the same Windows account that enrolled the device |
| Access denied after setup | Administrator registration is still required, or this identity was revoked |
| Identity/device mismatch | Confirm the server/database and the exact public values used during registration |
| Network/offline state | Check Maincloud availability, connectivity, database name and account usage; coaching can continue locally |
| Pending count grows | Check credentials/status, retryable server failures, local disk space and account quotas |
| Rejected records | Preserve `data/cloud/rejected/`; check module/client versions and validation errors |
| Empty History on PC B | Same database, registered viewer identity, Refresh completed, and PC A actually acknowledged uploads |
| Port already in use | Stop the existing coach/viewer or use the viewer's `--port` option |
| TLS certificate error with uv | Use `--system-certs`; do not disable verification |

To disable cloud sync, stop the coach, set `"enabled": false` in the non-secret profile, and restart.
If environment overrides are set, clear them from that launching shell too. Pending files remain
available for a later recovery. This does not stop the Brev rental or delete cloud records.

Before updating the module, export a backup and record the current source commit. Run `npm ci`,
`npm test` and `npm run typecheck` under `spacetime/`, then republish using the same name and owner
login. Prefer additive migrations. If a migration is rejected, stop and plan it; do not solve it by
adding a data-deletion flag. Roll back the local app with cloud disabled when necessary; a code
rollback alone does not undo a schema migration.

## Verify that history is really in the cloud

1. On PC A, capture a new session and wait for pending uploads to reach zero.
2. Stop PC A's coach and shut down PC A.
3. Use a newly enrolled PC B with an empty history cache and a separate viewer identity.
4. Open its history-only dashboard and refresh from Maincloud.
5. Confirm PC A's new session, laps and advice appear.
6. Confirm an unregistered identity cannot read them and a viewer cannot write.

This read with PC A shut down proves that shared records are in Maincloud. Reading an old cache
on PC A alone does not prove cloud persistence. Maincloud publication and this two-device test
must be completed using your account; local module tests do not create a deployment for you.

## Developer checks

```powershell
uv run --system-certs --extra cloud pytest -q
cd spacetime
npm ci
npm test
npm run typecheck
```

The tests use disposable local identities and test servers; ordinary unit tests must not require
your Maincloud account. The [implementation plan](plans/2026-11-08-spacetimedb-history.md) describes
the failure and durability contracts. [SpacetimeDB's HTTP API](https://spacetimedb.com/docs/http/database/)
is used for low-volume results/history; this implementation does not send high-frequency telemetry
through the database.
