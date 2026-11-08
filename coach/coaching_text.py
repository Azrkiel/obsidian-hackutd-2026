"""What the lap coach says about a corner error: the context Nemotron gets, and the rules fallback.

Nemotron writes the live cue (see engine/nemotron.py rule 10). It gets `corner_guide` (what kind of
corner this is and the technique that matters there) and `recent_cues` (what was already said, so it
picks a different angle). When it is late or unusable, `actionable_cue` speaks instead: the corner,
what happened with one number, and one thing to do at a board, a kerb or the apex.
"""
from __future__ import annotations

from typing import Any

# Monza (fixtures/track_monza.json corner ids). Short, plain, no numbers: the numbers come from the event.
CORNER_GUIDE: dict[str, dict[str, str]] = {
    "t1": {"character": "heavy stop from top speed into a tight right-left chicane",
           "tip": "brake hard in a straight line, ease off as you turn in, take the second kerb and drive out"},
    "roggia": {"character": "left-right chicane after the fast Curva Grande",
               "tip": "brake straight before turning, use the inside kerbs, do not over-slow the exit"},
    "lesmo1": {"character": "fast right-hander",
               "tip": "a short brake or lift, carry speed, apex late and let the car run out wide"},
    "lesmo2": {"character": "tighter right-hander onto the long run to Ascari",
               "tip": "slow a little more than the first Lesmo, rotate the car, then throttle early for the straight"},
    "ascari": {"character": "fast left-right-left chicane",
               "tip": "one firm brake on entry, a smooth line through all three parts, commit to throttle on the last"},
    "parabolica": {"character": "long right-hander onto the main straight",
                   "tip": "brake in a straight line, turn in late, then build throttle and use all the exit kerb"},
}

KIND_PRIORITY = ("spin", "wheels_off", "lockup", "brake_late", "brake_early", "speed_loss", "wheelspin",
                 "time_lost")


def corner_guide(corner_id: str, name: str) -> dict[str, str]:
    g = CORNER_GUIDE.get(corner_id, {"character": "corner", "tip": "brake straight, hit the apex, smooth throttle out"})
    return {"name": name, **g}


def ref_board(cfg: Any, ref_brake_onset_m: float | None) -> int | None:
    """The distance board (50 m steps) where the reference starts braking, from the corner config."""
    zero = getattr(cfg, "board_zero_m", None)
    if zero is None or ref_brake_onset_m is None:
        return None
    b = int(round((zero - ref_brake_onset_m) / 50.0) * 50)
    return b if 50 <= b <= 300 else None


def primary_kind(kinds: list[str]) -> str:
    for k in KIND_PRIORITY:
        if k in kinds:
            return k
    return kinds[0] if kinds else "time_lost"


def actionable_cue(ev: Any, cfg: Any = None, recent_actions: list[str] | None = None) -> str:
    """Rules fallback: '<corner>: <what happened, one number>. <one action at a marker>.'
    If that action was just given, the corner's own tip is used instead, so the advice moves on."""
    from engine.tools import repeats
    what, do = describe(ev, cfg)
    if recent_actions and repeats(do, recent_actions):
        tip = corner_guide(ev.corner_id, ev.corner)["tip"]
        do = f"{tip[0].upper()}{tip[1:]}."
    return f"{what} {do}"


def with_facts(ev: Any, cfg: Any, action: str) -> str:
    """Nemotron's action, led by the corner and what happened (so those are always there and right)."""
    a = " ".join((action or "").split()).strip().rstrip(".")
    if not a:
        return actionable_cue(ev, cfg)
    if a.lower().startswith(ev.corner.lower()):             # the model named the corner itself
        a = a[len(ev.corner):].lstrip(" :,-")
    return f"{describe(ev, cfg)[0]} {a[0].upper()}{a[1:]}."


def describe(ev: Any, cfg: Any = None) -> tuple[str, str]:
    """('<corner>: <what happened, one number>.', '<One action at a marker>.')"""
    f, corner, kind = ev.facts, ev.corner, primary_kind(list(ev.kinds))
    lost = float(f.get("time_lost_s") or 0.0)
    board = ref_board(cfg, getattr(ev.ref, "brake_onset_m", None))
    at_board = f"at the {board} board" if board else "a bit earlier"
    d = f.get("brake_delta_m")
    if kind == "spin":
        what, do = "the car spun", "less brake as you turn in, and wait for the exit to add throttle"
    elif kind == "wheels_off":
        what, do = "wheels off the track", "turn in a touch later and aim for the apex kerb"
    elif kind == "lockup":
        what, do = "the fronts locked", f"brake {at_board} and ease the pedal as you turn in"
    elif kind == "brake_late" and d is not None:
        what, do = f"you braked {abs(d):.0f} m late", f"brake {at_board}"
    elif kind == "brake_early" and d is not None:
        what, do = f"you braked {abs(d):.0f} m early", f"brake later, {at_board}" if board else "brake later and carry speed"
    elif kind == "speed_loss":
        mn, ref = f.get("min_kmh"), f.get("ref_min_kmh")
        what = f"apex speed {mn:.0f} vs {ref:.0f} km/h" if mn and ref else "too slow at the apex"
        do = "release the brake earlier and roll more speed to the apex"
    elif kind == "wheelspin":
        what, do = "the rears spun on exit", "wait until the wheel straightens, then squeeze the throttle"
    else:
        what = f"{lost:.1f} s lost" if lost >= 0.1 else "time lost"
        do = corner_guide(ev.corner_id, corner)["tip"].split(",")[0]
    tail = f", {lost:.1f} s lost" if lost >= 0.1 and kind != "time_lost" else ""
    return f"{corner}: {what}{tail}.", f"{do[0].upper()}{do[1:]}."
