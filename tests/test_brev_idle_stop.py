import datetime as dt
import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location("brev_idle_stop", ROOT / "scripts" / "brev_idle_stop.py")
w = importlib.util.module_from_spec(_spec)
sys.modules["brev_idle_stop"] = w  # dataclasses resolve annotations through sys.modules
_spec.loader.exec_module(w)

METRICS = """# HELP vllm:num_requests_running Number of requests running.
# TYPE vllm:num_requests_running gauge
vllm:num_requests_running{engine="0",model_name="nemotron"} 0.0
vllm:num_requests_waiting{engine="0",model_name="nemotron"} 0.0
vllm:request_success_total{engine="0",finished_reason="stop",model_name="nemotron"} 3.0
vllm:request_success_total{engine="0",finished_reason="length",model_name="nemotron"} 1.0
vllm:prompt_tokens_total{engine="0",model_name="nemotron"} 1200.0
vllm:generation_tokens_total{engine="0",model_name="nemotron"} 800.0
vllm:other_metric 5
"""


def test_parse_metrics_sums_labels():
    m = w.parse_metrics(METRICS)
    assert m["vllm:request_success_total"] == 4.0
    assert m["vllm:num_requests_running"] == 0.0
    assert "vllm:other_metric" not in m


def test_idle_tracker_counts_activity():
    t = w.IdleTracker(last_active=0.0)
    base = w.parse_metrics(METRICS)
    assert t.observe(base, 60) == 60  # first snapshot: no prior counters, nothing running
    assert t.observe(base, 120) == 120  # unchanged -> still idle
    busy = dict(base, **{"vllm:num_requests_running": 1.0})
    assert t.observe(busy, 180) == 0  # running request -> active
    moved = dict(base, **{"vllm:generation_tokens_total": 900.0})
    assert t.observe(moved, 240) == 0  # counter changed -> active
    assert t.observe(moved, 300) == 60
    assert t.observe(None, 400) == 160  # unreachable: no activity, idle keeps growing
    assert not t.reachable


def test_hold_until_and_hold_file(tmp_path):
    now = dt.datetime(2026, 11, 7, 22, 0)
    assert w.parse_hold_until("23:30", now) == dt.datetime(2026, 11, 7, 23, 30)
    assert w.parse_hold_until("09:00", now) == dt.datetime(2026, 11, 8, 9, 0)  # tomorrow
    assert w.parse_hold_until("2026-11-08T11:00", now) == dt.datetime(2026, 11, 8, 11, 0)
    f = tmp_path / ".brev-hold"
    assert w.hold_reason(now, dt.datetime(2026, 11, 7, 23, 0), f).startswith("held until")
    assert w.hold_reason(now, dt.datetime(2026, 11, 7, 21, 0), f) is None
    f.touch()
    assert "hold file" in w.hold_reason(now, None, f)


def test_metrics_url():
    assert w.metrics_url("http://h:8000/v1") == "http://h:8000/metrics"
    assert w.metrics_url("http://h:8000/v1/") == "http://h:8000/metrics"
    assert w.metrics_url("https://x.brev.dev") == "https://x.brev.dev/metrics"


def test_dry_run_stops_after_idle(monkeypatch, capsys):
    snaps = iter([w.parse_metrics(METRICS)] * 10)
    monkeypatch.setattr(w, "fetch_metrics", lambda url, key: next(snaps))
    clock = iter(range(0, 10_000, 60))
    monkeypatch.setattr(w.time, "monotonic", lambda: next(clock))
    monkeypatch.setattr(w.time, "sleep", lambda s: None)
    rc = w.main(["--instance", "box", "--base-url", "http://h:8000/v1", "--idle-min", "2",
                 "--dry-run", "--hold-file", "/nonexistent/.brev-hold"])
    assert rc == 0
    out = capsys.readouterr().out
    assert "would run: brev stop box" in out
