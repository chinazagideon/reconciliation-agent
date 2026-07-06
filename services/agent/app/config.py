"""Config from environment only. No secrets in source (ADR-0001)."""
import os


class Config:
    anthropic_api_key: str = os.environ.get("ANTHROPIC_API_KEY", "")
    port: int = int(os.environ.get("PORT", "8000"))

    # Below this confidence, an item needs a human. Runtime config lives in env,
    # not the DB (PRD §8, decision 2). The Settings page shows it read-only.
    ai_confidence_threshold: float = float(os.environ.get("AI_CONFIDENCE_THRESHOLD", "0.70"))

    # Swappable model selection (see reasoning/providers/factory.py).
    llm_provider: str = os.environ.get("LLM_PROVIDER", "anthropic")
    llm_model: str = os.environ.get("LLM_MODEL", "claude-sonnet-5")


config = Config()
