export type Session = {
  session_id: string;
  driver_id: string;
  track?: string;
  car?: string;
  corner?: string;
  started_at: number;
  ended_at?: number;
  plan?: unknown;
};
export type Lap = {
  lap_id?: string;
  session_id?: string;
  valid: boolean;
  section_s?: number;
  brake_board_m?: number;
  release_s?: number;
  n?: number;
  at?: number;
  role?: string;
  invalid_reason?: string;
};
export type Driver = { driver_id: string; name: string };
export type Decision = {
  lap_id: string;
  cue?: string;
  summary?: string;
  drill_id?: string;
  verdict?: string;
};
export type Course = { track?: string; car?: string; corner?: string };
export function bestLap(laps: Lap[]) {
  return laps
    .filter(
      (l) =>
        l.valid &&
        typeof l.section_s === "number" &&
        Number.isFinite(l.section_s) &&
        l.section_s > 0,
    )
    .sort((a, b) => a.section_s! - b.section_s!)[0];
}
export function leaderboard(sessions: Session[], laps: Lap[], context: Course) {
  const ids = new Map(
    sessions
      .filter(
        (s) =>
          s.track === context.track &&
          s.car === context.car &&
          s.corner === context.corner,
      )
      .map((s) => [s.session_id, s.driver_id]),
  );
  const grouped = new Map<string, Lap[]>();
  for (const lap of laps) {
    const driver = ids.get(lap.session_id!);
    if (driver) grouped.set(driver, [...(grouped.get(driver) || []), lap]);
  }
  return [...grouped]
    .flatMap(([driver_id, rows]) => {
      const lap = bestLap(rows);
      return lap ? [{ ...lap, driver_id }] : [];
    })
    .sort(
      (a, b) =>
        a.section_s! - b.section_s! || a.driver_id.localeCompare(b.driver_id),
    );
}
export function brakeTrend(sessions: Session[], laps: Lap[]) {
  return [...sessions]
    .sort((a, b) => a.started_at - b.started_at)
    .flatMap((s) => {
      const values = laps
        .filter(
          (l) =>
            l.session_id === s.session_id &&
            l.valid &&
            typeof l.brake_board_m === "number" &&
            Number.isFinite(l.brake_board_m),
        )
        .map((l) => l.brake_board_m!);
      return values.length
        ? [
            {
              session_id: s.session_id,
              at: s.started_at,
              board: values.reduce((a, b) => a + b, 0) / values.length,
            },
          ]
        : [];
    });
}
