"""Nemotron provider clients: think/fast modes, streaming, tool-call parsing."""
from __future__ import annotations

import json
import os
import re
import time
from dataclasses import dataclass
from typing import Any, Callable

from .models import ModelResult, ToolCall
from .tools import TOOLS

# ---- constants (one place; env-overridable) ----------------------------------------------
NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
NVIDIA_MODEL = os.environ.get("NEMOTRON_MODEL", "nvidia/nemotron-3.5-lightning-30b-a3b")
OPENROUTER_MODEL = os.environ.get("NEMOTRON_OPENROUTER_MODEL", "nvidia/nemotron-3.5-lightning:free")
# Self-hosted vLLM on Brev (OpenAI-compatible). Enabled when NEMOTRON_BASE_URL is set.
BREV_MODEL = os.environ.get("NEMOTRON_BREV_MODEL", "nemotron")  # vLLM --served-model-name
REASONING_BUDGET = int(os.environ.get("NEMOTRON_REASONING_BUDGET", "512"))
MAX_TOKENS_THINK = int(os.environ.get("NEMOTRON_MAX_TOKENS_THINK", "900"))
MAX_TOKENS_FAST = int(os.environ.get("NEMOTRON_MAX_TOKENS_FAST", "200"))
DEFAULT_TRANSPORT = os.environ.get("NEMOTRON_TRANSPORT", "tools")  # "tools" | "json"

SYSTEM_PROMPT = """You are a racing coach for one corner of a track in a simulator. Rules, in order:
1. You coach one corner. Pick at most one change, or decline.
2. Use only fields in the evidence packet; quote the number you act on.
3. Decline (end_drill) when comparable is false, when valid is false on a baseline, or when every delta is inside tolerance.
4. After a retry: finish (end_drill drill_complete) if the target gap is inside tolerance; end_drill no_progress if two tries made no progress; offer_drill verdict repeat if it improved but missed; verdict adjust if the target is wrong for this driver.
5. Reason in under 120 words. Cue under 20 words, phrased as an action at a visible marker.
6. Answer with exactly one tool call.
7. Drills: brake_point (target marker_m = brake board), brake_release (target release_s = seconds from peak brake to off; a fast downforce car needs a progressive release or the fronts lock), throttle_pickup (target marker_m = metres past the apex). Offer a drill only for a delta over tolerance; take targets from suggested.
8. If the packet has "voice", the driver hears you at speed: cue (and end_drill summary) is one short spoken sentence, second person, one action tied to a board or kerb, at most voice.max_cue_words words, e.g. "Next time, brake a little earlier, at the 100 m board." After a retry, say how it went first: "Better, 4 m earlier. Keep that." With offer_drill also give reminder: at most voice.max_reminder_words words for the approach next lap, e.g. "Brake earlier.".
9. invalid_reason pedal_dropout or steering_dropout means the phone or the pedals cut out during the run, not a driver mistake: say the lap did not count because the input dropped. inputs, when present, says which device drove the pedals."""

JSON_TRANSPORT_SUFFIX = (
    '\nTools are not available. Answer with only one JSON object: '
    '{"tool": "<offer_drill|end_drill>", "arguments": {...}} using the same argument names.')


class ProviderError(Exception):
    """kind: timeout | rate_limited | server | connection | auth | bad_response"""

    def __init__(self, kind: str, message: str = ""):
        super().__init__(f"{kind}: {message}" if message else kind)
        self.kind = kind


# ---- parsing helpers ---------------------------------------------------------------------
def _field(obj: Any, name: str) -> Any:
    """getattr, falling back to pydantic model_extra (undeclared fields)."""
    v = getattr(obj, name, None)
    if v is None:
        extra = getattr(obj, "model_extra", None)
        if isinstance(extra, dict):
            v = extra.get(name)
    return v


def reasoning_of(delta: Any) -> str:
    for n in ("reasoning_content", "reasoning"):
        v = _field(delta, n)
        if isinstance(v, str) and v:
            return v
    return ""


_FENCE = re.compile(r"```(?:json)?\s*(.*?)```", re.S)


