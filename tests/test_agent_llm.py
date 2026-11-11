

def test_cle_choisie_selon_le_fournisseur(monkeypatch):
    """Une clé Google envoyée à Mistral (ou l'inverse) coupe l'agent en prod."""
    from app.agent import llm

    monkeypatch.setenv("AGENT_LLM_KEY", "cle-gemini")
    monkeypatch.setenv("API_MISTRAL", "cle-mistral")
    monkeypatch.delenv("API_GROQ", raising=False)

    assert llm.configured_key("https://api.mistral.ai/v1/chat/completions") == "cle-mistral"
    assert llm.configured_key("https://generativelanguage.googleapis.com/v1beta/openai") == "cle-gemini"

    monkeypatch.setenv("API_GROQ", "cle-groq")
    assert llm.configured_key("https://api.groq.com/openai/v1/chat/completions") == "cle-groq"


def _sse(text: str) -> bytes:
    import json

    lines = [
        "data: " + json.dumps({"choices": [{"delta": {"content": text}}]}),
        "data: [DONE]",
        "",
    ]
    return "\n".join(lines).encode()


def test_le_secours_prend_le_relais_si_le_principal_refuse(monkeypatch):
    """Quota Gemini épuisé : l'agent répond quand même, via Mistral."""
    import httpx

    from app.agent import llm

    hits: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        hits.append(str(request.url))
        if "googleapis" in str(request.url):
            return httpx.Response(429, json={"error": {"code": 429}})
        return httpx.Response(200, content=_sse("Bonjour, voici la fourchette."))

    monkeypatch.setenv("AGENT_LLM_URL", "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions")
    monkeypatch.setenv("AGENT_LLM_KEY", "cle-gemini")
    monkeypatch.setenv("AGENT_LLM_FALLBACK_URL", "https://api.mistral.ai/v1/chat/completions")
    monkeypatch.setenv("API_MISTRAL", "cle-mistral")
    monkeypatch.setattr(llm.time, "sleep", lambda *_: None)

    client = llm.MistralClient(transport=httpx.MockTransport(handler))
    output = client.run([{"role": "user", "content": "prix ?"}], [])

    assert "fourchette" in output.text
    assert any("mistral" in hit for hit in hits)


def test_pas_de_secours_si_le_texte_a_deja_commence(monkeypatch):
    """Rejouer un tour déjà entamé dupliquerait la réponse chez le visiteur."""
    import httpx

    from app.agent import llm

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=_sse("Début"))

    monkeypatch.setenv("AGENT_LLM_URL", "https://api.mistral.ai/v1/chat/completions")
    monkeypatch.setenv("API_MISTRAL", "cle-mistral")
    monkeypatch.setenv("AGENT_LLM_FALLBACK_URL", "https://api.groq.com/openai/v1/chat/completions")
    monkeypatch.setenv("API_GROQ", "cle-groq")

    client = llm.MistralClient(transport=httpx.MockTransport(handler))
    seen: list[str] = []
    events = list(client._stream_from(llm.endpoint(), "cle-mistral", "m", [], [], seen))
    assert seen == ["Début"] and events
