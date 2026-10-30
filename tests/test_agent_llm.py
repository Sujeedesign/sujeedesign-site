

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
