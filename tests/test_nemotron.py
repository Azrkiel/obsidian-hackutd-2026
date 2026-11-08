import json
from types import SimpleNamespace as NS

import pytest

from engine.models import ToolCall
from engine.nemotron import (NemotronProvider, ProviderError, consume_stream, map_exception,
                             nvidia_config, openrouter_config, parse_json_content, parse_response)
from engine.tools import TOOLS


def chunk(**delta):
    d = NS(**{"content": None, "tool_calls": None, **delta})
    return NS(choices=[NS(delta=d)])


def tc(index, name=None, args=None, id=None):
    return NS(index=index, id=id, function=NS(name=name, arguments=args))


async def agen(items):
    for i in items:
        yield i


async def test_stream_tool_call_assembly_and_reasoning_fields():
    chunks = [
        chunk(reasoning_content="Late "),
        chunk(reasoning="by 14 m. "),  # other field name
        chunk(tool_calls=[tc(0, name="offer_", id="c1")]),
        chunk(tool_calls=[tc(0, name="drill", args='{"attempt_id":"a-1",')]),
        chunk(tool_calls=[tc(0, args='"drill_id":"brake_point",')]),
        chunk(tool_calls=[tc(0, args='"target":{"marker_m":100},"cue":"Brake at 100 m."}')]),
        NS(choices=[]),  # usage chunk
    ]
    seen = []
    content, reasoning, call, first = await consume_stream(agen(chunks), seen.append, 0.0)
    assert reasoning == "Late by 14 m. " and seen == ["Late ", "by 14 m. "]
    assert first is not None
    assert call.name == "offer_drill" and call.id == "c1"
    assert call.arguments["target"] == {"marker_m": 100}


async def test_reasoning_from_model_extra():
    d = NS(content=None, tool_calls=None, model_extra={"reasoning_content": "hmm"})
    _, reasoning, call, _ = await consume_stream(agen([NS(choices=[NS(delta=d)])]), None, 0.0)
    assert reasoning == "hmm" and call is None


async def test_bad_tool_args_is_bad_response():
    chunks = [chunk(tool_calls=[tc(0, name="end_drill", args="{not json")])]
    with pytest.raises(ProviderError) as e:
        await consume_stream(agen(chunks), None, 0.0)
    assert e.value.kind == "bad_response"


def test_json_content_plain_and_fenced():
    body = '{"tool":"end_drill","arguments":{"attempt_id":"a","reason":"drill_complete","summary":"x"}}'
    assert parse_json_content(body).name == "end_drill"
    fenced = "Here you go:\n```json\n" + body + "\n```\nDone."
    c = parse_json_content(fenced)
    assert c.arguments["reason"] == "drill_complete"
    assert parse_json_content("no json here") is None
    assert parse_json_content('{"foo": 1}') is None
    assert parse_json_content(None) is None


def test_parse_response_non_stream():
    msg = NS(content="", reasoning_content="think", tool_calls=[
        NS(id="x", function=NS(name="end_drill", arguments='{"attempt_id":"a"}'))])
    seen = []
    content, reasoning, call = parse_response(NS(choices=[NS(message=msg)]), seen.append)
    assert reasoning == "think" and seen == ["think"] and call.name == "end_drill"
    msg2 = NS(content='{"tool":"end_drill","arguments":{}}', reasoning="r", tool_calls=None)
    _, r2, c2 = parse_response(NS(choices=[NS(message=msg2)]))
    assert r2 == "r" and c2 is None  # JSON fallback is applied by the provider, not here


class FakeCompletions:
    def __init__(self, script):
        self.script, self.kwargs = list(script), []

    async def create(self, **kw):
        self.kwargs.append(kw)
        r = self.script.pop(0)
        if isinstance(r, Exception):
            raise r
        return r


def fake_client(script):
    comps = FakeCompletions(script)
    return NS(chat=NS(completions=comps)), comps


async def test_provider_think_request_shape_and_json_fallback(mk_packet):
    p = mk_packet("late_brake")
    body = json.dumps({"tool": "end_drill", "arguments": {"attempt_id": p["attempt_id"]}})
    stream = agen([chunk(reasoning_content="r"), chunk(content="```json\n" + body + "\n```")])
    client, comps = fake_client([stream])
    prov = NemotronProvider(nvidia_config(), client=client)
    res = await prov.call(p, "think")
    kw = comps.kwargs[0]
    assert kw["stream"] is True and kw["tool_choice"] == "auto" and kw["tools"] == TOOLS
    assert kw["extra_body"]["chat_template_kwargs"] == {"enable_thinking": True}
    assert kw["extra_body"]["reasoning_budget"] == 512 and kw["max_tokens"] == 900
    assert res.call.name == "end_drill" and res.reasoning == "r"


