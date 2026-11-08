"""Session plan: 1 to 3 ordered goals, each one drill with a target, a cue and a done condition."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field

from .evidence import DRILL_METRIC, DRILL_TARGET

PENDING, ACTIVE, DONE, FAILED = "pending", "active", "done", "failed"
MAX_GOALS = 3
TITLES = {"brake_point": "Brake point", "brake_release": "Brake release",
          "throttle_pickup": "Throttle pickup"}


@dataclass
class Goal:
    drill_id: str
    target: dict
    cue: str
    reminder: str = ""
    title: str = ""
    in_a_row: int = 1          # done when the target is hit this many retries in a row
    status: str = PENDING
    hits: int = 0              # current streak of retries inside tolerance
    tries: int = 0

    def done_when(self, tolerance: dict) -> str:
        key = DRILL_METRIC.get(self.drill_id, "")
        tkey = DRILL_TARGET.get(self.drill_id, "marker_m")
        tol = tolerance.get(key)
        unit = "s" if key == "release_s" else "m"
        v = self.target.get(tkey)
        what = {"brake_point": f"brake at the {v} m board", "brake_release": f"release over {v} s",
                "throttle_pickup": f"throttle {v} m past the apex"}.get(self.drill_id, str(self.target))
        times = "" if self.in_a_row <= 1 else f", {self.in_a_row} times in a row"
        return f"{what}, within {tol} {unit}{times}"


@dataclass
class Plan:
    goals: list[Goal]
    active: int = 0
    revisions: int = 0
    reason: str = ""
    finished: bool = False
    log: list[dict] = field(default_factory=list)

    @classmethod
    def from_goals(cls, goals: list[dict], reason: str = "") -> "Plan":
        gs = [Goal(drill_id=g["drill_id"], target=dict(g["target"]), cue=g.get("cue", ""),
                   reminder=g.get("reminder") or "", title=g.get("title") or TITLES.get(g["drill_id"], g["drill_id"]),
                   in_a_row=int(g.get("in_a_row") or 1)) for g in goals[:MAX_GOALS]]
        p = cls(gs, reason=reason)
        if gs:
            gs[0].status = ACTIVE
        return p

    @property
    def goal(self) -> Goal | None:
        if self.finished or self.active >= len(self.goals):
            return None
        return self.goals[self.active]

    def record(self, hit: bool) -> None:
        g = self.goal
        if g is None:
            return
        g.tries += 1
        g.hits = g.hits + 1 if hit else 0

    def advance(self, met: bool) -> Goal | None:
        """Close the active goal; return the next one (now active) or None when the plan is done."""
        g = self.goal
        if g is not None:
            g.status = DONE if met else FAILED
            self.log.append({"goal": g.title, "outcome": g.status})
        self.active += 1
        nxt = self.goal
        if nxt is None:
            self.finished = True
        else:
            nxt.status = ACTIVE
        return nxt

    def revise(self, goals: list[dict], reason: str) -> Goal | None:
        """Replace the active and pending goals; finished ones stay on the checklist."""
        kept = [g for g in self.goals[:self.active]]
        cur = self.goal
        if cur is not None:
            cur.status = FAILED
            kept.append(cur)
        fresh = Plan.from_goals(goals).goals
        self.goals = kept + fresh
        self.active = len(kept)
        self.revisions += 1
        self.reason = reason
        self.finished = not fresh
        self.log.append({"revised": reason})
        return self.goal

    def to_dict(self, tolerance: dict | None = None) -> dict:
        tol = tolerance or {}
        return {"active": self.active, "finished": self.finished, "revisions": self.revisions,
                "reason": self.reason,
                "goals": [{**asdict(g), "done_when": g.done_when(tol)} for g in self.goals]}


def rule_plan(packet: dict) -> list[dict]:
    """Rules fallback: one goal per drill over tolerance, brake point first (max 3)."""
    from .rules import BASELINE_ORDER, _baseline_cue, reminder_for
    d, tol = packet["delta"], packet["tolerance"]
    goals = []
    if not packet["valid"] or not packet["comparable"]:
        return goals
    for drill in BASELINE_ORDER:
        key = DRILL_METRIC[drill]
        if drill in packet["allowed"]["drills"] and drill in packet["suggested"] \
                and key in d and key in tol and abs(d[key]) > tol[key]:
            target, cue = _baseline_cue(packet, drill)
            goals.append({"drill_id": drill, "target": target, "cue": cue,
                          "reminder": reminder_for(drill, d[key]), "in_a_row": 1})
    return goals[:MAX_GOALS]
