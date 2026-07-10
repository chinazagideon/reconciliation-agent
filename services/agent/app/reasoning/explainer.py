"""The reasoning boundary (ADR-0005).

This sidecar exists ONLY to explain items the deterministic core already gave up
on. It proposes hypotheses with confidence; it does not decide matches. Money-
touching AI rule: outputs are suggestions with confidence, not authoritative
answers, and low confidence routes to a human.

Provider-agnostic: the actual model call lives behind an LLMProvider chosen by
config. This module owns POLICY — enforcing the human-review threshold — which
must not depend on which model produced the confidence.
"""
from app.config import config
from app.domain.models import UnmatchedItem, Explanation
from app.reasoning.prompts import SYSTEM_PROMPT
from app.reasoning.providers.factory import build_provider

# Built once at import; swap models via env (LLM_PROVIDER / LLM_MODEL).
_provider = build_provider()


async def explain_items(items: list[UnmatchedItem]) -> list[Explanation]:
    if not items:
        return []
    explanations = await _provider.explain(items, SYSTEM_PROMPT)
    # Enforce the threshold HERE, regardless of provider: below it -> human.
    threshold = config.ai_confidence_threshold
    for e in explanations:
        e.needs_human = e.confidence < threshold
    return explanations
