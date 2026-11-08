"""Registry contract, every drill's coaching loop, and telemetry prerequisites."""
from dataclasses import replace

import pytest

from engine.drills import DRILLS, DRILL_METRIC, DRILL_TARGET, TARGET_PROPERTIES, eligible, target_hit
from engine.evidence import build_packet
from engine.models import DrillState, ToolCall
from engine.rules import rule_decide
from engine.tools import TOOLS, validate
from engine.plan import rule_plan, Goal
from engine.live_cue import LiveCue, NullPlayer
from engine.nemotron import SYSTEM_PROMPT
from engine.agent_tools import AGENT_PROMPT, AgentSession, _GOAL

NEW = list(DRILLS)[3:]
REFERENCE = dict(time_to_peak_s=0.3, coast_s=0.2, min_vs_apex_m=0.0,
                 trail_brake_share=0.3, full_throttle_s=1.0, lockup_s=0.0,
                 min_kmh=74.0, turn_in_m=420.0, last_downshift_m=400.0, line_offset_m=0.0)


def packet_for(name, corner, ref):
    corner.telemetry_verified = dict(steering=True, slip=True, coordinates=True)
    reference = replace(ref, **REFERENCE)
    spec = DRILLS[name]
    delta = corner.tolerance[spec.metric] * (3 if spec.direction != 'low' else -3)
    attempt = replace(reference, attempt_id='new', **{spec.metric: REFERENCE[spec.metric] + delta})
    return build_packet(attempt, reference, attempt, corner, None, None), attempt, reference


def as_call(d):
    return ToolCall('offer_drill', dict(attempt_id=d.attempt_id, drill_id=d.drill_id,
                                      target=d.target, cue=d.cue, reminder=d.reminder, verdict=d.verdict))


@pytest.mark.parametrize('name', NEW)
def test_drill_rules_and_validator(name, corner, ref):
    p, a, r = packet_for(name, corner, ref)
    assert eligible(p, name)
    d = rule_decide(p)
    assert d.action == 'offer_drill' and d.drill_id == name
    assert d.target == {DRILL_TARGET[name]: p['suggested'][name]}
    assert validate(as_call(d), p) == (True, None)
    assert rule_plan(p)[0]['drill_id'] == name
    # Agent goal validation must use exactly the same evidence contract.
    turn = AgentSession(corner, r).turn(p, 'plan')
    goal = dict(drill_id=name, target=dict(d.target), cue=d.cue)
    assert turn.validate(ToolCall('set_plan', dict(attempt_id=a.attempt_id, goals=[goal])), p)[0]
    assert DRILLS[name].unit in Goal(name, d.target, d.cue).done_when(corner.tolerance)


@pytest.mark.parametrize('name', NEW)
def test_drill_validator_rejects_missing_and_bad_target(name, corner, ref):
    p, a, r = packet_for(name, corner, ref)
    d = rule_decide(p)
    call = as_call(d)
    call.arguments['target'] = {DRILL_TARGET[name]: float('nan')}
    assert not validate(call, p)[0]
    call = as_call(d)
    call.arguments['target'] = {DRILL_TARGET[name]: 1e9}
    assert not validate(call, p)[0]
    missing = replace(a, **{DRILL_METRIC[name]: None})
    p = build_packet(missing, r, missing, corner, None, None)
    assert rule_decide(p).action == 'end_drill'
    assert not validate(as_call(d), p)[0]


@pytest.mark.parametrize('name', NEW)
def test_retry_completion_missing_and_progress(name, corner, ref):
    p, a, r = packet_for(name, corner, ref)
    offer = rule_decide(p)
    ds = DrillState(name, offer.target, tries=1)
    retry = build_packet(a, r, a, corner, ds, a)
    repeat = rule_decide(retry)
    assert repeat.verdict == 'repeat'
    assert validate(as_call(repeat), retry)[0]
    hit = replace(a, **{DRILL_METRIC[name]: getattr(r, DRILL_METRIC[name])})
    retry = build_packet(hit, r, a, corner, ds, a)
    assert rule_decide(retry).end_reason == 'drill_complete'
    missing = replace(a, **{DRILL_METRIC[name]: None})
    retry = build_packet(missing, r, a, corner, ds, a)
    assert retry['target_gap'] == {}
    assert rule_decide(retry).end_reason == 'invalid_run'
    assert not validate(as_call(offer), retry)[0]
    ds.tries = 3
    retry = build_packet(a, r, a, corner, ds, a)
    assert rule_decide(retry).end_reason == 'no_progress'


