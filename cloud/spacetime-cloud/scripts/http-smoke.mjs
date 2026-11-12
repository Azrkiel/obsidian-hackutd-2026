// Explicit live smoke test. Creates test devices and records in the chosen database.
// Never run this against a production database without intending to write test data.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const host = process.env.PITPAL_SMOKE_SERVER || 'http://127.0.0.1:3301';
const database = process.env.PITPAL_SMOKE_DATABASE || 'pitpal-local-test';
const adminToken = process.env.PITPAL_SMOKE_ADMIN_TOKEN;
if (!adminToken) throw new Error('Set PITPAL_SMOKE_ADMIN_TOKEN for a disposable test database.');
const prefix = `smoke-${randomUUID()}`;
const sessionId = `${prefix}-session`;
const now = Date.now() / 1000;
async function identity() {
  const r = await fetch(`${host}/v1/identity`, { method: 'POST' });
  assert.equal(r.status, 200);
  return r.json();
}
async function call(token, fn, args, error = null) {
  const r = await fetch(`${host}/v1/database/${encodeURIComponent(database)}/call/${fn}?confirmed=true`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const body = await r.text();
  if (error) { assert.ok(body.includes(error), `${fn}: expected ${error}, status ${r.status}`); return; }
  assert.ok(r.ok, `${fn}: unexpected HTTP ${r.status}`);
  if (!body) return null;
  const value = JSON.parse(body);
  return typeof value === 'string' ? JSON.parse(value) : value;
}
const [writer, viewer, outsider] = await Promise.all([identity(), identity(), identity()]);
await call(adminToken, 'register_device', [writer.identity, `${prefix}-writer`, 'Smoke writer', 'writer']);
await call(adminToken, 'register_device', [viewer.identity, `${prefix}-viewer`, 'Smoke viewer', 'viewer']);
assert.equal((await call(writer.token, 'device_status', ['{}'])).role, 'writer');
const envelope = (suffix, sequence, payload) => ({
  schema_version: 1, record_id: `${prefix}-${suffix}`, session_id: sessionId,
  sequence, captured_at: now, payload,
});
const start = envelope('session-start', 0, {
  revision: 0, source: 'sim', mode: 'lap', track: 'Monza', car: 'Smoke car',
  started_at: now, ended_at: null, status: 'open',
});
await call(writer.token, 'record_session', [JSON.stringify(start)]);
const lap = envelope('lap-1', 1, { lap: 1, valid: true, invalid_reason: null, lap_time_s: 95.2, delta_s: 0.5, corners: [] });
await call(writer.token, 'record_lap', [JSON.stringify(lap)]);
await call(writer.token, 'record_lap', [JSON.stringify(lap)]);
const attempt = envelope('attempt-1', 2, {
  attempt_id: 'a-0001', corner_id: 't1', role: 'baseline', valid: true, invalid_reason: null,
  entry_kmh: 170, apex_kmh: 70, exit_kmh: 95, brake_onset_m: 100,
  peak_brake: 0.9, throttle_pickup_m: 250, section_s: 7.2,
});
await call(writer.token, 'record_attempt', [JSON.stringify(attempt)]);
await call(writer.token, 'record_decision', [JSON.stringify(envelope('decision-1', 3, {
  decision_id: 'd-1', attempt_id: 'a-0001', corner_id: 't1', action: 'offer_drill',
  drill_id: 'brake_point', target: { marker_m: 100 }, cue: 'Brake at the 100 m board.',
  summary: 'Brake at the 100 m board.', mode: 'rules', provider: null, model: null, latency_ms: 0,
}))]);
const listed = await call(viewer.token, 'list_sessions', [JSON.stringify({ limit: 50 })]);
assert.ok(listed.items.some(row => row.session_id === sessionId));
for (const kind of ['laps', 'attempts', 'decisions']) {
  const page = await call(viewer.token, 'get_session', [JSON.stringify({ session_id: sessionId, kind })]);
  assert.equal(page.items.length, 1);
  assert.equal(page.session.payload.track, 'Monza');
}
await call(viewer.token, 'record_lap', [JSON.stringify(lap)], 'AUTH: access_denied');
await call(outsider.token, 'list_sessions', ['{}'], 'AUTH: access_denied');
await call(writer.token, 'record_session', ['{}'], 'VALIDATION: invalid_record');
await call(adminToken, 'revoke_device', [writer.identity]);
await call(writer.token, 'device_status', ['{}'], 'AUTH: access_denied');
assert.equal((await call(viewer.token, 'get_session', [JSON.stringify({ session_id: sessionId, kind: 'laps' })])).items.length, 1);
await call(adminToken, 'revoke_device', [viewer.identity]);
console.log('HTTP smoke passed: identity enrollment, all record kinds, shared viewer reads, duplicate-safe writes, validation, and revocation.');
