"""Provider-agnostic LLM wrapper with free-tier friendly throttling and automatic retries.

Choose the provider in .env (LLM_PROVIDER):
anthropic  -> Claude via ANTHROPIC_API_KEY
gemini / openai / groq / openrouter / ollama / openai_compatible -> OpenAI-style API via LLM_API_KEY

Optional .env settings:
LLM_MIN_INTERVAL  seconds to wait between calls (default 12 for gemini, 0 otherwise)
LLM_MAX_RETRIES   retries after a rate-limit error (default 3)
LLM_RETRY_WAIT    base wait in seconds before a retry (default 20)
"""
import os
import threading
import time

import config  # noqa: F401  (loads .env)

PRESETS = {  # provider -> (default base_url, default model)
    "gemini": ("https://generativelanguage.googleapis.com/v1beta/openai/", "gemini-3.5-flash"),
    "openai": (None, "gpt-4o-mini"),
    "groq": ("https://api.groq.com/openai/v1", "llama-3.3-70b-versatile"),
    "openrouter": ("https://openrouter.ai/api/v1", ""),
    "ollama": ("http://localhost:11434/v1", "llama3.1"),
    "openai_compatible": (None, ""),
}
_clients: dict = {}
_lock = threading.Lock()
_last_call = [0.0]


def provider() -> str:
    return os.getenv("LLM_PROVIDER", "gemini").strip().lower()


def model() -> str:
    p = provider()
    if p == "anthropic":
        return os.getenv("CLAUDE_MODEL", "claude-sonnet-5-5")
    return os.getenv("LLM_MODEL") or PRESETS.get(p, (None, ""))[1]


def configured() -> bool:
    p = provider()
    if p == "anthropic":
        return bool(os.getenv("ANTHROPIC_API_KEY"))
    if p not in PRESETS:
        return False
    if p == "ollama":
        return True
    return bool(os.getenv("LLM_API_KEY")) and bool(model())


def problem() -> str:
    p = provider()
    if p != "anthropic" and p not in PRESETS:
        return f"Unknown LLM_PROVIDER '{p}'. Use anthropic, gemini, openai, groq, openrouter, ollama or openai_compatible."
    if configured():
        return ""
    if p == "anthropic":
        return "Set ANTHROPIC_API_KEY in .env and restart the server."
    if not os.getenv("LLM_API_KEY") and p != "ollama":
        return "Set LLM_API_KEY in .env and restart the server."
    return "Set LLM_MODEL in .env and restart the server."


def _is_rate_limit(e: Exception) -> bool:
    return type(e).__name__ in ("RateLimitError", "ResourceExhausted") or getattr(e, "status_code", None) == 429


def _throttle():
    default = "12" if provider() == "gemini" else "0"
    gap = float(os.getenv("LLM_MIN_INTERVAL", default))
    with _lock:
        wait = _last_call[0] + gap - time.time()
        if wait > 0:
            time.sleep(wait)
        _last_call[0] = time.time()


def _call(system: str, user: str, max_tokens: int) -> str:
    p = provider()
    if p == "anthropic":
        import anthropic
        c = _clients.setdefault("anthropic", anthropic.Anthropic())
        r = c.messages.create(model=model(), max_tokens=max_tokens, system=system,
                              messages=[{"role": "user", "content": user}])
        return "".join(b.text for b in r.content if b.type == "text")

    from openai import OpenAI
    base = os.getenv("LLM_BASE_URL") or PRESETS[p][0]
    key = (p, base, os.getenv("LLM_API_KEY"))
    if key not in _clients:
        _clients[key] = OpenAI(api_key=os.getenv("LLM_API_KEY") or "ollama", base_url=base)
    r = _clients[key].chat.completions.create(
        model=model(), max_tokens=max_tokens, temperature=0,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}])
    return r.choices[0].message.content or ""


def complete(system: str, user: str, max_tokens: int = 1500) -> str:
    retries = int(os.getenv("LLM_MAX_RETRIES", "3"))
    base_wait = float(os.getenv("LLM_RETRY_WAIT", "20"))
    for attempt in range(retries + 1):
        _throttle()
        try:
            return _call(system, user, max_tokens)
        except Exception as e:
            if not _is_rate_limit(e) or attempt == retries:
                raise
            time.sleep(min(base_wait * (attempt + 1), 60))
