from fastapi import APIRouter
from schemas.persona import PersonaRequest, PersonaResponse
from pipelines.embedder import get_embedder

router = APIRouter()

@router.post("/persona", response_model=PersonaResponse)
async def generate_persona(request: PersonaRequest):
    # TODO: Fetch stored vectors for user_id from Supabase
    # TODO: Generate a text summary using the embedder/LLM and spacy (Phase 3)
    
    embedder = get_embedder()
    # Stub embedding for now
    embedding = embedder.embed_query(f"Mock persona for {request.user_id}")
    
    return PersonaResponse(
        summary=f"Stub summary for {request.user_id}",
        skills=["Python", "FastAPI"],
        embedding=embedding
    )
