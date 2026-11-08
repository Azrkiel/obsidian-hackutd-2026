import json

from aiohttp import web
from aiohttp.test_utils import TestServer

from coach.history import HistoryRecorder
from engine.agent_tools import AgentSession
from engine.evidence import build_packet
from engine.ladder import CircuitBreaker, decide
from engine.nemotron import NemotronProvider, ProviderConfig
from tests.test_history import metadata, run_event


async def test_second_session_agent_reads_and_cites_persisted_number(
    tmp_path, corner, ref
):
    path = tmp_path / "h.db"
    first = HistoryRecorder(path)
    first.start(metadata())
    first.submit(run_event(ref))
    first.close()
    second = HistoryRecorder(path)
    second.start(metadata())
    s = AgentSession(corner, ref)
    s.driver_history = second.driver_history
    s.add_run(ref, [])
    packet = build_packet(ref, ref, ref, corner, None, None)
    packet["driver_history"] = second.driver_history()
    packet["turn"] = "plan"
    requests = []

    async def completion(request):
        data = await request.json()
        requests.append(data)
        if len(requests) == 1:
            assert "get_driver_history" in {
                t["function"]["name"] for t in data["tools"]
            }
            name, args = "get_driver_history", {}
        else:
            tool = json.loads(
                [m for m in data["messages"] if m["role"] == "tool"][-1]["content"]
            )
            number = tool["result"]["sessions"][0]["laps"][0]["section_s"]
            assert number == 6.8
            name, args = (
                "end_drill",
                {
                    "attempt_id": ref.attempt_id,
                    "reason": "no_coaching_needed",
                    "summary": f"Last session your section took {number} seconds.",
                },
            )
        tc = dict(
            id=f"c{len(requests)}",
            type="function",
            function=dict(name=name, arguments=json.dumps(args)),
        )
        if data.get("stream"):
            event = {
                "id": "fake",
                "choices": [
                    {
                        "index": 0,
                        "delta": {"tool_calls": [{"index": 0, **tc}]},
                        "finish_reason": None,
                    }
                ],
            }
            return web.Response(
                text=f"data: {json.dumps(event)}\n\ndata: [DONE]\n\n",
                content_type="text/event-stream",
            )
        return web.json_response(
            {
                "choices": [
                    {
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": None,
                            "tool_calls": [tc],
                        },
                        "finish_reason": "tool_calls",
                    }
                ]
            }
        )

    server_app = web.Application()
    server_app.router.add_post("/v1/chat/completions", completion)
    try:
        async with TestServer(server_app) as server:
            cfg = ProviderConfig(
                "fake",
                str(server.make_url("/v1")),
                "NONE",
                "nemotron",
                {},
                {},
                key_required=False,
            )
            p = NemotronProvider(cfg)
            turn = s.turn(packet, "plan")
            d, _ = await decide(
                packet,
                [p],
                agent=turn,
                breaker=CircuitBreaker(),
                think_deadline_s=15,  # local fake server; generous so a cold start never falls back to rules
                total_deadline_s=20,
            )
            assert d.mode == "think" and "6.8" in d.summary
            assert turn.log[0]["name"] == "get_driver_history"
            assert requests[0]["messages"][1]["content"].find("driver_history") >= 0
    finally:
        second.close()