async def test_provider_fast_and_json_transport(mk_packet):
    p = mk_packet("late_brake")
    msg = NS(content='{"tool":"end_drill","arguments":{"attempt_id":"a-0002"}}', tool_calls=None)
    client, comps = fake_client([NS(choices=[NS(message=msg)])])
    prov = NemotronProvider(openrouter_config(), client=client)
    res = await prov.call(p, "fast", transport="json")
    kw = comps.kwargs[0]
    assert "tools" not in kw and "tool_choice" not in kw and kw["stream"] is False
    assert kw["extra_body"] == {"reasoning": {"enabled": False}} and kw["max_tokens"] == 200
    assert "JSON" in kw["messages"][0]["content"]
    assert res.call.name == "end_drill"


async def test_provider_repair_messages(mk_packet):
    p = mk_packet("late_brake")
    msg = NS(content="", tool_calls=[NS(id="z", function=NS(name="end_drill", arguments="{}"))])
    client, comps = fake_client([NS(choices=[NS(message=msg)])])
    prov = NemotronProvider(nvidia_config(), client=client)
    await prov.call(p, "fast", repair=(ToolCall("offer_drill", {"x": 1}, "c9"), "cue too long"))
    msgs = comps.kwargs[0]["messages"]
    assert msgs[-1]["content"] == "Rejected: cue too long. Call one tool again, fixed."
    assert msgs[-2]["tool_calls"][0]["function"]["name"] == "offer_drill"


async def test_get_attempt_evidence_round(mk_packet):
    p = mk_packet("late_brake")
    first = NS(choices=[NS(message=NS(content="", tool_calls=[NS(id="g", function=NS(
        name="get_attempt_evidence", arguments='{"attempt_id":"a-0002"}'))]))])
    second = NS(choices=[NS(message=NS(content="", tool_calls=[NS(id="h", function=NS(
        name="end_drill", arguments='{"attempt_id":"a-0002"}'))]))])
    client, comps = fake_client([first, second])
    prov = NemotronProvider(nvidia_config(), client=client)
    res = await prov.call(p, "fast")
    assert res.call.name == "end_drill" and len(comps.kwargs) == 2
    assert comps.kwargs[1]["messages"][-1]["role"] == "tool"


async def test_errors_mapped():
    import httpx2 as httpx
    import openai
    req = httpx.Request("POST", "http://x")

    def status(code, cls):
        return cls("m", response=httpx.Response(code, request=req), body=None)

    cases = [
        (openai.APITimeoutError(request=req), "timeout"),
        (openai.APIConnectionError(request=req), "connection"),
        (status(429, openai.RateLimitError), "rate_limited"),
        (status(401, openai.AuthenticationError), "auth"),
        (status(503, openai.InternalServerError), "server"),
        (status(400, openai.BadRequestError), "bad_response"),
        (ValueError("x"), "bad_response"),
    ]
    for exc, kind in cases:
        assert map_exception(exc).kind == kind
    client, _ = fake_client([status(429, openai.RateLimitError)])
    prov = NemotronProvider(nvidia_config(), client=client)
    with pytest.raises(ProviderError) as e:
        await prov.call({"attempt_id": "a"}, "fast")
    assert e.value.kind == "rate_limited"


def test_brev_provider(monkeypatch):
    from engine.nemotron import brev_config, default_providers
    monkeypatch.delenv("NEMOTRON_BASE_URL", raising=False)
    monkeypatch.delenv("NEMOTRON_API_KEY", raising=False)
    assert not NemotronProvider(brev_config()).available
    monkeypatch.setenv("NEMOTRON_BASE_URL", "http://brev-host:8000/v1")
    prov = NemotronProvider(brev_config())
    assert prov.available  # no key needed
    assert prov.cfg.base_url == "http://brev-host:8000/v1"
    assert "reasoning_budget" not in prov.cfg.think_extra
    assert prov.cfg.think_extra["chat_template_kwargs"]["enable_thinking"] is True
    assert str(prov.client.base_url).startswith("http://brev-host:8000/v1")
    assert [p.name for p in default_providers()] == ["brev", "nvidia", "openrouter"]


@pytest.mark.asyncio
async def test_brev_think_request_shape(monkeypatch):
    from engine.nemotron import brev_config
    monkeypatch.setenv("NEMOTRON_BASE_URL", "http://brev-host:8000/v1")
    sent = {}

    class Completions:
        async def create(self, **kw):
            sent.update(kw)
            raise RuntimeError("stop")

    client = NS(chat=NS(completions=Completions()))
    prov = NemotronProvider(brev_config(), client=client)
    with pytest.raises(Exception):
        await prov.call({"attempt_id": "a-1"}, "think", think_tokens=256)
    assert sent["model"] == "nemotron" and sent["stream"] is True
    assert sent["extra_body"] == {"chat_template_kwargs": {"enable_thinking": True}}


def test_available_requires_key(monkeypatch):
    monkeypatch.delenv("NVIDIA_API_KEY", raising=False)
    assert not NemotronProvider(nvidia_config()).available
    assert NemotronProvider(nvidia_config(), api_key="k").available
