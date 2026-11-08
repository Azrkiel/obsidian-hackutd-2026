# PitPal history module

SpacetimeDB **2.14.1**, Node.js **24.22.1+** (or another version supported by the package's engines field).
This directory is the server module, not a website or the Python coach.

```powershell
cd spacetime-cloud
npm ci
npm test
npm run typecheck
spacetime build --module-path .
```

Publish with your account after local verification:

```powershell
spacetime login
spacetime publish --module-path . --server maincloud pitpal-history
```

Choose a different database name if that name is unavailable. Publishing initially records the
publisher as the only administrator. Existing data and registered devices survive compatible
module updates. Do not add a data-deletion publication flag to normal updates.

Register a PC's public enrollment values using the publisher's CLI login:

```powershell
spacetime call --server maincloud pitpal-history register_device $identity $deviceId 'Game PC' writer
spacetime call --server maincloud pitpal-history register_device $viewerIdentity $viewerDeviceId 'History PC' viewer
```

The identity and device ID variables are the public values printed by the Python setup helper.
They are not private tokens. Device registration accepts plain string arguments with CLI 2.14.1.
Only an administrator can register or revoke devices. Runtime devices cannot grant admin access.

## HTTP contract

POST to `/v1/database/DATABASE/call/FUNCTION?confirmed=true` with Bearer authentication and JSON
arguments as an array. `record_session`, `record_lap`, `record_attempt`, and `record_decision` each
accept one JSON-string argument named `record`. `list_sessions`, `get_session`, and `device_status`
each accept one JSON-string argument named `request` and return a JSON string.

Verified against the real local 2.14.1 host:

- Successful reducer calls return HTTP 200 with an empty body.
- Successful procedures return HTTP 200 with a JSON string that contains the result JSON object.
- Authorization failures carry `AUTH: access_denied` in the response body; reducers use HTTP 530
  and procedures use HTTP 500 on this host version. Classify this marker before retrying generic 5xx.
- Invalid records/conflicting replay carry `VALIDATION: invalid_record` / `VALIDATION: conflict`.
- Missing sessions carry `NOT_FOUND: not_found`.

Rows returned to clients preserve the versioned envelope and its `payload`, with
`server_received_at`, `writer_identity`, `device_id`, and `device_label` added by the module.

## Explicit live smoke test

`scripts/http-smoke.mjs` creates temporary device memberships and simulated records in the target
database, exercises every record kind, tests duplicate replay and permission denials, and revokes
the created devices. Run it only against a disposable test database. Set
`PITPAL_SMOKE_ADMIN_TOKEN` privately in the shell; the script never prints it.

```powershell
$env:PITPAL_SMOKE_SERVER = 'http://127.0.0.1:3301'
$env:PITPAL_SMOKE_DATABASE = 'pitpal-local-test'
node scripts/http-smoke.mjs
```

The administrator token for the target must already be supplied through the environment.
The smoke test never logs into a cloud account or publishes a module.
