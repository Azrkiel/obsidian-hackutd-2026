import { DbConnection } from "./module_bindings";
import QRCode from "qrcode";
import {
  bestLap,
  leaderboard,
  brakeTrend,
  type Session,
  type Lap,
  type Driver,
  type Decision,
  type Course,
} from "./history";
import "./style.css";

const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
type Data = {
  drivers: Driver[];
  sessions: Session[];
  laps: Lap[];
  decisions: Decision[];
};
type Config = {
  url?: string;
  database?: string;
  public_url?: string;
  driver_id?: string;
  track?: string;
  car?: string;
  corner?: string;
};
let data: Data = { drivers: [], sessions: [], laps: [], decisions: [] },
  config: Config = {},
  conn: DbConnection | undefined;
let live = false,
  course: Course = {},
  driver = "",
  session = "",
  view = "history",
  best: Lap | undefined,
  retry: ReturnType<typeof setTimeout> | undefined;
const params = new URLSearchParams(location.search);
if (params.get("embedded") === "1") document.body.classList.add("embedded");
function status(text: string) {
  $("connection").textContent = text;
}
function options(id: string, rows: [string, string][], selected: string) {
  const el = $<HTMLSelectElement>(id);
  el.replaceChildren(
    ...rows.map(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      return option;
    }),
  );
  el.value = selected;
}
function cells(
  parent: HTMLElement,
  rows: { values: string[]; invalid?: boolean }[],
) {
  parent.replaceChildren(
    ...rows.map((row) => {
      const tr = document.createElement("tr");
      if (row.invalid) tr.className = "invalid";
      for (const value of row.values) {
        const td = document.createElement("td");
        td.textContent = value;
        tr.append(td);
      }
      return tr;
    }),
  );
}
const num = (n: number | undefined, d = 2) =>
  typeof n === "number" && Number.isFinite(n) ? n.toFixed(d) : "--";
