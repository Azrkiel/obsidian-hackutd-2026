from dataclasses import replace
import json

import pytest
from aiohttp.test_utils import TestClient, TestServer

from coach.app import CoachApp
from coach.dashboard import make_web_app
from coach.telemetry import SimSource
from engine.agent_tools import AGENT_PROMPT, AgentSession
from engine.memory import MemoryStore, SessionMemory, corner_hash
from engine.models import Decision, DrillState
from test_agent import provider, scored


def test_driver_isolation_anonymous_and_reopen(corner, ref, tmp_path):
    store = MemoryStore(tmp_path / 'memory.sqlite3')
    anonymous = SessionMemory(store, corner)
    anonymous.record(ref, ref)
    assert anonymous.history() == {'error': 'no driver'}
    anonymous.finish()
    kev = SessionMemory(store, corner, 'kev')
    kev.record(ref, ref)
    assert kev.history()['sessions'] == []  # exclude the ongoing session
    kev.finish()
    reopened = MemoryStore(store.path)
    assert reopened.history('kev', corner)['sessions'][0]['laps'] == 1
    assert reopened.history('someone else', corner)['sessions'] == []
    assert AgentSession(corner, ref).run_tool('get_driver_history', {}, 'ref', {}) == {'error': 'no driver'}
    reopened.delete_driver('kev')
    with reopened.connect() as db:
        assert db.execute('SELECT COUNT(*) FROM session').fetchone()[0] == 1
        assert db.execute('SELECT COUNT(*) FROM lap').fetchone()[0] == 1  # anonymous is preserved


@pytest.mark.parametrize('change', [
    {'start_gate_m': 241}, {'exit_gate_m': 541}, {'apex_window_m': (449, 468)},
    {'board_zero_m': 441}, {'gates': {'turn_in_m': 430}}, {'tolerance': {'release_s': .2}},
])
def test_changed_corner_returns_outcomes_without_metrics(corner, ref, tmp_path, change):
    memory = SessionMemory(MemoryStore(tmp_path / 'm.db'), corner, 'kev')
    memory.record(ref, ref)
    memory.goals = [{'drill_id': 'brake_point', 'outcome': 'met', 'tries': 2}]
    memory.note(Decision('d', 'ref', 'end_drill', end_reason='drill_complete'),
                DrillState('brake_point', {'marker_m': 100}, tries=2))
    memory.finish()
    changed = replace(corner, **change)
    assert corner_hash(changed) != corner_hash(corner)
    result = memory.store.history('kev', changed)
    assert result['corner_changed'] is True and result['tendencies'] == []
    assert 'best_section_s' not in result['sessions'][0]
    assert result['sessions'][0]['goals'][0]['outcome'] == 'met'
    assert memory.store.history('kev', replace(corner, name='Other corner'))['sessions'] == []


def test_tendencies_last_three_sessions_exclude_bad_laps(corner, ref, tmp_path):
    memory = SessionMemory(MemoryStore(tmp_path / 'm.db'), corner, 'kev')
    ref = replace(ref, release_s=.5)
    for i, gap in enumerate((100, -10, -20, 3)):
        a = replace(ref, attempt_id=f'good{i}', brake_onset_m=ref.brake_onset_m + gap, release_s=.29)
        memory.record(a, ref)
        memory.record(replace(a, attempt_id=f'invalid{i}', valid=False, release_s=20), ref)
        memory.record(replace(a, attempt_id=f'notcomparable{i}', entry_kmh=ref.entry_kmh + 20,
                              release_s=20), ref)
        memory.finish()
    history = memory.history()
    assert len(history['sessions']) == 3
    assert all(s['laps'] == 3 for s in history['sessions'])
    tendencies = {t['metric']: t for t in history['tendencies']}
    assert tendencies['release_s'] == dict(metric='release_s', mean_delta=-.21, sessions_over_tol=3, of=3)
    assert tendencies['brake_onset_m']['mean_delta'] == -9
    assert tendencies['brake_onset_m']['sessions_over_tol'] == 2
    # A future metric only needs to be present in the profiles and tolerances.
    assert 'section_s' in tendencies


def test_summary_rules_fallback_and_model_validation(corner, ref, tmp_path):
    memory = SessionMemory(MemoryStore(tmp_path / 'm.db'), corner, 'kev')
    memory.record(ref, ref)
    memory.note(Decision('d', 'ref', 'offer_drill', drill_id='brake_point'))
    memory.note(Decision('d2', 'ref', 'end_drill', end_reason='drill_complete'),
                DrillState('brake_point', {'marker_m': 100}, tries=2))
    memory.finish('You gained 999 seconds.', {'delta': 2})
    assert memory.history()['sessions'][0]['summary'] == 'brake point met in 2 tries'
    memory.record(ref, ref)
    memory.finish('You gained 2 seconds.', {'delta': 2})
    assert memory.history()['sessions'][0]['summary'] == 'You gained 2 seconds.'
    memory.record(ref, ref)
    memory.finish('words ' * 21, {})
    assert memory.history()['sessions'][0]['summary'] == 'No coaching goals completed.'