@pytest.mark.parametrize('name', NEW)
def test_live_marker_crossing(name, corner, ref):
    p, _, _ = packet_for(name, corner, ref)
    offer = rule_decide(p)
    player = NullPlayer()
    cue = LiveCue(corner, player, lead_s=0)
    cue.arm(name, offer.target)
    mark = DRILLS[name].cue_position(offer.target, corner)
    cue.on_sample(0, mark - 1, 100)
    cue.on_sample(0.1, mark + 1, 100)
    cue.on_sample(0.15, mark + 2, 100)
    assert player.calls == ['mark']


@pytest.mark.parametrize('name', ['trail_brake', 'throttle_roll_on', 'lockup', 'racing_line'])
def test_calibration_required(name, corner, ref):
    p, _, _ = packet_for(name, corner, ref)
    offer = rule_decide(p)
    p['telemetry_verified'] = {}
    assert not eligible(p, name)
    assert rule_decide(p).action == 'end_drill'
    assert not validate(as_call(offer), p)[0]
    corner.telemetry_verified = {}
    cue = LiveCue(corner, NullPlayer())
    cue.arm(name, offer.target)
    assert not cue.armed


def test_min_speed_waits_for_apex_position(corner, ref):
    p, a, r = packet_for('min_speed', corner, ref)
    p['delta']['min_vs_apex_m'] = 20
    p['suggested']['apex_position'] = 0
    assert not eligible(p, 'min_speed')
    assert rule_decide(p).drill_id == 'apex_position'


def test_generated_contracts():
    schema = next(t['function']['parameters']['properties'] for t in TOOLS if t['function']['name'] == 'offer_drill')
    assert schema['drill_id']['enum'] == list(DRILLS)
    assert schema['target']['properties'] == TARGET_PROPERTIES == _GOAL['properties']['target']['properties']
    for name in DRILLS:
        assert name in SYSTEM_PROMPT and name in AGENT_PROMPT


@pytest.mark.parametrize('name,gap', [('no_coast', -1), ('lockup', -0.5), ('min_speed', 5), ('racing_line', -1)])
def test_one_sided_improvement(name, gap):
    assert target_hit(name, gap, 0.1)


def test_profile_turn_in_and_downshift_neutral_blips(corner):
    from engine.analysis import driving_profile
    # [pos, brake, gas, speed, time, steer, yaw, slip_f, slip_r, gear, x, z]
    trace = [[300 + i * 10, 0.8 if i < 6 else 0, 1 if i > 6 else 0,
              100 - i, i * 0.1, 0.06 if i >= 4 else 0.05, 0, 0, 0, gear,
              300 + i * 10, 0] for i, gear in enumerate([5, 5, 0, 4, 4, 0, 3, 3, 4, 4])]
    p = driving_profile(trace, corner)
    assert p['turn_in_m'] == 340  # strict > 0.05, after onset
    assert p['last_downshift_m'] == 360
    old = driving_profile([r[:9] for r in trace], corner)
    assert old['last_downshift_m'] is None and old['line_offset_m'] is None
    bare = driving_profile([r[:4] for r in trace], corner)
    assert bare['turn_in_m'] is None


def test_line_offset_geometry_and_missing_data(corner):
    from engine.analysis import line_offset
    corner.racing_line = [[400, 400, 0], [450, 450, 0], [500, 500, 0], [550, 550, 0]]
    trace = [[p, 0, 1, 100, i, 0, 0, 0, 0, 3, p, 2]
             for i, p in enumerate(range(420, 541, 10))]
    assert line_offset(trace, corner) == 2
    assert line_offset([r[:10] for r in trace], corner) is None
    corner.racing_line = [[400, 400, 0], [450, 450, 0]]
    assert line_offset(trace, corner) is None  # partial line must not look like a complete measurement
    corner.racing_line = [[550, 550, 0], [400, 400, 0]]
    assert line_offset(trace, corner) is None


