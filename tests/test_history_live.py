"""Opt-in integration test against a fresh, disposable local SpacetimeDB database.

Publish spacetime/ first, then set HISTORY_TEST_URL and HISTORY_TEST_DB. Uses new
anonymous identities; never needs or prints a production coach token.
"""

import os

import aiohttp
import pytest

from coach.history import HistoryRecorder
from coach.history_sync import HistorySync, SyncConfig
from tests.test_history import metadata, run_event


@pytest.mark.skipif(
    not os.getenv("HISTORY_TEST_URL"), reason="requires disposable SpacetimeDB"
)
async def test_real_http_replay_sql_and_second_identity(tmp_path, ref):
    url, database = os.environ["HISTORY_TEST_URL"], os.environ["HISTORY_TEST_DB"]
    async with aiohttp.ClientSession() as http:
        async with http.post(url + "/v1/identity") as response:
            owner = await response.json()
        async with http.post(url + "/v1/identity") as response:
            viewer = await response.json()
        history = HistoryRecorder(tmp_path / "h.db")
        history.start(metadata())
        history.submit(run_event(ref))
        history.flush()
        sync = HistorySync(history, SyncConfig(url, database, owner["token"]))
        try:
            assert await sync.sync_once(), sync.error
            assert sync.pending_count() == 0
            async with http.post(
                f"{url}/v1/database/{database}/sql",
                data="SELECT lap.* FROM lap JOIN session ON lap.session_id = session.session_id WHERE session.track = 'monza'",
            ) as response:
                assert response.status == 200, await response.text()
                result = await response.json()
                assert len(result[0]["rows"]) == 1
                columns = [c["name"]["some"] for c in result[0]["schema"]["elements"]]
                row = dict(zip(columns, result[0]["rows"][0]))
                assert row["section_s"] == [0, 6.8]  # SATS-JSON option: tag 0 = some
                assert row["valid"] is True
            async with http.post(
                f"{url}/v1/database/{database}/call/record_lap",
                json=["{}"],
                headers={"Authorization": "Bearer " + viewer["token"]},
            ) as response:
                assert response.status >= 400
                assert "coach only" in await response.text()
            history.submit({"type": "reference", "attempt": {"attempt_id": "a-0001"}})
            history.flush()
            assert await sync.sync_once()
        finally:
            history.close()
            await sync.close()
