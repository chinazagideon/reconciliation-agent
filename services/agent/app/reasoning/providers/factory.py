"""Provider factory: pick the concrete LLMProvider from config.

This is the single switch that makes the model swappable. Providers: "anthropic"
(default, Claude), "gemini" (Google), and "heuristic" (offline, no key). Any API
provider selected without its key degrades to the heuristic provider rather than
hard-failing, so the service always answers — with a simpler explainer at worst.
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

    if choice == "gemini":
        if not config.gemini_api_key:
            return HeuristicProvider()
        # Lazy import so anthropic/heuristic paths need no google-genai installed.
        from app.reasoning.providers.gemini_provider import GeminiProvider

        return GeminiProvider(config.gemini_api_key, config.llm_model)

    raise ValueError(f"Unknown LLM_PROVIDER: {config.llm_provider!r}")
