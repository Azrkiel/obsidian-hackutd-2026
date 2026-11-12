import { Identity } from 'spacetimedb';
import { schema, table, t, SenderError, type InferSchema, type ReducerCtx } from 'spacetimedb/server';

const authorizedDevices = table({ name: 'authorized_devices' }, {
  identity: t.identity().primaryKey(), deviceId: t.string().unique(),
  label: t.string(), role: t.string(), enabled: t.bool(),
});
const historyColumns = () => ({
  recordId: t.string().primaryKey(), sessionId: t.string().index('btree'),
  sequence: t.f64(), capturedAt: t.f64(), serverReceivedAt: t.f64(),
  writerIdentity: t.identity(), deviceId: t.string(), deviceLabel: t.string(), data: t.string(),
});
const sessions = table({ name: 'sessions' }, {
  sessionId: t.string().primaryKey(), recordId: t.string(), sequence: t.f64(),
  capturedAt: t.f64(), serverReceivedAt: t.f64(), serverStartedAt: t.f64(),
  writerIdentity: t.identity(), deviceId: t.string(), deviceLabel: t.string(),
  revision: t.f64(), source: t.string(), data: t.string(),
});
const laps = table({ name: 'laps' }, historyColumns());
const cornerAttempts = table({ name: 'corner_attempts' }, historyColumns());
const coachingDecisions = table({ name: 'coaching_decisions' }, historyColumns());
const db = schema({ authorizedDevices, sessions, laps, cornerAttempts, coachingDecisions });
export default db;
type Ctx = ReducerCtx<InferSchema<typeof db>>;
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Obj = { [key: string]: Json };
type Envelope = { schema_version: number; record_id: string; session_id: string; sequence: number; captured_at: number; payload: Obj };
type Kind = 'session' | 'lap' | 'attempt' | 'decision';
type Stored = { data: string; writerIdentity: Identity; deviceId: string; deviceLabel: string; serverReceivedAt: number };

