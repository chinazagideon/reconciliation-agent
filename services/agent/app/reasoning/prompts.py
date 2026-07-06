"""Prompt construction, versioned as code (so prompt drift is reviewable).

Keep the system prompt strict: the model must return structured output, must
attach a confidence, and must refuse to invent a match when it cannot justify one.
"""
import json

from app.domain.models import UnmatchedItem

SYSTEM_PROMPT = """You are a financial reconciliation assistant.
You ONLY explain why a transaction failed deterministic matching between a
payment processor (Stripe) and an internal double-entry ledger.
You never assert a definitive match as fact — you PROPOSE a hypothesis.
Rules:
- Always return a confidence in [0,1]. Be honest: low confidence when unsure.
- Prefer a concrete, checkable hypothesis (refund, failed webhook, partial
  capture, offline entry) over a vague one.
- If you cannot justify any hypothesis, say so and set a low confidence.
- Money is in integer minor units (cents). Never restate amounts as floats.
Return your answer ONLY through the record_explanations tool.
"""


def _summarise(item: UnmatchedItem) -> dict:
    """A compact, model-friendly view of one item (full raw can be large)."""
    raw = item.raw or {}
    return {
        "external_id": item.external_id,
        "source": item.source,
        "amount_minor": item.amount_minor,
        "currency": item.currency,
        "occurred_at": item.occurred_at,
        "type": raw.get("type"),
        "reporting_category": raw.get("reporting_category"),
        "description": raw.get("description"),
    }


def build_user_prompt(items: list[UnmatchedItem]) -> str:
    payload = [_summarise(i) for i in items]
    return (
        "These transactions could not be matched deterministically. For EACH one, "
        "give a hypothesis for why, a confidence, and a suggested action.\n\n"
        f"{json.dumps(payload, indent=2)}"
    )