def parse_json_content(text: str | None) -> ToolCall | None:
    """Parse {"tool":..., "arguments":{...}} from content, possibly fenced or surrounded by prose."""
    if not text:
        return None
    cands = [m for m in _FENCE.findall(text)] + [text]
    for c in cands:
        c = c.strip()
        start, end = c.find("{"), c.rfind("}")
        if start < 0 or end <= start:
            continue
        try:
            obj = json.loads(c[start:end + 1])
        except ValueError:
            continue
        if isinstance(obj, dict) and isinstance(obj.get("tool"), str):
            args = obj.get("arguments", {})
            if isinstance(args, str):
                try:
                    args = json.loads(args)
                except ValueError:
                    continue
            if isinstance(args, dict):
                return ToolCall(obj["tool"], args)
    return None


def _make_call(name: str, args_text: str, cid: str | None) -> ToolCall:
    try:
        args = json.loads(args_text) if args_text else {}
    except ValueError as e:
        raise ProviderError("bad_response", f"tool arguments not JSON: {e}")
    if not isinstance(args, dict):
        raise ProviderError("bad_response", "tool arguments not an object")
    return ToolCall(name, args, cid)


async def consume_stream(stream: Any, on_reasoning: Callable[[str], None] | None,
                         t0: float) -> tuple[str, str, ToolCall | None, float | None]:
    """Fold a chunk stream into (content, reasoning, tool_call, first_reasoning_ms)."""
    content, reasoning = [], []
    calls: dict[int, dict] = {}
    first_ms: float | None = None
    async for chunk in stream:
        choices = getattr(chunk, "choices", None) or []
        if not choices:
            continue
        delta = getattr(choices[0], "delta", None)
        if delta is None:
            continue
        r = reasoning_of(delta)
        if r:
            if first_ms is None:
                first_ms = (time.monotonic() - t0) * 1000
            reasoning.append(r)
            if on_reasoning:
                on_reasoning(r)
        c = getattr(delta, "content", None)
        if c:
            content.append(c)
        for tc in getattr(delta, "tool_calls", None) or []:
            slot = calls.setdefault(getattr(tc, "index", 0) or 0, {"id": None, "name": "", "args": ""})
            if getattr(tc, "id", None):
                slot["id"] = tc.id
            fn = getattr(tc, "function", None)
            if fn is not None:
                if getattr(fn, "name", None):
                    slot["name"] += fn.name
                if getattr(fn, "arguments", None):
                    slot["args"] += fn.arguments
    call = None
    if calls:
        s = calls[min(calls)]
        call = _make_call(s["name"], s["args"], s["id"])
    return "".join(content), "".join(reasoning), call, first_ms


def parse_response(resp: Any, on_reasoning: Callable[[str], None] | None = None
                   ) -> tuple[str, str, ToolCall | None]:
    """Handle a non-streamed chat completion."""
    choices = getattr(resp, "choices", None) or []
    if not choices:
        raise ProviderError("bad_response", "no choices")
    msg = choices[0].message
    reasoning = reasoning_of(msg)
    if reasoning and on_reasoning:
        on_reasoning(reasoning)
    call = None
    tcs = getattr(msg, "tool_calls", None) or []
    if tcs:
        fn = tcs[0].function
        call = _make_call(fn.name, fn.arguments or "", getattr(tcs[0], "id", None))
    return getattr(msg, "content", None) or "", reasoning, call


def map_exception(e: Exception) -> ProviderError:
    """Translate openai SDK exceptions into ProviderError kinds."""
    import openai
    if isinstance(e, ProviderError):
        return e
    if isinstance(e, openai.APITimeoutError):
        return ProviderError("timeout", str(e))
    if isinstance(e, openai.APIConnectionError):
        return ProviderError("connection", str(e))
    if isinstance(e, openai.RateLimitError):
        return ProviderError("rate_limited", str(e))
    if isinstance(e, (openai.AuthenticationError, openai.PermissionDeniedError)):
        return ProviderError("auth", str(e))
    if isinstance(e, openai.APIStatusError):
        if e.status_code == 429:
            return ProviderError("rate_limited", str(e))
        if e.status_code >= 500:
            return ProviderError("server", str(e))
        return ProviderError("bad_response", f"{e.status_code}: {e}")
    return ProviderError("bad_response", repr(e))


# ---- provider ----------------------------------------------------------------------------
@dataclass
class ProviderConfig:
    name: str
    base_url: str
    key_env: str
    model: str
    think_extra: dict
    fast_extra: dict
    key_required: bool = True  # False: a base_url alone makes the provider available


def nvidia_config() -> ProviderConfig:
    return ProviderConfig(
        "nvidia", NVIDIA_BASE_URL, "NVIDIA_API_KEY", NVIDIA_MODEL,
        {"chat_template_kwargs": {"enable_thinking": True}, "reasoning_budget": REASONING_BUDGET},
        {"chat_template_kwargs": {"enable_thinking": False}})


