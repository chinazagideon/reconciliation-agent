"""FastAPI sidecar entrypoint."""
from fastapi import FastAPI

from app.api.routes import router
from app.config import config
from app.reasoning.explainer import _provider

app = FastAPI(title="Resolution AI — reasoning sidecar", version="0.1.0")
app.include_router(router)


@app.get("/health")
async def health() -> dict[str, str]:
    # Report the active provider/model so the core (and Settings UI) can show
    # exactly which model is reasoning — part of the swappable-provider story.
    return {"status": "ok", "provider": _provider.name, "model": config.llm_model}
