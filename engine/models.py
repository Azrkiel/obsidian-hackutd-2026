"""Plain dataclasses shared across the engine."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class CornerConfig:
    name: str
    track_length_m: float
    start_gate_m: float
    apex_window_m: tuple[float, float]
    exit_gate_m: float
    board_zero_m: float
    comparable_entry_kmh: float
    tolerance: dict[str, float]
    allowed: dict[str, Any]
    gates: dict[str, float] | None = None  # brake_m, turn_in_m, apex1_m, apex2_m (ac_track_extract)
    reminder_m: float | None = None  # lap mode: where the spoken reminder plays on the approach
    wheelbase_m: float = 2.6  # understeer index (787B is about 2.6 m)

    telemetry_verified: dict[str, bool] = field(default_factory=dict)
    racing_line: list[list[float]] | None = None  # [track metres, world x, world z]

    def gate(self, name: str) -> float:
        """Named corner positions with defaults derived from the placeholder config."""
        g = self.gates or {}
        a0, a1 = self.apex_window_m
        defaults = {"start_m": self.start_gate_m, "brake_m": self.board_zero_m - 150.0,
                    "turn_in_m": a0 - 30.0, "apex1_m": a0, "apex2_m": a1, "exit_m": self.exit_gate_m}
        return float(g.get(name, defaults[name]))

    @property
    def reminder_pos_m(self) -> float:
        if self.reminder_m is not None:
            return float(self.reminder_m)
        # about 300 m before the braking zone, but clear of the lap line (cues disarm on a wrap)
        return max(self.gate("brake_m") - 300.0, min(50.0, self.start_gate_m / 2))


@dataclass
class Attempt:
    attempt_id: str
    valid: bool
    invalid_reason: str | None
    entry_kmh: float
    apex_kmh: float
    exit_kmh: float
    brake_onset_m: float
    peak_brake: float
    throttle_pickup_m: float
    section_s: float
    # driving-profile extras (None when the run or an old fixture does not have them)
    release_s: float | None = None        # peak brake -> brake below 10%
    trail_brake_share: float | None = None
    lockup_s: float | None = None
    wheelspin_s: float | None = None
    min_kmh: float | None = None
    min_pos_m: float | None = None

    time_to_peak_s: float | None = None
    coast_s: float | None = None
    min_vs_apex_m: float | None = None
    full_throttle_s: float | None = None
    turn_in_m: float | None = None
    last_downshift_m: float | None = None
    line_offset_m: float | None = None

    @classmethod
    def from_dict(cls, d: dict) -> "Attempt":
        keys = cls.__dataclass_fields__.keys()
        return cls(**{k: d.get(k) for k in keys})


@dataclass
class ToolCall:
    name: str
    arguments: dict[str, Any]
    id: str | None = None


@dataclass
class Decision:
    decision_id: str
    attempt_id: str
    action: str  # offer_drill | end_drill
    drill_id: str | None = None
    target: dict | None = None
    cue: str = ""
    verdict: str | None = None  # repeat | adjust | None
    reminder: str = ""  # lap mode: spoken on the approach next lap
    end_reason: str | None = None
    summary: str = ""
    mode: str = "rules"  # think | fast | rules
    provider: str | None = None
    model: str | None = None
    latency_ms: float = 0.0
    reasoning: str = ""
    plan: dict | None = None  # agent mode: the session plan after this decision
    plan_action: str | None = None  # set_plan | advance_plan | revise_plan | end_session
    tool_calls: list = field(default_factory=list)  # agent mode: read-tool rounds

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class DrillState:
    """Current drill context fed into evidence packets."""
    drill_id: str
    target: dict
    tries: int = 0


@dataclass
class ModelResult:
    """What a provider returns for one call."""
    call: ToolCall | None
    reasoning: str = ""
    content: str = ""
    latency_ms: float = 0.0
    first_reasoning_ms: float | None = None
    model: str | None = None
    extra: dict = field(default_factory=dict)