const stamp = (at: number) => new Date(at * 1000).toLocaleString();
const courseKey = (s: Course) => JSON.stringify([s.track, s.car, s.corner]);
function render() {
  const courses = [
    ...new Map(
      data.sessions.map((s) => [
        courseKey(s),
        { track: s.track, car: s.car, corner: s.corner },
      ]),
    ).values(),
  ];
  if (!courses.some((s) => courseKey(s) === courseKey(course)))
    course = courses[0] || {};
  options(
    "course",
    courses.map((c) => [
      courseKey(c),
      `${c.track || "Unknown track"} / ${c.car || "Unknown car"} / ${c.corner || "Corner"}`,
    ]),
    courseKey(course),
  );
  const sameCourse = data.sessions.filter(
    (s) => courseKey(s) === courseKey(course),
  );
  const ids = new Set(sameCourse.map((s) => s.driver_id));
  const drivers = data.drivers.filter((d) => ids.has(d.driver_id));
  if (!drivers.some((d) => d.driver_id === driver))
    driver = drivers[0]?.driver_id || "";
  options(
    "driver",
    drivers.map((d) => [d.driver_id, d.name]),
    driver,
  );
  const sessions = sameCourse
    .filter((s) => s.driver_id === driver)
    .sort((a, b) => b.started_at - a.started_at);
  if (session && !sessions.some((s) => s.session_id === session)) session = "";
  options(
    "session",
    [
      ["", "All sessions"],
      ...sessions.map(
        (s) =>
          [
            s.session_id,
            `${stamp(s.started_at)}${s.ended_at ? "" : " (open)"}`,
          ] as [string, string],
      ),
    ],
    session,
  );
  const sids = new Set(sessions.map((s) => s.session_id));
  const allLaps = data.laps
    .filter((l) => sids.has(l.session_id!))
    .sort((a, b) => (b.at || 0) - (a.at || 0));
  best = bestLap(allLaps);
  const last = allLaps[0];
  $("best").textContent = best ? num(best.section_s) + " s" : "--";
  $("last").textContent = last?.valid ? num(last.section_s) + " s" : "--";
  $("last-note").textContent = last
    ? last.valid
      ? "Latest valid pass"
      : `Latest pass invalid: ${last.invalid_reason || "not scored"}`
    : "Waiting for a scored pass";
  $("sessions-count").textContent = String(sessions.length);
  const laps = allLaps.filter((l) => !session || l.session_id === session);
  $("empty").hidden = laps.length > 0;
  cells(
    $("laps"),
    laps.map((l) => {
      const s = sessions.find((s) => s.session_id === l.session_id);
      const d = data.decisions.find((d) => d.lap_id === l.lap_id);
      return {
        invalid: !l.valid,
        values: [
          `${s ? stamp(s.started_at) : ""} / ${l.n || "--"}`,
          l.role || "pass",
          l.valid
            ? num(l.section_s) + " s"
            : `Invalid: ${l.invalid_reason || "unknown"}`,
          num(l.brake_board_m, 1) + " m",
          num(l.release_s) + " s",
          d?.cue || d?.summary || "--",
        ],
      };
    }),
  );
  $<HTMLButtonElement>("ghost").disabled = !best;
  const points = brakeTrend(sessions, allLaps);
  const svg = $("trend");
  svg.replaceChildren();
  if (points.length) {
    const low = Math.min(...points.map((p) => p.board)) - 5,
      high = Math.max(...points.map((p) => p.board)) + 5;
    const line = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "polyline",
    );
    line.setAttribute("fill", "none");
    line.setAttribute("stroke", "#69b7ff");
    line.setAttribute("stroke-width", "3");
    line.setAttribute(
      "points",
      points
        .map(
          (p, i) =>
            `${30 + (i / Math.max(1, points.length - 1)) * 740},${125 - ((p.board - low) / (high - low)) * 100}`,
        )
        .join(" "),
    );
    svg.append(line);
    points.forEach((p, i) => {
      const dot = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle",
      );
      dot.setAttribute(
        "cx",
        String(30 + (i / Math.max(1, points.length - 1)) * 740),
      );
      dot.setAttribute(
        "cy",
        String(125 - ((p.board - low) / (high - low)) * 100),
      );
      dot.setAttribute("r", "5");
      dot.setAttribute("fill", "#69b7ff");
      const title = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "title",
      );
      title.textContent = `${stamp(p.at)}: ${p.board.toFixed(1)} m`;
      dot.append(title);
      svg.append(dot);
    });
  }
  $("trend-summary").textContent = points.length
    ? points
        .map(
          (p) =>
            `${new Date(p.at * 1000).toLocaleDateString()}: ${p.board.toFixed(1)} m`,
        )
        .join(" / ")
    : "No measured brake boards yet.";
  const board = leaderboard(data.sessions, data.laps, course);
  $("board-empty").hidden = board.length > 0;
  cells(
    $("board"),
    board.map((l, i) => ({
      values: [
        String(i + 1),
        data.drivers.find((d) => d.driver_id === l.driver_id)?.name || "Driver",
        num(l.section_s) + " s",
      ],
    })),
  );
  updateShare();
}
let shareKey = "";
function updateShare() {
  let url: URL;
  try {
    url = new URL(config.public_url || location.href);
  } catch {
    url = new URL(location.href);
  }
  url.search = "";
  url.hash = "";
  url.searchParams.set("view", "leaderboard");
  if (config.url) url.searchParams.set("server", config.url);
  if (config.database) url.searchParams.set("db", config.database);
  for (const k of ["track", "car", "corner"] as const)
    if (course[k]) url.searchParams.set(k, course[k]!);
  if (url.href === shareKey) return;
  shareKey = url.href;
  const a = $<HTMLAnchorElement>("share");
  a.href = url.href;
  QRCode.toDataURL(url.href, { width: 224, margin: 2 })
    .then((src) => {
      $<HTMLImageElement>("qr").src = src;
    })
    .catch(() => {
      $("qr-note").textContent = "Use the link to open this board.";
    });
  const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  $("qr-note").textContent = isLocal
    ? "This address opens only on this PC. Set HISTORY_PUBLIC_URL to a public viewer URL, or use the PC LAN address."
    : "Open this link on the same network, or use the public viewer URL.";
}
function tab(next: string) {
  view = next;
  const isBoard = view === "leaderboard";
  $("history-view").hidden = isBoard;
  $("leaderboard-view").hidden = !isBoard;
  $("driver-label").hidden = isBoard;
  $("session-label").hidden = isBoard;
  $("history-tab").setAttribute("aria-pressed", String(!isBoard));
  $("leaderboard-tab").setAttribute("aria-pressed", String(isBoard));
}
$("history-tab").onclick = () => tab("history");
$("leaderboard-tab").onclick = () => tab("leaderboard");
$("course").onchange = () => {
  const [track, car, corner] = JSON.parse($<HTMLSelectElement>("course").value);
  course = { track, car, corner };
  session = "";
  render();
};
$("driver").onchange = () => {
  driver = $<HTMLSelectElement>("driver").value;
  session = "";
  render();
};
$("session").onchange = () => {
  session = $<HTMLSelectElement>("session").value;
  render();
};
// Generated client fields are camelCase; the local API uses the database's snake_case.
const normalize = <T>(row: unknown) =>
  Object.fromEntries(
    Object.entries(row as object).map(([k, v]) => [
      k.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase()),
      v,
    ]),
  ) as T;
let repaint = false,
  connectionGeneration = 0;
