"""Google Gemini provider.

Uses Gemini's native structured output (response_mime_type=application/json +
response_schema) to FORCE a well-formed array of hypotheses — no free-form prose
parsing. Confidence is required and clamped to [0,1]. Behaviourally identical to
the Anthropic provider from the explainer's point of view; only the wire differs,
which is the whole point of the LLMProvider seam.
"""
import json

from google import genai
from google.genai import types

from app.domain.models import UnmatchedItem, Explanation
from app.reasoning.providers.base import LLMProvider
from app.reasoning.prompts import build_user_prompt

DEFAULT_MODEL = "gemini-2.5-flash"

# Gemini schema (OpenAPI subset, uppercase type names). Mirrors the Anthropic
# tool schema so both providers return the same shape.
_RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "explanations": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "external_id": {"type": "STRING"},
                    "hypothesis": {"type": "STRING"},
                    "confidence": {"type": "NUMBER"},
                    "suggested_action": {
                        "type": "STRING",
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
}


def _clamp(x: float) -> float:
    return max(0.0, min(1.0, float(x)))


class GeminiProvider(LLMProvider):
    name = "gemini"

    def __init__(self, api_key: str, model: str) -> None:
        self._client = genai.Client(api_key=api_key)
        # config.llm_model defaults to a Claude id; fall back to a Gemini model
        # unless the caller explicitly set a gemini-* one.
        self._model = model if model.startswith("gemini") else DEFAULT_MODEL

    async def explain(
        self, items: list[UnmatchedItem], system_prompt: str
    ) -> list[Explanation]:
        if not items:
            return []
        response = await self._client.aio.models.generate_content(
            model=self._model,
            contents=build_user_prompt(items),
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                response_mime_type="application/json",
                response_schema=_RESPONSE_SCHEMA,
                max_output_tokens=2048,
            ),
        )
        data = json.loads(response.text or "{}")
        rows = data.get("explanations", [])

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
