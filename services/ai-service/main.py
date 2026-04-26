from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="SkillFuze AI Service Stub")

class ProfileChunk(BaseModel):
    text: str

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "ai-service"}

@app.post("/api/v1/embeddings")
def generate_embeddings(chunk: ProfileChunk):
    # Stub for generating embeddings
    # In phase 2, this will use an actual LLM/embedding model
    return {"embedding": [0.1] * 1536} # Mock 1536-dimensional vector
