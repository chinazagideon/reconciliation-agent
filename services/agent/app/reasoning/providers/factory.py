"""Provider factory: pick the concrete LLMProvider from config.

This is the single switch that makes the model swappable. Default is Anthropic
Claude; set LLM_PROVIDER=heuristic for the offline path (no key). Falls back to
the heuristic provider if 'anthropic' is selected without an API key, so the
service never hard-fails just because a key is missing — it degrades to a
working, if simpler, explainer.
"""
from app.config import config
from app.reasoning.providers.base import LLMProvider
from app.reasoning.providers.heuristic_provider import HeuristicProvider


def build_provider() -> LLMProvider:
    choice = config.llm_provider.lower()

    if choice == "heuristic":
        return HeuristicProvider()

    if choice == "anthropic":
        if not config.anthropic_api_key:
            # No key -> degrade to the offline provider rather than crash.
            return HeuristicProvider()
        # Imported lazily so the offline path needs no anthropic credentials set.
        from app.reasoning.providers.anthropic_provider import AnthropicProvider

        return AnthropicProvider(config.anthropic_api_key, config.llm_model)

    raise ValueError(f"Unknown LLM_PROVIDER: {config.llm_provider!r}")
