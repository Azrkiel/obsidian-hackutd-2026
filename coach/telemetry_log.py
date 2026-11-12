"""Per-session telemetry log, kept on this PC only: speed, throttle and brake for every lap as CSV.

Live samples are never sent to the cloud. Each coach session writes data/telemetry/<session-id>.csv
(10 rows a second). The session id is the cloud history session when cloud history is running, so the
history viewer can match a saved session to its telemetry; otherwise it is a local id for this run.
"""
from __future__ import annotations

import csv
import io
import re
import time
import uuid
from pathlib import Path
from typing import Callable

COLUMNS = ("lap", "t_s", "pos_m", "speed_kmh", "gas", "brake", "steer", "gear")
SESSION_RE = re.compile(r"[A-Za-z0-9_-]{1,80}")
RATE_HZ = 10.0
FLUSH_S = 5.0


class TelemetryLog:
    def __init__(self, directory: str | Path, session_id: Callable[[], str | None] | None = None):
        self.dir = Path(directory)
        self._session_id = session_id or (lambda: None)
        self._local_id = "local-" + uuid.uuid4().hex[:12]
        self._sid: str | None = None
        self._file = None
        self._rows: list[tuple] = []
        self._last_t = -1e9
        self._last_pos = None
        self._lap = 1
        self._t0 = 0.0
        self._flushed = time.monotonic()

    def _current_id(self) -> str:
        sid = self._session_id()
        return sid if sid and SESSION_RE.fullmatch(sid) else self._local_id

    def _open(self, sid: str, t: float) -> None:
        self.flush()
        self._close_file()
        self._sid, self._lap, self._last_pos, self._t0 = sid, 1, None, t
        try:
            self.dir.mkdir(parents=True, exist_ok=True)
            path = self.dir / f"{sid}.csv"
            new = not path.exists()
            self._file = path.open("a", newline="", encoding="utf-8")
            if new:
                csv.writer(self._file).writerow(COLUMNS)
        except OSError:
            self._file = None            # storage unavailable: skip logging, never disturb the coach

    def add(self, s) -> None:
        """One telemetry sample. Cheap: rows are buffered and written every few seconds."""
        if s.status != "live" or s.t - self._last_t < 1.0 / RATE_HZ:
            return
        sid = self._current_id()
        if sid != self._sid:
            self._open(sid, s.t)
        pos = float(getattr(s, "pos_norm", 0.0) or 0.0)
        if self._last_pos is not None and self._last_pos - pos > 0.5:
            self._lap += 1                                     # crossed the line
        self._last_pos, self._last_t = pos, s.t
        self._rows.append((self._lap, round(s.t - self._t0, 2), round(s.pos_m, 1), round(s.speed_kmh, 1),
                           round(s.gas, 3), round(s.brake, 3), round(s.steer, 3),
                           "" if s.gear is None else s.gear))
        if time.monotonic() - self._flushed >= FLUSH_S:
            self.flush()

    def flush(self) -> None:
        if self._file is None:
            self._rows.clear()           # nowhere to write: drop, do not grow
            return
        if not self._rows:
            return
        try:
            csv.writer(self._file).writerows(self._rows)
            self._file.flush()
        except OSError:
            pass
        self._rows.clear()
        self._flushed = time.monotonic()

    def _close_file(self) -> None:
        if self._file is not None:
            try:
                self._file.close()
            except OSError:
                pass
            self._file = None

    def close(self) -> None:
        self.flush()
        self._close_file()


# ---- reading (used by the web routes) ------------------------------------------------------------
def list_sessions(directory: str | Path) -> list[dict]:
    d = Path(directory)
    out = []
    if not d.is_dir():
        return out
    for p in sorted(d.glob("*.csv"), key=lambda p: p.stat().st_mtime, reverse=True):
        if not SESSION_RE.fullmatch(p.stem):
            continue
        laps, rows = set(), 0
        try:
            with p.open(newline="", encoding="utf-8") as f:
                for r in csv.DictReader(f):
                    rows += 1
                    laps.add(int(r["lap"]))
        except (OSError, ValueError, KeyError):
            continue
        out.append({"session_id": p.stem, "laps": sorted(laps), "rows": rows,
                    "seconds": round(rows / RATE_HZ), "modified": p.stat().st_mtime})
    return out


def read_session(directory: str | Path, session_id: str, lap: int | None = None) -> list[dict] | None:
    if not SESSION_RE.fullmatch(session_id or ""):
        return None
    p = Path(directory) / f"{session_id}.csv"
    if not p.is_file():
        return None
    rows = []
    try:
        with p.open(newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                if lap is None or int(r["lap"]) == lap:
                    rows.append(r)
    except (OSError, ValueError, KeyError):
        return None
    return rows


def to_csv(rows: list[dict]) -> str:
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=COLUMNS, lineterminator="\n")
    w.writeheader()
    w.writerows(rows)
    return buf.getvalue()