function cloudRows() {
  if (repaint) return;
  repaint = true;
  queueMicrotask(() => {
    repaint = false;
    if (!conn || !live) return;
    data = {
      drivers: [...conn.db.driver.iter()].map(normalize<Driver>),
      sessions: [...conn.db.session.iter()].map(normalize<Session>),
      laps: [...conn.db.lap.iter()].map(normalize<Lap>),
      decisions: [...conn.db.decision.iter()].map(normalize<Decision>),
    };
    render();
  });
}
function connect() {
  const generation = ++connectionGeneration;
  clearTimeout(retry);
  conn?.disconnect();
  live = false;
  if (!config.url || !config.database) {
    status("Local SQLite history");
    return;
  }
  status("Connecting to live history...");
  const lost = () => {
    if (generation === connectionGeneration) {
      live = false;
      status("Live connection offline; showing saved data");
    }
  };
  conn = DbConnection.builder()
    .withUri(config.url)
    .withDatabaseName(config.database)
    .withAutomaticReconnect()
    .onConnect((c) => {
      for (const table of [
        c.db.driver,
        c.db.session,
        c.db.lap,
        c.db.decision,
      ]) {
        table.onInsert(cloudRows);
        table.onUpdate(cloudRows);
        table.onDelete(cloudRows);
      }
      c.subscriptionBuilder()
        .onApplied(() => {
          live = true;
          status("Live / subscribed");
          cloudRows();
        })
        .onError(() => {
          lost();
        })
        .subscribe([
          "SELECT * FROM driver",
          "SELECT * FROM session",
          "SELECT * FROM lap",
          "SELECT * FROM decision",
        ]);
    })
    .onConnectError(() => {
      if (generation === connectionGeneration) {
        lost();
        retry = setTimeout(connect, 5000);
      }
    })
    .onDisconnect((_c, _e, next) => {
      if (generation === connectionGeneration) {
        lost();
        if (next === undefined) retry = setTimeout(connect, 5000);
      }
    })
    .onAutomaticReconnect(() =>
      status("Reconnecting / refreshing subscription..."),
    )
    .build();
}
async function local() {
  if (live) return;
  try {
    const response = await fetch("/history");
    if (!response.ok) throw Error();
    const rows = await response.json();
    if (rows.enabled && !rows.error) {
      data = rows;
      render();
      if (!config.database) status("Local SQLite / saved on this PC");
    } else if (!config.database)
      status(
        rows.error
          ? "Local history unavailable"
          : "History is off. Start the coach with --history.",
      );
  } catch {
    if (!config.database)
      status("Local history unavailable. Configure a live connection.");
  }
}
$("ghost").onclick = async () => {
  const id = best?.lap_id;
  if (!id) return;
  const show = (rows: unknown[]) => {
    if (window.parent !== window)
      window.parent.postMessage(
        { type: "history-ghost", rows },
        location.origin,
      );
    $("ghost-status").textContent =
      `Best-lap ghost loaded (${rows.length} trace points).`;
  };
  try {
    if (conn && live) {
      let sub: ReturnType<
        ReturnType<DbConnection["subscriptionBuilder"]>["subscribe"]
      >;
      sub = conn
        .subscriptionBuilder()
        .onApplied(() => {
          const row = conn!.db.lapTrace.lapId.find(id);
          if (row) show(JSON.parse(row.rows));
          sub.unsubscribe();
        })
        .onError(() => {
          $("ghost-status").textContent = "Trace unavailable.";
        })
        .subscribe(
          `SELECT * FROM lap_trace WHERE lap_id = '${id.replaceAll("'", "''")}'`,
        );
    } else {
      const response = await fetch("/history/trace/" + encodeURIComponent(id));
      if (!response.ok) throw Error();
      show((await response.json()).rows);
    }
  } catch {
    $("ghost-status").textContent = "Trace unavailable.";
  }
};
$("cloud-settings").onsubmit = (e) => {
  e.preventDefault();
  const url = $<HTMLInputElement>("server").value.trim();
  const database = $<HTMLInputElement>("database").value.trim();
  if (!/^https?:\/\//.test(url)) {
    status("Enter an HTTP(S) server URL.");
    return;
  }
  config = { ...config, url, database };
  const page = new URL(location.href);
  page.searchParams.set("server", url);
  page.searchParams.set("db", database);
  history.replaceState(null, "", page);
  connect();
  render();
};
async function start() {
  try {
    const r = await fetch("/history/config");
    if (r.ok) config = await r.json();
  } catch {
    /* Standalone public hosting uses URL parameters. */
  }
  config = {
    ...config,
    url: params.get("server") || config.url,
    database: params.get("db") || config.database,
  };
  course = {
    track: params.get("track") || config.track,
    car: params.get("car") || config.car,
    corner: params.get("corner") || config.corner,
  };
  driver = config.driver_id || "";
  $<HTMLInputElement>("server").value = config.url || "";
  $<HTMLInputElement>("database").value = config.database || "";
  tab(params.get("view") === "leaderboard" ? "leaderboard" : "history");
  render();
  await local();
  connect();
  setInterval(local, 5000);
}
start();
