"""Optional NVIDIA text-to-speech (Magpie TTS Multilingual on build.nvidia.com) speaker.

HTTP endpoint and form fields from https://build.nvidia.com/nvidia/magpie-tts-multilingual/api
(checked 2026-11-08; latency and free-tier limits not measured). Needs NVIDIA_API_KEY.
Any failure raises, and voice.FallbackSpeaker then uses the Windows voice for that message.
"""
from __future__ import annotations

import io
import os
import sys
import wave

FUNCTION_ID = os.environ.get("NVIDIA_TTS_FUNCTION_ID", "877104f7-e885-42b9-8de8-f6e4c6303969")
URL = os.environ.get("NVIDIA_TTS_URL",
                     f"https://{FUNCTION_ID}.invocation.api.nvcf.nvidia.com/v1/audio/synthesize")
VOICE = os.environ.get("NVIDIA_TTS_VOICE", "Magpie-Multilingual.EN-US.Aria")
RATE = 22050


def to_wav(body: bytes, rate: int = RATE) -> bytes:
    """The service may return a WAV or raw 16-bit mono PCM: always hand back a WAV."""
    if body[:4] == b"RIFF":
        return body
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(body)
    return buf.getvalue()


class NvidiaSpeaker:
    name = "nvidia"

    def __init__(self, api_key: str | None = None, timeout_s: float = 4.0, client=None, play=None):
        self.api_key = api_key or os.environ.get("NVIDIA_API_KEY")
        if not self.api_key:
            raise RuntimeError("NVIDIA_API_KEY not set")
        import httpx
        self.client = client or httpx.Client(timeout=timeout_s)
        self._play = play or _winsound_play

    def synthesize(self, text: str) -> bytes:
        r = self.client.post(URL, headers={"Authorization": f"Bearer {self.api_key}"},
                             data={"text": text, "language": "en-US", "voice": VOICE,
                                   "encoding": "LINEAR_PCM", "sample_rate_hz": str(RATE)})
        r.raise_for_status()
        if not r.content:
            raise RuntimeError("empty audio")
        return to_wav(r.content)

    def speak(self, text: str) -> None:
        self._play(self.synthesize(text))


def _winsound_play(wav: bytes) -> None:
    if sys.platform != "win32":
        raise RuntimeError("playback is Windows-only")
    import winsound
    winsound.PlaySound(wav, winsound.SND_MEMORY)  # blocking: the announcer runs this on a thread
