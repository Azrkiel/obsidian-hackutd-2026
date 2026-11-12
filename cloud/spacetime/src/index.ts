import {
  schema,
  table,
  t,
  SenderError,
  type ReducerCtx,
  type InferSchema,
} from "spacetimedb/server";
import type { Infer } from "spacetimedb";

const driver = table(
  { public: true },
  {
    driver_id: t.string().primaryKey(),
    name: t.string(),
    source: t.string(),
    created_at: t.f64(),
    revision: t.u32(),
  },
);
const session = table(
  { public: true },
  {
    session_id: t.string().primaryKey(),
    driver_id: t.string(),
    track: t.string(),
    car: t.string(),
    corner: t.string(),
    mode: t.string(),
    agent: t.bool(),
    model: t.string().optional(),
    started_at: t.f64(),
    ended_at: t.f64().optional(),
    plan: t.string().optional(),
    recording: t.string().optional(),
    revision: t.u32(),
  },
);
const lap = table(
  { public: true },
  {
    lap_id: t.string().primaryKey(),
    session_id: t.string(),
    n: t.u32(),
    attempt_id: t.string(),
    role: t.string(),
    valid: t.bool(),
    invalid_reason: t.string().optional(),
    section_s: t.f64().optional(),
    entry_kmh: t.f64().optional(),
    apex_kmh: t.f64().optional(),
    exit_kmh: t.f64().optional(),
    brake_onset_m: t.f64().optional(),
    brake_board_m: t.f64().optional(),
    peak_brake: t.f64().optional(),
    throttle_pickup_m: t.f64().optional(),
    release_s: t.f64().optional(),
    trail_brake_share: t.f64().optional(),
    lockup_s: t.f64().optional(),
    wheelspin_s: t.f64().optional(),
    min_kmh: t.f64().optional(),
    min_pos_m: t.f64().optional(),
    input_dropout: t.bool(),
    inputs: t.string().optional(),
    at: t.f64(),
    revision: t.u32(),
  },
);
const lapTrace = table(
  { name: "lap_trace", public: true },
  {
    lap_id: t.string().primaryKey(),
    rows: t.string(),
    revision: t.u32(),
  },
);
const decision = table(
  { public: true },
  {
    decision_id: t.string().primaryKey(),
    lap_id: t.string(),
    label: t.string().optional(),
    action: t.string().optional(),
    drill_id: t.string().optional(),
    target: t.string().optional(),
    cue: t.string().optional(),
    verdict: t.string().optional(),
    mode: t.string().optional(),
    provider: t.string().optional(),
    model: t.string().optional(),
    latency_ms: t.f64().optional(),
    summary: t.string().optional(),
    at: t.f64(),
    revision: t.u32(),
  },
);
// Private singleton. register_coach must run before distributing the spectator link.
const coachOwner = table(
  { name: "coach_owner" },
  { slot: t.u8().primaryKey(), identity: t.identity() },
);
const db = schema({ driver, session, lap, lapTrace, decision, coachOwner });
export default db;
type Context = ReducerCtx<InferSchema<typeof db>>;

function guard(ctx: Context) {
  const owner = ctx.db.coachOwner.slot.find(0);
  if (!owner || !owner.identity.isEqual(ctx.sender))
    throw new SenderError("coach only");
}
function uuid(id: string) {
  if (
    typeof id !== "string" ||
    !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)
  )
    throw new SenderError("invalid UUID");
}
function decode<T>(payload: string): T {
  // Optional SQLite columns use null; the TypeScript SDK represents options as undefined.
  const obj = JSON.parse(payload, (_key, value) =>
    value === null ? undefined : value,
  );
  if (!obj || typeof obj !== "object" || Array.isArray(obj))
    throw new SenderError("expected row object");
  return obj as T;
}
function newer(
  old: { revision: number } | null | undefined,
  row: { revision: number },
) {
  if (!Number.isInteger(row.revision) || row.revision < 1)
    throw new SenderError("invalid revision");
  return !old || row.revision > old.revision;
}

export const register_coach = db.reducer((ctx) => {
  const owner = ctx.db.coachOwner.slot.find(0);
  if (owner) {
    guard(ctx);
    return;
  }
  ctx.db.coachOwner.insert({ slot: 0, identity: ctx.sender });
});
export const upsert_driver = db.reducer(
  { payload: t.string() },
  (ctx, { payload }) => {
    guard(ctx);
    const row = decode<Infer<typeof driver.rowType>>(payload);
    uuid(row.driver_id);
    const old = ctx.db.driver.driver_id.find(row.driver_id);
    if (newer(old, row))
      old ? ctx.db.driver.driver_id.update(row) : ctx.db.driver.insert(row);
  },
);

function saveSession(ctx: Context, payload: string) {
  guard(ctx);
  const row = decode<Infer<typeof session.rowType>>(payload);
  uuid(row.session_id);
  if (!ctx.db.driver.driver_id.find(row.driver_id))
    throw new SenderError("driver missing");
  const old = ctx.db.session.session_id.find(row.session_id);
  if (newer(old, row))
    old ? ctx.db.session.session_id.update(row) : ctx.db.session.insert(row);
}
export const start_session = db.reducer({ payload: t.string() }, (ctx, args) =>
  saveSession(ctx, args.payload),
);
// These accept the full versioned row too, so delayed retries cannot reopen a session or erase its plan.
export const end_session = db.reducer({ payload: t.string() }, (ctx, args) =>
  saveSession(ctx, args.payload),
);
export const set_plan = db.reducer({ payload: t.string() }, (ctx, args) =>
  saveSession(ctx, args.payload),
);

export const record_lap = db.reducer(
  { payload: t.string() },
  (ctx, { payload }) => {
    guard(ctx);
    const { lap: row, trace } = decode<{
      lap: Infer<typeof lap.rowType>;
      trace: Infer<typeof lapTrace.rowType>;
    }>(payload);
    uuid(row.lap_id);
    if (trace.lap_id !== row.lap_id)
      throw new SenderError("trace belongs to another lap");
    if (!Array.isArray(JSON.parse(trace.rows)))
      throw new SenderError("trace must be an array");
    if (!ctx.db.session.session_id.find(row.session_id))
      throw new SenderError("session missing");
    if (
      row.valid &&
      !(
        typeof row.section_s === "number" &&
        Number.isFinite(row.section_s) &&
        row.section_s > 0
      )
    )
      throw new SenderError("invalid section time");
    const old = ctx.db.lap.lap_id.find(row.lap_id);
    if (newer(old, row))
      old ? ctx.db.lap.lap_id.update(row) : ctx.db.lap.insert(row);
    const oldTrace = ctx.db.lapTrace.lap_id.find(trace.lap_id);
    if (newer(oldTrace, trace))
      oldTrace
        ? ctx.db.lapTrace.lap_id.update(trace)
        : ctx.db.lapTrace.insert(trace);
  },
);
export const record_decision = db.reducer(
  { payload: t.string() },
  (ctx, { payload }) => {
    guard(ctx);
    const row = decode<Infer<typeof decision.rowType>>(payload);
    uuid(row.decision_id);
    if (!ctx.db.lap.lap_id.find(row.lap_id))
      throw new SenderError("lap missing");
    const old = ctx.db.decision.decision_id.find(row.decision_id);
    if (newer(old, row))
      old
        ? ctx.db.decision.decision_id.update(row)
        : ctx.db.decision.insert(row);
  },
);