def test_scored_metrics_flow_to_attempt_packet_and_history(corner, ref):
    from coach.scorer import CornerScorer
    from coach.telemetry import SimSource
    from engine.analysis import driving_profile
    results = []
    scorer = CornerScorer(corner, lambda a, tr: results.append((a, tr)))
    sim = SimSource(corner, realtime=False)
    for _ in range(3000):
        sample = sim._sample()
        scorer.add(sample)
        sim.t += sim.dt
        sim.pos += sample.speed_kmh / 3.6 * sim.dt
        if results:
            break
    assert len(results) == 1
    a, trace = results[0]
    assert a.valid
    profile = driving_profile(trace, corner)
    reference = replace(a, attempt_id='reference')
    packet = build_packet(a, reference, a, corner, None, None)
    for key in ('time_to_peak_s', 'coast_s', 'min_vs_apex_m', 'full_throttle_s', 'turn_in_m', 'last_downshift_m'):
        assert getattr(a, key) is not None
        assert packet['attempt'][key] == profile[key]
        assert packet['delta'][key] == 0
    assert all(len(r) == 12 for r in trace)
    assert all(isinstance(r[9], int) for r in trace)


@pytest.mark.parametrize('name', NEW)
def test_spoken_rules_cues_validate(name, corner, ref):
    p, _, _ = packet_for(name, corner, ref)
    p['voice'] = {'max_cue_words': 12, 'max_reminder_words': 4}
    d = rule_decide(p)
    assert validate(as_call(d), p)[0]


@pytest.mark.parametrize('name', NEW)
def test_completion_validator_requires_measured_target(name, corner, ref):
    p, a, r = packet_for(name, corner, ref)
    offer = rule_decide(p)
    state = DrillState(name, offer.target)
    call = ToolCall('end_drill', {'attempt_id': a.attempt_id, 'reason': 'drill_complete', 'summary': 'Target hit.'})
    assert not validate(call, p)[0]
    retry = build_packet(a, r, a, corner, state, a)
    assert not validate(call, retry)[0]
    hit = replace(a, **{DRILL_METRIC[name]: getattr(r, DRILL_METRIC[name])})
    retry = build_packet(hit, r, a, corner, state, a)
    assert validate(call, retry)[0]


def test_ac_gear_and_coordinates_parse():
    from coach.telemetry import SPageFilePhysics, SPageFileGraphic, parse_sample
    phys = SPageFilePhysics(packetId=1, gear=4)
    gfx = SPageFileGraphic(status=2)
    gfx.carCoordinates[0], gfx.carCoordinates[2] = 10, 20
    sample = parse_sample(phys, gfx, 1000, t=0)
    assert sample.gear == 3 and (sample.x, sample.z) == (10, 20)


async def test_old_recording_has_unknown_gear(tmp_path):
    import json
    from dataclasses import asdict
    from coach.telemetry import Sample, ReplaySource
    s = Sample(0, 1, 'live', 0.1, 100, 100, 0, 0, 0, 10, 0, 20)
    doc = asdict(s)
    doc.pop('gear')
    path = tmp_path / 'old.jsonl'
    path.write_text(json.dumps(doc)+'\n')
    rows = [s async for s in ReplaySource(path).samples()]
    assert len(rows) == 1 and rows[0].gear is None


def test_extracted_reference_loads_with_profile(tmp_path, corner, ref):
    import json
    from engine.config import load_attempt
    from coach.__main__ import build_app, build_parser
    path = tmp_path / 'ai.json'
    path.write_text(json.dumps({'attempt': vars(replace(ref, coast_s=0.2)), 'trace': [[240, 0, 1, 100]]}))
    assert load_attempt(path).coast_s == 0.2
    args = build_parser().parse_args(['--reference',str(path),'--voice','off','--no-sound'])
    app = build_app(args)
    assert app.reference.coast_s == 0.2 and app.reference_trace == [[240, 0, 1, 100]]
