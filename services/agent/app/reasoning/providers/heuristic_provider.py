"""Offline, deterministic provider.

No network, no API key. It reasons from the record's own fields (amount sign,
source, Stripe type) to produce a plausible hypothesis + calibrated confidence.
Two jobs:
  1. Lets the whole pipeline — and the demo — run end-to-end with no LLM key.
  2. Proves the swappable-provider design: selecting it is one env var
     (LLM_PROVIDER=heuristic), no code change.

It is deliberately conservative: anything it cannot explain gets low confidence
so the threshold routes it to a human.
"""
from app.domain.models import UnmatchedItem, Explanation
from app.reasoning.providers.base import LLMProvider


class HeuristicProvider(LLMProvider):
    name = "heuristic"

    async def explain(
        self, items: list[UnmatchedItem], system_prompt: str
    ) -> list[Explanation]:
        return [self._one(i) for i in items]

    def _one(self, item: UnmatchedItem) -> Explanation:
        raw = item.raw or {}
        rtype = str(raw.get("type", "")).lower()
        category = str(raw.get("reporting_category", "")).lower()

        # Negative amount or a refund-typed Stripe record: likely a reversal with
        # no ledger counterpart yet.
        if item.amount_minor < 0 or rtype == "refund" or category == "refund":
            return Explanation(
                external_id=item.external_id,
                hypothesis=(
                    "Negative/refund entry on Stripe with no matching ledger "
                    "reversal — likely an unprocessed refund awaiting a ledger entry."
                ),
                confidence=0.82,
                suggested_action="flag_refund",
                needs_human=True,
            )

        # A Stripe charge with no ledger match: classic failed-webhook signature.
        if item.source == "stripe" and rtype in ("charge", ""):
            return Explanation(
                external_id=item.external_id,
                hypothesis=(
                    "Stripe charge present with no ledger counterpart — a webhook "
                    "may have failed to post the corresponding ledger entry."
                ),
                confidence=0.58,
                suggested_action="investigate",
                needs_human=True,
            )

        # A ledger entry with no Stripe side: could be an offline/manual entry.
        if item.source in ("ledger", "payout"):
            return Explanation(
                external_id=item.external_id,
                hypothesis=(
                    "Ledger entry with no Stripe charge — may be a manual entry for "
                    "an offline payment collected outside the platform."
                ),
                confidence=0.34,
                suggested_action="investigate",
                needs_human=True,
            )

        return Explanation(
            external_id=item.external_id,
            hypothesis="Unable to attribute this item to a known pattern.",
            confidence=0.2,
            suggested_action="investigate",
            needs_human=True,
        )
