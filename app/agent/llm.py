"""Client Mistral en streaming avec appels d'outils."""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Iterator

import httpx

MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions"
DEFAULT_MODEL = "ministral-8b-latest"
FALLBACK_MODEL = "mistral-small-latest"


def endpoint() -> str:
    """URL du service compatible OpenAI. Mistral par défaut, surchargeable en dev."""
    return os.environ.get("AGENT_LLM_URL") or MISTRAL_URL


RETRYABLE_STATUSES = {429, 500, 502, 503, 504}
RETRY_STATUSES_MAX_ATTEMPTS = 3


def _retry_delay(response: httpx.Response) -> float:
    """Attente avant nouvelle tentative : `Retry-After` sinon 4 s, plafonnée à 20 s."""
    raw = response.headers.get("retry-after", "")
    try:
        delay = float(raw)
    except ValueError:
        delay = 4.0
    return max(1.0, min(delay, 20.0))


def configured_key(url: str) -> str:
    """Clé adaptée au fournisseur visé.

    Le fournisseur change sans redéploiement (variables runtime) : on choisit la
    clé selon l'hôte de l'endpoint, sinon une clé Mistral envoyée à Google (ou
    l'inverse) rend l'agent muet en production.
    """
    explicit = os.environ.get("AGENT_LLM_KEY", "")
    host = url.lower()
    if "groq.com" in host and os.environ.get("API_GROQ"):
        return os.environ["API_GROQ"]
    if "mistral.ai" in host and os.environ.get("API_MISTRAL"):
        return os.environ["API_MISTRAL"]
    return explicit or os.environ.get("MISTRAL_API_KEY") or os.environ.get("API_MISTRAL", "")


class LLMError(RuntimeError):
    """Erreur du fournisseur de modèle."""


@dataclass
class TurnOutput:
    text: str = ""
    tool_calls: list[dict[str, Any]] = field(default_factory=list)
    prompt_tokens: int = 0
    completion_tokens: int = 0
    model: str = ""


def _parse_tool_calls(chunks: dict[int, dict[str, Any]]) -> list[dict[str, Any]]:
    calls: list[dict[str, Any]] = []
    for index in sorted(chunks):
        chunk = chunks[index]
        function = chunk.get("function") or {}
        name = function.get("name") or ""
        if not name:
            continue
        raw_args = function.get("arguments") or "{}"
        try:
            arguments = json.loads(raw_args) if raw_args.strip() else {}
        except ValueError:
            arguments = {}
        calls.append(
            {
                "id": chunk.get("id") or f"call_{index}",
                "type": "function",
                "function": {"name": name, "arguments": json.dumps(arguments, ensure_ascii=False)},
            }
        )
        # Gemini 3 renvoie une signature de raisonnement à restituer tel quel.
        extra = chunk.get("extra_content")
        if extra:
            calls[-1]["extra_content"] = extra
    return calls


class MistralClient:
    def __init__(
        self,
        api_key: str = "",
        model: str = "",
        transport: httpx.BaseTransport | None = None,
        timeout: float = 60.0,
    ) -> None:
        self.api_key = api_key or configured_key(endpoint())
        self.model = model or os.environ.get("AGENT_MODEL", DEFAULT_MODEL)
        self._client = httpx.Client(transport=transport, timeout=timeout)

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    def stream(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        model: str | None = None,
    ) -> Iterator[dict[str, Any]]:
        """Génère `{"delta": str}` au fil de l'eau puis un unique `{"done": TurnOutput}`."""
        if not self.api_key:
            raise LLMError("Clé Mistral absente")
        payload: dict[str, Any] = {
            "model": model or self.model,
            "messages": messages,
            "temperature": 0.3,
            "max_tokens": 700,
            "stream": True,
        }
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"
        headers = {"Authorization": f"Bearer {self.api_key}", "Accept": "text/event-stream"}

        output = TurnOutput(model=payload["model"])
        chunks: dict[int, dict[str, Any]] = {}
        try:
            done = False
            for attempt in range(RETRY_STATUSES_MAX_ATTEMPTS):
                with self._client.stream("POST", endpoint(), json=payload, headers=headers) as response:
                    if response.status_code in RETRYABLE_STATUSES and attempt + 1 < RETRY_STATUSES_MAX_ATTEMPTS:
                        response.read()
                        time.sleep(_retry_delay(response))
                        continue
                    if response.status_code >= 400:
                        body = response.read().decode("utf-8", "replace")[:300]
                        raise LLMError(f"provider {response.status_code} : {body}")
                    for line in response.iter_lines():
                        if not line or not line.startswith("data:"):
                            continue
                        data = line[5:].strip()
                        if data == "[DONE]":
                            break
                        try:
                            event = json.loads(data)
                        except ValueError:
                            continue
                        usage = event.get("usage") or {}
                        output.prompt_tokens = int(usage.get("prompt_tokens") or output.prompt_tokens)
                        output.completion_tokens = int(usage.get("completion_tokens") or output.completion_tokens)
                        for choice in event.get("choices") or []:
                            delta = choice.get("delta") or {}
                            text = delta.get("content")
                            if isinstance(text, list):
                                text = "".join(str(part.get("text", "")) for part in text if isinstance(part, dict))
                            if text:
                                output.text += str(text)
                                yield {"delta": str(text)}
                            for call in delta.get("tool_calls") or []:
                                index = int(call.get("index", 0))
                                chunk = chunks.setdefault(index, {"function": {"name": "", "arguments": ""}})
                                if call.get("id"):
                                    chunk["id"] = call["id"]
                                if call.get("extra_content"):
                                    chunk["extra_content"] = call["extra_content"]
                                function = call.get("function") or {}
                                if function.get("name"):
                                    chunk["function"]["name"] = function["name"]
                                if function.get("arguments"):
                                    chunk["function"]["arguments"] += str(function["arguments"])
                    done = True
                    break
            if not done:
                raise LLMError("provider indisponible après plusieurs tentatives")
        except httpx.HTTPError as error:
            raise LLMError(f"provider injoignable : {error}") from error

        output.tool_calls = _parse_tool_calls(chunks)
        yield {"done": output}

    def run(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        on_text: Callable[[str], None] | None = None,
        model: str | None = None,
    ) -> TurnOutput:
        output = TurnOutput(model=model or self.model)
        for event in self.stream(messages, tools, model=model):
            if "delta" in event:
                output.text += event["delta"]
                if on_text:
                    on_text(event["delta"])
            else:
                output = event["done"]
        return output

    def close(self) -> None:
        self._client.close()


def assistant_message(output: TurnOutput) -> dict[str, Any]:
    message: dict[str, Any] = {"role": "assistant", "content": output.text or ""}
    if output.tool_calls:
        message["tool_calls"] = output.tool_calls
    return message
