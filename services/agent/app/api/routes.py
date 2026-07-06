"""HTTP routes. Thin: validate (via pydantic), delegate to explainer, return."""
from fastapi import APIRouter
from app.domain.models import ExplanationRequest, Explanation
from app.reasoning.explainer import explain_items

router = APIRouter()


@router.post("/explain", response_model=list[Explanation])
async def explain(req: ExplanationRequest) -> list[Explanation]:
    return await explain_items(req.items)
