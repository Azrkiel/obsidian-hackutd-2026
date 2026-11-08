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
    end_reason: str | None = None
    summary: str = ""
    mode: str = "rules"  # think | fast | rules
    provider: str | None = None
    model: str | None = None
    latency_ms: float = 0.0
    reasoning: str = ""

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
