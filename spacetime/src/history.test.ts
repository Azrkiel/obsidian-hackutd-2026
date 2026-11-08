import { describe, expect, it } from 'vitest';
import { ConnectionId, Timestamp } from 'spacetimedb';
import { createModuleTestHarness, TestAuth } from 'spacetimedb/server/test-utils';
import db, * as mod from './index';

const auth = (name: string) => TestAuth.fromJwtPayload(
  JSON.stringify({ iss: 'pitpal-test', sub: name }), new ConnectionId(1n));
const admin = auth('admin'), writer = auth('writer'), viewer = auth('viewer'), outsider = auth('outsider');
function setup() {
  const h = createModuleTestHarness(db, mod);
  h.withReducerTx(admin, ctx => mod.init(ctx, {}));
  for (const [a, role] of [[writer, 'writer'], [viewer, 'viewer']] as const) {
    h.withReducerTx(admin, ctx => mod.register_device(ctx, {
      identity: h.viewContext(a).sender.toHexString(), device_id: role, label: role, role,
    }));
  }
  return h;
}
const record = (id = 'session-1', sequence = 0, payload: Record<string, unknown> = {}) => ({
  schema_version: 1, record_id: id, session_id: 'session-1', sequence,
  captured_at: 1000, payload,
});
const session = (revision = 0, status = 'open') => record('session-1', 0, {
  revision, status, source: 'sim', mode: 'lap', track: 'Monza', car: '',
  started_at: 1000, ended_at: status === 'closed' ? 1001 : null,
});
function start(h: ReturnType<typeof setup>) {
  h.withReducerTx(writer, ctx => mod.record_session(ctx, { record: JSON.stringify(session()) }));
}
const list = (h: ReturnType<typeof setup>, a = viewer, request = {}) => JSON.parse(
  mod.list_sessions(h.procedureContext(a), { request: JSON.stringify(request) }));

