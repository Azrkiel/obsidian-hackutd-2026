import { expect, it } from "vitest";
import { leaderboard, bestLap, brakeTrend } from "../src/history";
const sessions = [
  {
    session_id: "s1",
    driver_id: "d1",
    track: "monza",
    car: "787b",
    corner: "T1",
    started_at: 1,
  },
  {
    session_id: "s2",
    driver_id: "d2",
    track: "monza",
    car: "787b",
    corner: "T1",
    started_at: 2,
  },
  {
    session_id: "s3",
    driver_id: "d1",
    track: "spa",
    car: "787b",
    corner: "T1",
    started_at: 3,
  },
];
const laps = [
  {
    lap_id: "l1",
    session_id: "s1",
    valid: true,
    section_s: 7,
    brake_board_m: 90,
    at: 1,
  },
  {
    lap_id: "l2",
    session_id: "s1",
    valid: false,
    section_s: 1,
    brake_board_m: 120,
    at: 2,
  },
  {
    lap_id: "l3",
    session_id: "s2",
    valid: true,
    section_s: 6.8,
    brake_board_m: 100,
    at: 3,
  },
  {
    lap_id: "l4",
    session_id: "s3",
    valid: true,
    section_s: 2,
    brake_board_m: 10,
    at: 4,
  },
];
it("ranks fastest valid laps per driver only within the selected course and car", () => {
  const context = { track: "monza", car: "787b", corner: "T1" };
  const rows = leaderboard(sessions, laps, context);
  expect(rows.map((r) => r.driver_id)).toEqual(["d2", "d1"]);
  expect(rows.map((r) => r.section_s)).toEqual([6.8, 7]);
  expect(bestLap(laps.filter((l) => l.session_id === "s1"))?.lap_id).toBe("l1");
  expect(
    bestLap([
      { valid: true, section_s: NaN },
      { valid: true, section_s: 0 },
    ]),
  ).toBeUndefined();
});
it("plots valid brake boards over sessions, with no missing metrics coerced to zero", () => {
  expect(brakeTrend(sessions.slice(0, 2), laps)).toEqual([
    { session_id: "s1", at: 1, board: 90 },
    { session_id: "s2", at: 2, board: 100 },
  ]);
});
