"""FastAPI sidecar entrypoint."""
from fastapi import FastAPI
from app.api.routes import router

app = FastAPI(title="Resolution AI — reasoning sidecar", version="0.1.0")
app.include_router(router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
