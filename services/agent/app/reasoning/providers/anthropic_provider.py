"""Anthropic Claude provider — the default.

Uses tool-use to FORCE structured output: the model must return its hypotheses
through a tool schema, so we never parse free-form prose or trust the model to
format JSON by hand. Confidence is required and clamped to [0,1].
"""
import json

from anthropic import AsyncAnthropic

from app.domain.models import UnmatchedItem, Explanation
from app.reasoning.providers.base import LLMProvider
from app.reasoning.prompts import build_user_prompt

# The structured-output contract. The model MUST call this tool.
EXPLAIN_TOOL = {
    "name": "record_explanations",
    "description": "Record one reconciliation hypothesis per unmatched item.",
    "input_schema": {
        "type": "object",
        "properties": {
            "explanations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "external_id": {"type": "string"},
                        "hypothesis": {"type": "string"},
                        "confidence": {"type": "number", "minimum": 0.0, "maximum": 1.0},
                        "suggested_action": {
                            "type": "string",
                            "enum": [
                                "match_with",
                                "flag_refund",
                                "flag_chargeback",
                                "investigate",
                                "dismiss",
                            ],
                        },
                    },
                    "required": ["external_id", "hypothesis", "confidence", "suggested_action"],
                },
            }
        },
        "required": ["explanations"],
    },
}


def _clamp(x: float) -> float:
    return max(0.0, min(1.0, float(x)))


class AnthropicProvider(LLMProvider):
    name = "anthropic"

    def __init__(self, api_key: str, model: str) -> None:
        self._client = AsyncAnthropic(api_key=api_key)
        self._model = model

    async def explain(
        self, items: list[UnmatchedItem], system_prompt: str
    ) -> list[Explanation]:
        if not items:
            return []
        message = await self._client.messages.create(
            model=self._model,
            max_tokens=2048,
            system=system_prompt,
            tools=[EXPLAIN_TOOL],
            tool_choice={"type": "tool", "name": "record_explanations"},
            messages=[{"role": "user", "content": build_user_prompt(items)}],
        )
        rows: list[dict] = []
        for block in message.content:
            if block.type == "tool_use" and block.name == "record_explanations":
                data = block.input
                if isinstance(data, str):
                    data = json.loads(data)
                rows = data.get("explanations", [])
                break

        by_id = {r["external_id"]: r for r in rows if "external_id" in r}
        out: list[Explanation] = []
        for item in items:
            r = by_id.get(item.external_id)
            if r is None:
                # Model dropped an item: default to caution, route to a human.
                out.append(
                    Explanation(
                        external_id=item.external_id,
                        hypothesis="No hypothesis returned for this item.",
                        confidence=0.0,
                        suggested_action="investigate",
                        needs_human=True,
                    )
                )
                continue
            out.append(
                Explanation(
                    external_id=item.external_id,
                    hypothesis=str(r.get("hypothesis", "")),
                    confidence=_clamp(r.get("confidence", 0.0)),
                    suggested_action=str(r.get("suggested_action", "investigate")),
                    needs_human=True,  # explainer re-applies the threshold
                )
            )
        return out
