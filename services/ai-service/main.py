import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pipelines.embedder import get_embedder
from routers import ingest, persona, match
from dotenv import load_dotenv

# Load root .env file
load_dotenv(os.path.join(os.path.dirname(__file__), '../../.env'))

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm up the embedder on startup
    print("Warming up HuggingFace Embeddings model...")
    get_embedder()
    print("Model loaded.")
    yield
    print("Shutting down...")


app = FastAPI(title="SkillFuze AI Service", lifespan=lifespan)

# Get allowed origins from env, defaulting to localhost and wildcard for Vercel
# Strict CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://skillfuze.vercel.app",
        "http://localhost:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(ingest.router, prefix="/api/v1", tags=["Ingestion"])
app.include_router(persona.router, prefix="/api/v1", tags=["Persona"])
app.include_router(match.router, prefix="/api/v1", tags=["Match"])

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "ai-service"}