def brev_config() -> ProviderConfig:
    """Self-hosted vLLM (Brev). No reasoning budget: vLLM has no hosted-style `reasoning_budget`;
    length is bounded by the prompt, max_tokens and the ladder deadline."""
    return ProviderConfig(
        "brev", os.environ.get("NEMOTRON_BASE_URL", ""), "NEMOTRON_API_KEY", BREV_MODEL,
        {"chat_template_kwargs": {"enable_thinking": True}},
        {"chat_template_kwargs": {"enable_thinking": False}}, key_required=False)


def openrouter_config() -> ProviderConfig:
    return ProviderConfig(
        "openrouter", OPENROUTER_BASE_URL, "OPENROUTER_API_KEY", OPENROUTER_MODEL,
        {"reasoning": {"max_tokens": REASONING_BUDGET}}, {"reasoning": {"enabled": False}})


class NemotronProvider:
    """One hosted endpoint. `client` is injectable (anything with chat.completions.create)."""

    def __init__(self, cfg: ProviderConfig, client: Any = None, transport: str | None = None,
                 api_key: str | None = None):
        self.cfg = cfg
        self.name = cfg.name
        self.model = cfg.model
        self.transport = transport or DEFAULT_TRANSPORT
        self.api_key = api_key if api_key is not None else os.environ.get(cfg.key_env)
        self._client = client

    @property
    def available(self) -> bool:
        if self._client is not None:
            return True
        if not self.cfg.key_required:
            return bool(self.cfg.base_url)
        return bool(self.api_key)

    @property
    def client(self) -> Any:
        if self._client is None:
            from openai import AsyncOpenAI
            # vLLM started without --api-key still needs a non-empty key in the SDK
            self._client = AsyncOpenAI(base_url=self.cfg.base_url, api_key=self.api_key or "EMPTY",
                                       max_retries=0, timeout=30.0)
        return self._client

    def _messages(self, packet: dict, transport: str,
                  repair: tuple[ToolCall, str] | None) -> list[dict]:
        system = SYSTEM_PROMPT + (JSON_TRANSPORT_SUFFIX if transport == "json" else "")
        msgs: list[dict] = [{"role": "system", "content": system},
                            {"role": "user", "content": json.dumps(packet, separators=(",", ":"))}]
        if repair:
            call, reason = repair
            fix = f"Rejected: {reason}. Call one tool again, fixed."
            if transport == "json":
                msgs.append({"role": "assistant",
                             "content": json.dumps({"tool": call.name, "arguments": call.arguments})})
                msgs.append({"role": "user", "content": fix})
            else:
                cid = call.id or "call_0"
                msgs.append({"role": "assistant", "content": None, "tool_calls": [{
                    "id": cid, "type": "function",
                    "function": {"name": call.name, "arguments": json.dumps(call.arguments)}}]})
                msgs.append({"role": "tool", "tool_call_id": cid, "content": fix})
        return msgs

    async def _once(self, msgs: list[dict], mode: str, transport: str, think_tokens: int | None,
                    max_tokens: int | None, on_reasoning: Callable[[str], None] | None,
                    tools: list[dict] | None = None
                    ) -> tuple[str, str, ToolCall | None, float | None]:
        think = mode == "think"
        extra = dict(self.cfg.think_extra if think else self.cfg.fast_extra)
        if think and think_tokens is not None:
            if "reasoning_budget" in extra:
                extra["reasoning_budget"] = think_tokens
            elif "reasoning" in extra:
                extra["reasoning"] = {"max_tokens": think_tokens}
        kwargs: dict[str, Any] = dict(
            model=self.model, messages=msgs,
            max_tokens=max_tokens or (MAX_TOKENS_THINK if think else MAX_TOKENS_FAST),
            extra_body=extra, stream=think)
        if transport == "tools":
            kwargs.update(tools=tools or TOOLS, tool_choice="auto")
        t0 = time.monotonic()
        try:
            resp = await self.client.chat.completions.create(**kwargs)
            if think:
                content, reasoning, call, first = await consume_stream(resp, on_reasoning, t0)
            else:
                content, reasoning, call = parse_response(resp, on_reasoning)
                first = None
        except ProviderError:
            raise
        except Exception as e:  # noqa: BLE001 - map everything; cancellation is BaseException
            raise map_exception(e) from e
        if call is None:
            call = parse_json_content(content)
        return content, reasoning, call, first

    async def call(self, packet: dict, mode: str, *, on_reasoning: Callable[[str], None] | None = None,
                   repair: tuple[ToolCall, str] | None = None, transport: str | None = None,
                   think_tokens: int | None = None, max_tokens: int | None = None,
                   agent: Any = None) -> ModelResult:
        """Run one decision call (plus at most one get_attempt_evidence round).
        With `agent` (an AgentTurn): up to agent.max_rounds rounds of read tools, then one action."""
        transport = transport or self.transport
        if agent is not None:
            return await self._agent_call(packet, mode, agent, on_reasoning, repair, transport,
                                          think_tokens, max_tokens)
        msgs = self._messages(packet, transport, repair)
        t0 = time.monotonic()
        content, reasoning, call, first = await self._once(
            msgs, mode, transport, think_tokens, max_tokens, on_reasoning)
        if call is not None and call.name == "get_attempt_evidence" and transport == "tools":
            msgs.append({"role": "assistant", "content": None, "tool_calls": [{
                "id": call.id or "call_0", "type": "function",
                "function": {"name": call.name, "arguments": json.dumps(call.arguments)}}]})
            msgs.append({"role": "tool", "tool_call_id": call.id or "call_0",
                         "content": json.dumps(packet, separators=(",", ":"))})
            content, r2, call, first2 = await self._once(
                msgs, mode, transport, think_tokens, max_tokens, on_reasoning)
            reasoning += r2
            first = first if first is not None else first2
        return ModelResult(call=call, reasoning=reasoning, content=content,
                           latency_ms=(time.monotonic() - t0) * 1000,
                           first_reasoning_ms=first, model=self.model)

    async def _agent_call(self, packet: dict, mode: str, agent: Any,
                          on_reasoning: Callable[[str], None] | None,
                          repair: tuple[ToolCall, str] | None, transport: str,
                          think_tokens: int | None, max_tokens: int | None) -> ModelResult:
        from .agent_tools import AGENT_JSON_SUFFIX, tool_message
        system = agent.system_prompt + (AGENT_JSON_SUFFIX if transport == "json" else "")
        msgs = self._messages(packet, transport, repair)
        msgs[0] = {"role": "system", "content": system}
        t0 = time.monotonic()
        reasoning, first, content, call = "", None, "", None
        for rnd in range(1, agent.max_rounds + 2):
            last = rnd > agent.max_rounds
            content, r, call, f = await self._once(
                msgs, mode, transport, think_tokens, max_tokens, on_reasoning,
                tools=agent.action_schemas if last else agent.schemas)
            reasoning += r
            first = first if first is not None else f
            if call is None or last or not agent.is_read(call.name):
                break
            res = agent.run(call, rnd)
            body = tool_message(call, res, agent.max_rounds - rnd)
            if transport == "json":
                msgs.append({"role": "assistant",
                             "content": json.dumps({"tool": call.name, "arguments": call.arguments})})
                msgs.append({"role": "user", "content": f"Result of {call.name}: {body}"})
            else:
                cid = call.id or f"call_{rnd}"
                msgs.append({"role": "assistant", "content": None, "tool_calls": [{
                    "id": cid, "type": "function",
                    "function": {"name": call.name, "arguments": json.dumps(call.arguments)}}]})
                msgs.append({"role": "tool", "tool_call_id": cid, "content": body})
        return ModelResult(call=call, reasoning=reasoning, content=content,
                           latency_ms=(time.monotonic() - t0) * 1000, first_reasoning_ms=first,
                           model=self.model, extra={"tool_calls": list(agent.log)})

    async def warm(self) -> float:
        """One max_tokens=1 call to open the connection. Returns latency in ms."""
        t0 = time.monotonic()
        await self.client.chat.completions.create(
            model=self.model, messages=[{"role": "user", "content": "ok"}], max_tokens=1,
            extra_body=self.cfg.fast_extra)
        return (time.monotonic() - t0) * 1000


def default_providers(transport: str | None = None) -> list[NemotronProvider]:
    """brev (self-hosted) first, then nvidia, then openrouter; unavailable ones are skipped."""
    return [NemotronProvider(brev_config(), transport=transport),
            NemotronProvider(nvidia_config(), transport=transport),
            NemotronProvider(openrouter_config(), transport=transport)]
