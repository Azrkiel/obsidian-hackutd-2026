import { expect, it } from "vitest";
import { ConnectionId } from "spacetimedb";
import {
  createModuleTestHarness,
  TestAuth,
} from "spacetimedb/server/test-utils";
import db, * as reducers from "../src/index";

const principal = (sub: string) =>
  TestAuth.fromJwtPayload(
    JSON.stringify({ iss: "test", sub }),
    new ConnectionId(1n),
  );
const driver = {
  driver_id: "7ff79c73-e971-45d1-bbf5-c22d7e409a90",
  name: "Kevin",
  source: "dashboard",
  created_at: 1,
  revision: 1,
};
const session = {
  session_id: "a75257b5-3e5c-400c-86d1-bdf9569c38b0",
  driver_id: driver.driver_id,
  track: "monza",
  car: "787b",
  corner: "T1",
  mode: "drill",
  agent: true,
  model: null,
  started_at: 1,
  ended_at: null,
  plan: null,
  recording: null,
  revision: 1,
};
const lap = {
  lap_id: "9fdcf7d3-17ad-46b1-ac05-c1e4da8095c3",
  session_id: session.session_id,
  n: 1,
  attempt_id: "a-0001",
  role: "baseline",
  valid: true,
  invalid_reason: null,
  section_s: 6.8,
  entry_kmh: 300,
  apex_kmh: 70,
  exit_kmh: 120,
  brake_onset_m: 300,
  brake_board_m: 100,
  peak_brake: 0.9,
  throttle_pickup_m: 20,
  release_s: 0.5,
  trail_brake_share: 0.3,
  lockup_s: null,
  wheelspin_s: null,
  min_kmh: 70,
  min_pos_m: 450,
  input_dropout: false,
  inputs: "null",
  at: 2,
  revision: 1,
};
const trace = {
  lap_id: lap.lap_id,
  rows: '[{"pos_m":100,"brake":0.5}]',
  revision: 1,
};

it("refuses every write and re-registration by a second identity", () => {
  const test = createModuleTestHarness(db, reducers);
  test.withReducerTx(principal("coach"), (ctx) =>
    reducers.register_coach(ctx, {}),
  );
  for (const [fn, args] of [
    [reducers.register_coach, {}],
    [reducers.upsert_driver, { payload: JSON.stringify(driver) }],
    [reducers.start_session, { payload: JSON.stringify(session) }],
    [reducers.record_lap, { payload: JSON.stringify({ lap, trace }) }],
    [reducers.end_session, { payload: JSON.stringify(session) }],
    [reducers.set_plan, { payload: JSON.stringify(session) }],
    [reducers.record_decision, { payload: "{}" }],
  ] as const) {
    expect(() =>
      test.withReducerTx(principal("viewer"), (ctx) => fn(ctx, args as never)),
    ).toThrow("coach only");
  }
  expect(test.db.lap.count()).toBe(0n);
});

it("upserts by UUID, writes lap and trace atomically, and ignores older revisions", () => {
  const test = createModuleTestHarness(db, reducers);
  const call = (fn: any, obj?: unknown) =>
    test.withReducerTx(principal("coach"), (ctx) =>
      fn(ctx, obj === undefined ? {} : { payload: JSON.stringify(obj) }),
    );
  call(reducers.register_coach);
  call(reducers.upsert_driver, driver);
  call(reducers.start_session, session);
  call(reducers.record_lap, { lap, trace });
  call(reducers.record_lap, { lap, trace });
  expect(test.db.lap.count()).toBe(1n);
  expect(test.db.lapTrace.count()).toBe(1n);
  call(reducers.record_lap, {
    lap: { ...lap, role: "reference", revision: 2 },
    trace,
  });
  call(reducers.record_lap, { lap, trace });
  expect([...test.db.lap.iter()][0].role).toBe("reference");
  expect(() =>
    call(reducers.record_lap, { lap: { ...lap, lap_id: "bad" }, trace }),
  ).toThrow();
  expect(test.db.lap.count()).toBe(1n);
  expect(() =>
    call(reducers.record_lap, { lap, trace: { ...trace, rows: "broken" } }),
  ).toThrow();
});
