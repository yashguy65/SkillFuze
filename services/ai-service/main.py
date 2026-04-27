import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from pipelines.embedder import get_embedder
from routers import ingest, persona, match
from dotenv import load_dotenv

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm up the embedder on startup
    print("Warming up HuggingFace Embeddings model...")
    get_embedder()
    print("Model loaded.")
    yield
    print("Shutting down...")

app = FastAPI(title="SkillFuze AI Service", lifespan=lifespan)

app.include_router(ingest.router, prefix="/api/v1", tags=["Ingestion"])
app.include_router(persona.router, prefix="/api/v1", tags=["Persona"])
app.include_router(match.router, prefix="/api/v1", tags=["Match"])

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "ai-service"}
