"""Swappable LLM provider seam.

The reasoning logic depends on THIS interface, never on a vendor SDK directly
(DIP — mirrors the TypeScript core's AgentPort inversion). Selecting a different
model is a config change (LLM_PROVIDER / LLM_MODEL), not a code change: "if Claude
is unavailable, swap another model" is wiring, not a rewrite.

A provider's ONLY job is to turn unmatched items into hypotheses with a
confidence. It never decides a match and never enforces the human-review
threshold — that policy lives in the explainer, above this boundary.
"""
from abc import ABC, abstractmethod

from app.domain.models import UnmatchedItem, Explanation


class LLMProvider(ABC):
    #: short name for logs / health output, e.g. "anthropic", "heuristic"
    name: str = "base"

    @abstractmethod
    async def explain(
        self, items: list[UnmatchedItem], system_prompt: str
    ) -> list[Explanation]:
        """Return one Explanation per item. `needs_human` may be left at its
        cautious default; the explainer re-applies the confidence threshold."""
        raise NotImplementedError
