"""DTOs at the service boundary. Mirror the TS side's shapes deliberately.

`amount_minor` is an int (cents) to match the TS `Money` brand — the two services
must never disagree on how money is represented.
"""
from pydantic import BaseModel, Field


class UnmatchedItem(BaseModel):
    source: str            # "stripe" | "ledger" | "payout"
    external_id: str
    amount_minor: int      # integer minor units (cents), same as TS Money
    currency: str          # ISO 4217
    occurred_at: str       # ISO 8601
    raw: dict              # original payload, for the model to reason over


class ExplanationRequest(BaseModel):
    run_id: str
    items: list[UnmatchedItem]


class Explanation(BaseModel):
    external_id: str
    hypothesis: str
    confidence: float = Field(ge=0.0, le=1.0)  # a suggestion, not an authority
    suggested_action: str
    needs_human: bool = True                   # default to caution