function fail(code: string): never {
  const prefix = code === 'access_denied' ? 'AUTH' : code === 'not_found' ? 'NOT_FOUND' : 'VALIDATION';
  throw new SenderError(`${prefix}: ${code}`);
}
function text(value: unknown, max = 160, empty = false): asserts value is string {
  if (typeof value !== 'string' || (!empty && value.length === 0) || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) fail('invalid_record');
}
function finiteTree(value: unknown, depth = 0): void {
  if (depth > 10) fail('invalid_record');
  if (typeof value === 'number' && !Number.isFinite(value)) fail('invalid_record');
  if (typeof value === 'string') text(value, 4096, true);
  if (Array.isArray(value)) {
    if (value.length > 256) fail('invalid_record');
    for (const item of value) finiteTree(item, depth + 1);
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (['__proto__', 'constructor', 'prototype', 'token', 'api_key', 'authorization', 'password', 'secret', 'pair_uri', 'trace', 'reasoning', 'reasoning_content', 'tool_calls'].includes(key.toLowerCase())) fail('invalid_record');
      finiteTree(child, depth + 1);
    }
  }
}
function object(value: unknown): value is Obj {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function decode(raw: string, max = 32768): Obj {
  if (new TextEncoder().encode(raw).length > max) fail('invalid_record');
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return fail('invalid_record'); }
  if (!object(value)) fail('invalid_record');
  finiteTree(value);
  return value;
}
function canonical(value: Json): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (object(value)) return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
const payloadKeys: Record<Kind, ReadonlySet<string>> = {
  session: new Set(['revision', 'status', 'source', 'mode', 'track', 'car', 'started_at', 'ended_at', 'incomplete', 'capture_incomplete']),
  lap: new Set(['lap', 'valid', 'invalid_reason', 'lap_time_s', 'delta_s', 'corners']),
  attempt: new Set(['attempt_id', 'corner_id', 'corner_name', 'role', 'valid', 'invalid_reason', 'entry_kmh', 'apex_kmh', 'exit_kmh', 'brake_onset_m', 'peak_brake', 'throttle_pickup_m', 'section_s', 'release_s', 'trail_brake_share', 'lockup_s', 'wheelspin_s', 'min_kmh', 'min_pos_m', 'brake_board_m', 'lap']),
  decision: new Set(['decision_id', 'attempt_id', 'corner_id', 'action', 'drill_id', 'target', 'cue', 'verdict', 'reminder', 'end_reason', 'summary', 'mode', 'provider', 'model', 'latency_ms', 'plan', 'plan_action']),
};
function parseRecord(raw: string, kind: Kind): Envelope {
  const value = decode(raw);
  if (Object.keys(value).some(k => !['schema_version', 'record_id', 'session_id', 'sequence', 'captured_at', 'payload'].includes(k))) fail('invalid_record');
  if (value.schema_version !== 1 || !Number.isSafeInteger(value.sequence) || (value.sequence as number) < 0 || typeof value.captured_at !== 'number' || value.captured_at < 0 || !object(value.payload)) fail('invalid_record');
  text(value.record_id); text(value.session_id);
  const p = value.payload;
  if (Object.keys(p).some(k => !payloadKeys[kind].has(k))) fail('invalid_record');
  if (kind === 'session') {
    if (!Number.isSafeInteger(p.revision) || (p.revision as number) < 0 || !['open', 'closed', 'incomplete'].includes(String(p.status)) || !['ac', 'sim', 'replay'].includes(String(p.source)) || !['lap', 'drill'].includes(String(p.mode))) fail('invalid_record');
    text(p.track, 256, true); text(p.car, 256, true);
    if (typeof p.started_at !== 'number' || p.started_at < 0 || (p.ended_at !== null && (typeof p.ended_at !== 'number' || p.ended_at < p.started_at))) fail('invalid_record');
  } else if (kind === 'lap') {
    if (!Number.isSafeInteger(p.lap) || (p.lap as number) < 0 || typeof p.valid !== 'boolean' || (p.lap_time_s !== null && (typeof p.lap_time_s !== 'number' || p.lap_time_s < 0))) fail('invalid_record');
    if (p.valid && p.lap_time_s === null) fail('invalid_record');
    if (p.invalid_reason !== undefined && p.invalid_reason !== null) text(p.invalid_reason, 512, true);
    if (p.corners !== undefined && !Array.isArray(p.corners)) fail('invalid_record');
  } else if (kind === 'attempt') {
    text(p.attempt_id); if (p.corner_id !== undefined && p.corner_id !== null) text(p.corner_id, 160, true);
    if (typeof p.valid !== 'boolean') fail('invalid_record');
    for (const key of ['entry_kmh', 'apex_kmh', 'exit_kmh', 'brake_onset_m', 'peak_brake', 'throttle_pickup_m', 'section_s']) if (typeof p[key] !== 'number') fail('invalid_record');
  } else {
    text(p.decision_id); text(p.attempt_id); text(p.action, 80);
    for (const key of ['cue', 'summary', 'reminder']) if (p[key] !== undefined && p[key] !== null) text(p[key], 4096, true);
    if (p.target !== undefined && p.target !== null && !object(p.target)) fail('invalid_record');
    if (p.target && Object.keys(p.target as Obj).some(k => !['marker_m', 'release_s'].includes(k))) fail('invalid_record');
    if (p.plan !== undefined && p.plan !== null) {
      // Plans can include model-only metadata. Persist the chosen action/target, not the plan object.
      fail('invalid_record');
    }
  }
  return value as unknown as Envelope;
}
function member(ctx: Ctx, roles?: readonly string[]) {
  const who = ctx.db.authorizedDevices.identity.find(ctx.sender);
  if (!who || !who.enabled || (roles && !roles.includes(who.role))) fail('access_denied');
  return who;
}
export const init = db.init(ctx => {
  ctx.db.authorizedDevices.insert({ identity: ctx.sender, deviceId: 'publisher', label: 'Publisher', role: 'admin', enabled: true });
});
export const register_device = db.reducer({ identity: t.string(), device_id: t.string(), label: t.string(), role: t.string() }, (ctx, a) => {
  member(ctx, ['admin']); text(a.device_id); text(a.label, 120);
  if (!['writer', 'viewer'].includes(a.role)) fail('invalid_record');
  let identity: Identity;
  try { identity = Identity.fromString(a.identity); } catch { return fail('invalid_record'); }
  const old = ctx.db.authorizedDevices.identity.find(identity);
  const other = ctx.db.authorizedDevices.deviceId.find(a.device_id);
  if (other && !other.identity.isEqual(identity)) fail('conflict');
  if (old) {
    if (old.role === 'admin' || old.deviceId !== a.device_id) fail('conflict');
    ctx.db.authorizedDevices.identity.update({ ...old, label: a.label, role: a.role, enabled: true });
  } else ctx.db.authorizedDevices.insert({ identity, deviceId: a.device_id, label: a.label, role: a.role, enabled: true });
});
export const revoke_device = db.reducer({ identity: t.string() }, (ctx, a) => {
  member(ctx, ['admin']);
  let identity: Identity;
  try { identity = Identity.fromString(a.identity); } catch { return fail('invalid_record'); }
  const old = ctx.db.authorizedDevices.identity.find(identity);
  if (old?.role === 'admin') fail('access_denied');
  if (old) ctx.db.authorizedDevices.identity.update({ ...old, enabled: false });
});
function stored(ctx: Ctx, record: Envelope) {
  const who = member(ctx, ['writer', 'admin']);
  return { recordId: record.record_id, sessionId: record.session_id, sequence: record.sequence,
    capturedAt: record.captured_at, serverReceivedAt: Number(ctx.timestamp.microsSinceUnixEpoch) / 1e6,
    writerIdentity: ctx.sender, deviceId: who.deviceId, deviceLabel: who.label,
    data: canonical(record as unknown as Json) };
}
export const record_session = db.reducer({ record: t.string() }, (ctx, { record }) => {
  member(ctx, ['writer', 'admin']);
  const value = parseRecord(record, 'session');
  const old = ctx.db.sessions.sessionId.find(value.session_id);
  if (old && !old.writerIdentity.isEqual(ctx.sender)) fail('access_denied');
  const row = { ...stored(ctx, value), revision: value.payload.revision as number,
    source: value.payload.source as string, serverStartedAt: old?.serverStartedAt ?? Number(ctx.timestamp.microsSinceUnixEpoch) / 1e6 };
  if (old) {
    if (row.revision < old.revision) return;
    if (row.revision === old.revision) { if (old.data !== row.data) fail('conflict'); return; }
    ctx.db.sessions.sessionId.update(row);
  } else ctx.db.sessions.insert(row);
});
function saveResult(ctx: Ctx, raw: string, kind: Exclude<Kind, 'session'>) {
  member(ctx, ['writer', 'admin']);
  const value = parseRecord(raw, kind);
  const session = ctx.db.sessions.sessionId.find(value.session_id);
  if (!session || !session.writerIdentity.isEqual(ctx.sender)) fail('access_denied');
  const table = kind === 'lap' ? ctx.db.laps : kind === 'attempt' ? ctx.db.cornerAttempts : ctx.db.coachingDecisions;
  const old = table.recordId.find(value.record_id);
  const row = stored(ctx, value);
  if (old) {
    if (!old.writerIdentity.isEqual(ctx.sender)) fail('access_denied');
    if (old.data !== row.data) fail('conflict');
  } else table.insert(row);
}
export const record_lap = db.reducer({ record: t.string() }, (ctx, { record }) => saveResult(ctx, record, 'lap'));
export const record_attempt = db.reducer({ record: t.string() }, (ctx, { record }) => saveResult(ctx, record, 'attempt'));
export const record_decision = db.reducer({ record: t.string() }, (ctx, { record }) => saveResult(ctx, record, 'decision'));
function normalized(row: Stored) {
  return { ...JSON.parse(row.data), server_received_at: row.serverReceivedAt,
    writer_identity: row.writerIdentity.toHexString(), device_id: row.deviceId, device_label: row.deviceLabel };
}
function requestPage(raw: string, max: number): Obj & { limit: number } {
  const r = decode(raw, 2048);
  const limit = r.limit ?? Math.min(20, max);
  if (!Number.isInteger(limit) || (limit as number) < 1 || (limit as number) > max) fail('invalid_request');
  if (r.cursor !== undefined && r.cursor !== null) text(r.cursor, 512);
  return { ...r, limit: limit as number };
}
type PageKey = [number, string];
function cursor(raw: Json | undefined): PageKey | null {
  if (raw === undefined || raw === null) return null;
  try {
    const v = JSON.parse(raw as string);
    if (!Array.isArray(v) || v.length !== 2 || typeof v[0] !== 'number' || !Number.isFinite(v[0]) || typeof v[1] !== 'string') return fail('invalid_request');
    return v as PageKey;
  } catch { return fail('invalid_request'); }
}
function compare(a: PageKey, b: PageKey): number { return a[0] - b[0] || a[1].localeCompare(b[1]); }
function page<T>(rows: Iterable<T>, limit: number, after: PageKey | null, key: (v: T) => PageKey, descending = false) {
  const top: T[] = [];
  const cmp = (a: T, b: T) => compare(key(a), key(b)) * (descending ? -1 : 1);
  for (const row of rows) {
    if (after && compare(key(row), after) * (descending ? -1 : 1) <= 0) continue;
    top.push(row); top.sort(cmp); if (top.length > limit + 1) top.pop();
  }
  const more = top.length > limit;
  const items = top.slice(0, limit);
  return { items, next_cursor: more ? JSON.stringify(key(items[items.length - 1])) : null };
}
export const device_status = db.procedure({ request: t.string() }, t.string(), (ctx, { request }) => ctx.withTx(tx => {
  decode(request, 2048); const who = member(tx);
  return JSON.stringify({ identity: who.identity.toHexString(), device_id: who.deviceId, label: who.label, role: who.role });
}));
export const list_sessions = db.procedure({ request: t.string() }, t.string(), (ctx, { request }) => ctx.withTx(tx => {
  member(tx); const r = requestPage(request, 50);
  if (r.source !== undefined && r.source !== null && !['ac', 'sim', 'replay'].includes(String(r.source))) fail('invalid_request');
  const rows = function* () { for (const row of tx.db.sessions.iter()) if (!r.source || row.source === r.source) yield row; };
  const result = page(rows(), r.limit, cursor(r.cursor), row => [row.serverStartedAt, row.sessionId], true);
  return JSON.stringify({ ...result, items: result.items.map(normalized) });
}));
export const get_session = db.procedure({ request: t.string() }, t.string(), (ctx, { request }) => ctx.withTx(tx => {
  member(tx); const r = requestPage(request, 100); text(r.session_id);
  const session = tx.db.sessions.sessionId.find(r.session_id);
  if (!session) fail('not_found');
  const kind = r.kind ?? 'laps';
  if (!['laps', 'attempts', 'decisions'].includes(String(kind))) fail('invalid_request');
  const table = kind === 'laps' ? tx.db.laps : kind === 'attempts' ? tx.db.cornerAttempts : tx.db.coachingDecisions;
  const result = page(table.sessionId.filter(r.session_id), r.limit, cursor(r.cursor), row => [row.sequence, row.recordId]);
  return JSON.stringify({ ...result, session: normalized(session), items: result.items.map(normalized) });
}));
