import asyncio

from coach.cloud_config import CloudConfig
from coach.cloud_runtime import CloudRuntime
from coach.app import CoachApp
from coach.telemetry import SimSource


class AccessClient:
    def __init__(self, role="writer", offline=False):
        self.role, self.offline = role, offline

    async def device_status(self):
        if self.offline:
            raise OSError("network unavailable")
        return {"identity": "a" * 64, "device_id": "device-a", "label": "Game PC", "role": self.role}

    async def close(self):
        pass


class CaptureSync:
    def __init__(self, *args, **kwargs):
        self.events = []
        self.session_id = "history-session-a"
        self.stopped = False

    async def start(self):
        pass

    def capture(self, event):
        self.events.append(event)

    def update_metadata(self, **kwargs):
        pass

    def status(self):
        return {"state": "syncing", "pending": len(self.events)}

    async def stop(self):
        self.stopped = True


def app_for(corner, ref, tmp_path):
    return CoachApp(corner, ref, SimSource(corner, realtime=False), [], reset_mode="sim",
                    data_dir=tmp_path, persist_checkpoint=False, sound=False, countdown=0)


async def test_known_writer_captures_while_cloud_is_offline_and_unsubscribes(corner, ref, tmp_path, monkeypatch):
    import coach.cloud_runtime as runtime_module
    monkeypatch.setattr(runtime_module, "CloudSync", CaptureSync)
    app = app_for(corner, ref, tmp_path)
    cfg = CloudConfig("http://127.0.0.1:3000", "history-test", "private-token", "a" * 64,
                      "device-a", "Game PC", role="writer")
    runtime = CloudRuntime(app, "sim", config=cfg)
    runtime.history.client = AccessClient(offline=True)
    await runtime.start()
    app.broadcast({"type": "run", "role": "baseline", "attempt": {"attempt_id": "a-1", "valid": True}})
    await asyncio.sleep(0.01)
    assert runtime.sync is not None
    assert runtime.sync.events[0]["type"] == "run"
    sync = runtime.sync
    await runtime.stop()
    app.broadcast({"type": "run", "role": "baseline", "attempt": {"attempt_id": "a-2", "valid": True}})
    assert len(sync.events) == 1 and sync.stopped


async def test_viewer_profile_never_captures_simulated_game_results(corner, ref, tmp_path, monkeypatch):
    import coach.cloud_runtime as runtime_module
    monkeypatch.setattr(runtime_module, "CloudSync", CaptureSync)
    app = app_for(corner, ref, tmp_path)
    cfg = CloudConfig("http://127.0.0.1:3000", "history-test", "private-token", "a" * 64,
                      "device-a", "Viewer", role="viewer")
    runtime = CloudRuntime(app, "sim", config=cfg)
    runtime.history.client = AccessClient(role="viewer")
    await runtime.start()
    await asyncio.sleep(0.01)
    app.broadcast({"type": "run", "role": "baseline", "attempt": {"attempt_id": "a-1", "valid": True}})
    assert runtime.sync is None
    await runtime.stop()


async def test_unknown_env_identity_is_verified_before_capture(corner, ref, tmp_path, monkeypatch):
    import coach.cloud_runtime as runtime_module
    monkeypatch.setattr(runtime_module, "CloudSync", CaptureSync)
    app = app_for(corner, ref, tmp_path)
    runtime = CloudRuntime(app, "sim", config=CloudConfig("http://127.0.0.1:3000", "history-test", "private-token"))
    runtime.history.client = AccessClient()
    await runtime.start()
    await asyncio.sleep(0.01)
    try:
        assert runtime.sync is not None
        assert runtime.config.identity == "a" * 64
        assert runtime.config.device_id == "device-a"
    finally:
        await runtime.stop()


async def test_late_async_decision_keeps_origin_session_after_rotation(corner, ref, tmp_path):
    from types import SimpleNamespace
    app = app_for(corner, ref, tmp_path)
    sync = CaptureSync()
    app.cloud_runtime = SimpleNamespace(sync=sync)
    events = []
    app.subscribe(events.append)
    began, release = asyncio.Event(), asyncio.Event()

    async def delayed_decision():
        began.set()
        await release.wait()
        app.broadcast({"type": "decision", "action": "end_drill", "mode": "rules", "summary": "Done", "attempt_id": "a-1"})

    task = app._spawn(delayed_decision())
    await began.wait()
    sync.session_id = "history-session-b"
    release.set()
    await task
    assert events[-1]["_history_session_id"] == "history-session-a"


def test_history_metadata_names_a_track_sim_track():
    """TrackSimSource.track is a Track object; /history/config must still serialize."""
    import json
    from types import SimpleNamespace
    from coach.app import CoachApp
    fake = SimpleNamespace(_driver_name=None, _driver_id=None, source=SimpleNamespace(track=SimpleNamespace(name="Monza")),
                           corner=SimpleNamespace(name="Monza T1"), mode="lap", coach=SimpleNamespace(agent=None), recorder=None)
    meta = CoachApp._history_metadata(fake)
    assert meta["track"] == "Monza"
    json.dumps(meta)
