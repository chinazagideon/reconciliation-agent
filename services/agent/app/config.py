"""Config from environment only. No secrets in source (ADR-0001)."""
import os


class Config:
    anthropic_api_key: str = os.environ.get("ANTHROPIC_API_KEY", "")
    port: int = int(os.environ.get("PORT", "8000"))


config = Config()
