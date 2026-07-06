"""The reasoning boundary (ADR-0005).

This sidecar exists ONLY to explain items the deterministic core already gave up
on. It proposes hypotheses with confidence; it does not decide matches. Money-
touching AI rule: outputs are suggestions with confidence, not authoritative
answers, and low confidence routes to a human.
"""
from app.domain.models import UnmatchedItem, Explanation
from app.reasoning.prompts import SYSTEM_PROMPT


async def explain_items(items: list[UnmatchedItem]) -> list[Explanation]:
    # TODO: call the Anthropic Claude SDK with SYSTEM_PROMPT + structured tool
    #       schema; parse into Explanation objects.
    # TODO: enforce needs_human = confidence < THRESHOLD.
    _ = SYSTEM_PROMPT
    return [
        Explanation(
            external_id=i.external_id,
            hypothesis="TODO",
            confidence=0.0,
            suggested_action="review",
            needs_human=True,
        )
        for i in items
    ]