async def test_second_sim_session_reads_history_cites_number_and_skips_met_goal(corner, tmp_path):
    reference, rt = await scored(corner, board=100, release=.55)
    reference.attempt_id = 'reference'
    def app(providers=()):
        return CoachApp(corner, reference, SimSource(corner), list(providers),
                        reference_trace=rt, reset_mode='sim', data_dir=tmp_path / 'data',
                        trace_dir=tmp_path / 'traces', persist_checkpoint=False,
                        mode='lap', agent=True, driver='kev')
    first = app()
    try:
        for i, (board, release) in enumerate(((86, .15), (100, .15), (100, .55))):
            a, tr = await scored(corner, board=board, release=release)
            a.attempt_id = f'first-{i}'
            await first.coach.on_scored(a, tr)
        assert first.coach.state == 'DONE'
        goals = first.memory.history()['sessions'][0]['goals']
        assert [g['outcome'] for g in goals] == ['met', 'met']
        assert 'brake point met in 1 try' in first.memory.history()['sessions'][0]['summary']
    finally:
        await first.stop()
    second = app()
    try:
        a, tr = await scored(corner, board=100, release=.15)
        a.attempt_id = 'second-baseline'
        history = second.memory.history()
        number = history['sessions'][0]['best_section_s']
        cue = f'Last session {number} seconds; ease off the brake slower.'
        prov = provider([('get_driver_history', {}), ('set_plan', {
            'attempt_id': a.attempt_id, 'goals': [{'drill_id': 'brake_release',
             'target': {'release_s': .5}, 'cue': cue}]})])
        second.coach.providers = [prov]
        await second.coach.on_scored(a, tr)
        decision = second.coach.last_decision
        assert decision.mode == 'think'
        assert decision.tool_calls[0]['name'] == 'get_driver_history'
        assert str(number) in decision.cue
        assert [g.drill_id for g in second.coach.agent.plan.goals] == ['brake_release']
        messages = prov.client.requests[-1]['messages']
        tool_result = json.loads(next(m['content'] for m in messages if m['role'] == 'tool'))
        assert tool_result['result']['sessions'][0]['goals'][0]['outcome'] == 'met'
        assert 'call get_driver_history first' in AGENT_PROMPT
        retry, retry_trace = await scored(corner, board=100, release=.55)
        retry.attempt_id = 'second-retry'
        summary = f'Last session {number} seconds; keep the smooth release.'
        prov.client.steps = [('get_driver_history', {}), ('end_session', {
            'attempt_id': retry.attempt_id, 'summary': summary})]
        await second.coach.on_scored(retry, retry_trace)
        assert second.coach.state == 'DONE'
        assert second.memory.history()['sessions'][0]['summary'] == summary
    finally:
        await second.stop()


async def test_dashboard_driver_switch_starts_separate_history(corner, ref, tmp_path):
    app = CoachApp(corner, ref, SimSource(corner), [], reset_mode='sim',
                   data_dir=tmp_path, trace_dir=tmp_path / 'traces', persist_checkpoint=False, agent=True)
    client = TestClient(TestServer(make_web_app(app)))
    await client.start_server()
    try:
        ws = await client.ws_connect('/ws')
        assert (await ws.receive_json())['driver'] is None
        app.memory.record(ref, ref)
        await ws.send_json({'type': 'set_driver', 'driver': ' kev '})
        await app.wait_for(lambda: app.memory.driver == 'kev')
        assert app.memory.history()['sessions'] == []
        assert (await (await client.get('/state')).json())['driver'] == 'kev'
        await app.handle_command({'type': 'set_driver', 'driver': 42})
        assert app.memory.driver == 'kev'
        app.memory.record(ref, ref)
        await app.handle_command({'type': 'set_driver', 'driver': 'pat'})
        assert len(app.memory.store.history('kev', corner)['sessions']) == 1
        assert app.memory.history()['sessions'] == []
        await ws.close()
    finally:
        await client.close()
        await app.stop()


def test_metric_growth_and_tolerance_boundary(corner, ref, tmp_path):
    # Existing profile metrics need no additional SQLite columns.
    corner = replace(corner, tolerance={**corner.tolerance, 'coast_s': .1})
    trace = [[240, .5, 0, 100, 0], [350, 0, 0, 80, 1], [470, 0, 1, 70, 2]]
    memory = SessionMemory(MemoryStore(tmp_path / 'm.db'), corner, 'kev', trace)
    reference = replace(ref, release_s=.5)
    memory.record(replace(reference, release_s=.65), reference, trace)
    memory.finish()
    tendencies = {t['metric']: t for t in memory.history()['tendencies']}
    assert tendencies['coast_s']['mean_delta'] == 0
    assert tendencies['coast_s']['of'] == 1
    # Without a trace, exact scorer values still respect tolerance at its boundary.
    memory.reference_trace = []
    memory.record(replace(reference, release_s=.65), reference)
    memory.finish()
    latest = {t['metric']: t for t in memory.history()['tendencies']}
    assert latest['release_s']['sessions_over_tol'] == 0