describe('private shared racing history', () => {
  it('seeds publisher admin and denies unknown device registration and access', () => {
    const h = setup();
    expect(() => list(h, outsider)).toThrow(/access_denied/);
    expect(() => h.withReducerTx(writer, ctx => mod.register_device(ctx, {
      identity: h.viewContext(outsider).sender.toHexString(), device_id: 'bad', label: 'bad', role: 'writer',
    }))).toThrow(/access_denied/);
  });
  it('lets a registered viewer read another device session but never write', () => {
    const h = setup(); start(h);
    expect(list(h).items[0].session_id).toBe('session-1');
    expect(list(h).items[0].device_id).toBe('writer');
    expect(() => h.withReducerTx(viewer, ctx => mod.record_session(ctx, {
      record: JSON.stringify(session()),
    }))).toThrow(/access_denied/);
  });
  it('makes retries idempotent and rejects a conflicting result', () => {
    const h = setup(); start(h);
    const lap = record('lap-1', 1, { lap: 1, valid: true, invalid_reason: null, lap_time_s: 92, delta_s: 0.2, corners: [] });
    for (let i = 0; i < 2; i++) h.withReducerTx(writer, ctx => mod.record_lap(ctx, { record: JSON.stringify(lap) }));
    expect(h.db.laps.count()).toBe(1n);
    expect(() => h.withReducerTx(writer, ctx => mod.record_lap(ctx, {
      record: JSON.stringify({ ...lap, payload: { ...lap.payload, lap_time_s: 93 } }),
    }))).toThrow(/conflict/);
  });
  it('does not reopen a finished session from a stale revision', () => {
    const h = setup(); start(h);
    h.withReducerTx(writer, ctx => mod.record_session(ctx, { record: JSON.stringify(session(2, 'closed')) }));
    h.withReducerTx(writer, ctx => mod.record_session(ctx, { record: JSON.stringify(session(1)) }));
    expect(list(h).items[0].payload.status).toBe('closed');
  });
  it('rejects forged writer ownership, malformed records, and prohibited payloads', () => {
    const h = setup(); start(h);
    h.withReducerTx(admin, ctx => mod.register_device(ctx, {
      identity: h.viewContext(outsider).sender.toHexString(), device_id: 'other', label: 'Other', role: 'writer',
    }));
    expect(() => h.withReducerTx(outsider, ctx => mod.record_lap(ctx, { record: JSON.stringify(record('lap', 1, { lap: 1, valid: false, lap_time_s: null })) }))).toThrow(/access_denied/);
    expect(() => h.withReducerTx(writer, ctx => mod.record_session(ctx, { record: '{' }))).toThrow(/invalid_record/);
    expect(() => h.withReducerTx(writer, ctx => mod.record_decision(ctx, { record: JSON.stringify(record('decision', 1, { reasoning: 'private' })) }))).toThrow(/invalid_record/);
    expect(() => h.withReducerTx(writer, ctx => mod.record_session(ctx, { record: 'x'.repeat(32769) }))).toThrow(/invalid_record/);
  });
  it('supports null invalid lap times, child pagination, and stable session pagination', () => {
    const h = setup(); start(h);
    for (let i = 1; i <= 3; i++) h.withReducerTx(writer, ctx => mod.record_lap(ctx, { record: JSON.stringify(record(`lap-${i}`, i, { lap: i, valid: false, invalid_reason: 'reset', lap_time_s: null, delta_s: 0, corners: [] })) }));
    const first = JSON.parse(mod.get_session(h.procedureContext(viewer), { request: JSON.stringify({ session_id: 'session-1', kind: 'laps', limit: 2 }) }));
    expect(first.items).toHaveLength(2);
    expect(first.items[0].payload.lap_time_s).toBeNull();
    const second = JSON.parse(mod.get_session(h.procedureContext(viewer), { request: JSON.stringify({ session_id: 'session-1', kind: 'laps', limit: 2, cursor: first.next_cursor }) }));
    expect(second.items).toHaveLength(1);
    h.clock.set(new Timestamp(1000000n));
    const s2 = { ...session(), record_id: 'session-2', session_id: 'session-2' };
    h.withReducerTx(writer, ctx => mod.record_session(ctx, { record: JSON.stringify(s2) }));
    const page = list(h, viewer, { limit: 1 });
    expect(page.items).toHaveLength(1);
    expect(list(h, viewer, { limit: 1, cursor: page.next_cursor }).items[0].session_id).not.toBe(page.items[0].session_id);
  });
  it('revocation denies both reads and writes, without deleting history', () => {
    const h = setup(); start(h);
    h.withReducerTx(admin, ctx => mod.revoke_device(ctx, { identity: h.viewContext(writer).sender.toHexString() }));
    expect(() => list(h, writer)).toThrow(/access_denied/);
    expect(list(h, viewer).items).toHaveLength(1);
    expect(() => h.withReducerTx(admin, ctx => mod.revoke_device(ctx, { identity: h.viewContext(admin).sender.toHexString() }))).toThrow(/access_denied/);
  });
  it('rejects nested private data and cross-writer changes while allowing shared reads', () => {
    const h = setup(); start(h);
    h.withReducerTx(admin, ctx => mod.register_device(ctx, {
      identity: h.viewContext(outsider).sender.toHexString(), device_id: 'second-writer', label: 'Second writer', role: 'writer',
    }));
    expect(list(h, outsider).items).toHaveLength(1);
    expect(() => h.withReducerTx(outsider, ctx => mod.record_session(ctx, { record: JSON.stringify(session(5, 'closed')) }))).toThrow(/access_denied/);
    const lap = record('nested', 1, { lap: 1, valid: true, lap_time_s: 90, corners: [{ corner_id: 't1', token: 'private' }] });
    expect(() => h.withReducerTx(writer, ctx => mod.record_lap(ctx, { record: JSON.stringify(lap) }))).toThrow(/invalid_record/);
    expect(() => h.withReducerTx(admin, ctx => mod.register_device(ctx, {
      identity: h.viewContext(viewer).sender.toHexString(), device_id: 'second-writer', label: 'Collision', role: 'viewer',
    }))).toThrow(/conflict/);
  });
});
