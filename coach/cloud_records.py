"""Small, versioned history records. Never copy a complete live event to the cloud."""
from __future__ import annotations

import json
import time
import uuid
from typing import Callable

MAX_RECORD_BYTES = 32 * 1024
ATTEMPT_FIELDS = (
    "attempt_id", "valid", "invalid_reason", "entry_kmh", "apex_kmh", "exit_kmh",
    "brake_onset_m", "brake_board_m", "peak_brake", "throttle_pickup_m", "section_s",
    "release_s", "trail_brake_share", "lockup_s", "wheelspin_s", "min_kmh", "min_pos_m",
)
DECISION_FIELDS = (
    "decision_id", "attempt_id", "corner_id", "action", "drill_id", "cue", "verdict",
    "reminder", "end_reason", "summary", "mode", "provider", "model", "latency_ms", "plan_action",
)
CORNER_FIELDS = ("corner_id", "name", "attempt_id", "valid", "section_s", "delta_s")


def _select(value: dict, fields) -> dict:
    return {key: value[key] for key in fields if key in value}


def validate_record(record: dict) -> bytes:
    """Reject non-finite/oversized payloads before they enter the persistence queue."""
    if (not isinstance(record, dict) or record.get("schema_version") != 1 or
            not isinstance(record.get("record_id"), str) or not record["record_id"] or
            not isinstance(record.get("session_id"), str) or not record["session_id"] or
            type(record.get("sequence")) is not int or record["sequence"] < 0 or
            type(record.get("captured_at")) not in (int, float) or
            not isinstance(record.get("payload"), dict)):
        raise ValueError("invalid history record envelope")
    try:
        body = json.dumps(record, separators=(",", ":"), allow_nan=False).encode("utf-8")
    except (ValueError, TypeError, RecursionError) as exc:
        raise ValueError("history record contains invalid values") from exc
    if len(body) > MAX_RECORD_BYTES:
        raise ValueError("history record exceeds 32 KiB")
    return body


class RecordProjector:
    def __init__(self, source: str, mode: str, track: str, car: str = "", *,
                 clock: Callable[[], float] = time.time):
        if source not in ("ac", "sim", "replay") or mode not in ("lap", "drill"):
            raise ValueError("invalid history source or mode")
        self.source, self.mode, self.track, self.car, self.clock = source, mode, track, car, clock
        self.sessions: dict[str, dict] = {}
        self.attempt_sessions: dict[str, set[str]] = {}
        self.session_id = self._new_session()

    def _new_session(self) -> str:
        sid = str(uuid.uuid4())
        self.sessions[sid] = {"sequence": 0, "revision": 0, "started_at": self.clock(), "closed": False,
                              "track": self.track, "car": self.car}
        return sid

    def _make(self, kind: str, payload: dict, sid: str | None = None) -> dict:
        sid = sid or self.session_id
        if sid not in self.sessions:
            raise ValueError("unknown originating history session")
        state = self.sessions[sid]
        record = {"schema_version": 1, "record_id": str(uuid.uuid4()), "session_id": sid,
                  "sequence": state["sequence"], "captured_at": self.clock(), "payload": payload}
        validate_record(record)
        state["sequence"] += 1
        return {"kind": kind, "record": record}

    def session_record(self, status: str = "open", sid: str | None = None) -> dict:
        sid = sid or self.session_id
        state = self.sessions[sid]
        payload = {"revision": state["revision"], "source": self.source, "mode": self.mode,
                   "track": state["track"], "car": state["car"], "started_at": state["started_at"],
                   "ended_at": self.clock() if status == "closed" else None, "status": status}
        entry = self._make("session", payload, sid)
        state["revision"] += 1
        state["closed"] = status == "closed"
        return entry

    def end(self, incomplete: bool = False) -> dict:
        return self.session_record("incomplete" if incomplete else "closed")

    def update_metadata(self, track: str | None = None, car: str | None = None) -> list[dict]:
        track, car = track or self.track, car or self.car
        if (track, car) == (self.track, self.car):
            return []
        # Filling previously unknown metadata does not split a session. A confirmed change does.
        changed = bool((self.track and track != self.track) or (self.car and car != self.car))
        entries = [self.end()] if changed else []
        self.track, self.car = track, car
        if changed:
            self.session_id = self._new_session()
        else:
            self.sessions[self.session_id].update(track=track, car=car)
        entries.append(self.session_record())
        return entries

    def capture(self, event: dict) -> list[dict]:
        kind = event.get("type")
        if kind == "session":
            close = self.end()
            self.session_id = self._new_session()
            return [close, self.session_record()]
        if kind not in ("run", "track_lap", "decision"):
            return []
        sid = event.get("_history_session_id") or self.session_id
        if kind == "run":
            attempt = event.get("attempt")
            if not isinstance(attempt, dict) or not attempt.get("attempt_id"):
                raise ValueError("history attempt has no source ID")
            payload = _select(attempt, ATTEMPT_FIELDS)
            payload.update(_select(event, ("corner_id", "role")))
            entry = self._make("attempt", payload, sid)
            self.attempt_sessions.setdefault(str(attempt["attempt_id"]), set()).add(sid)
            return [entry]
        if kind == "track_lap":
            payload = _select(event, ("lap", "valid", "invalid_reason", "lap_time_s", "delta_s"))
            corners = event.get("corners") or []
            if not isinstance(corners, list) or len(corners) > 64:
                raise ValueError("invalid history corner summary")
            payload["corners"] = [_select(c, CORNER_FIELDS) for c in corners if isinstance(c, dict)]
            return [self._make("lap", payload, sid)]
        aid = str(event.get("attempt_id") or "")
        if not event.get("_history_session_id"):
            origins = self.attempt_sessions.get(aid, set())
            if len(origins) > 1:
                raise ValueError("ambiguous history decision session")
            if origins:
                sid = next(iter(origins))
        payload = _select(event, DECISION_FIELDS)
        if isinstance(event.get("target"), dict):
            payload["target"] = _select(event["target"], ("marker_m", "release_s"))
        else:
            payload["target"] = None
        return [self._make("decision", payload, sid)]
