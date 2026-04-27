from fastapi import APIRouter, HTTPException
from schemas.persona import PersonaRequest, PersonaResponse
from pipelines.embedder import get_embedder
from pipelines.supabase_client import get_supabase

router = APIRouter()

@router.post("/persona", response_model=PersonaResponse)
async def generate_persona(request: PersonaRequest):
    supabase = get_supabase()
    
    try:
        res = supabase.table("github_chunks").select("embedding, content").eq("user_id", request.user_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Supabase error: {str(e)}")
        
    if not res.data:
        raise HTTPException(status_code=404, detail="No data found for user")
        
    # Calculate average embedding to represent the user's overall persona
    embeddings = [row["embedding"] for row in res.data if row.get("embedding")]
    if embeddings:
        import numpy as np
        avg_embedding = np.mean(embeddings, axis=0).tolist()
    else:
        embedder = get_embedder()
        avg_embedding = embedder.embed_query(f"Mock persona for {request.user_id}")
        
    # TODO: Generate a text summary using an LLM and spacy (Phase 3)
    
    return PersonaResponse(
        summary=f"Stub summary for {request.user_id} based on {len(res.data)} repos/chunks.",
        skills=["Python", "FastAPI"], # Stub skills for now
        embedding=avg_embedding
    )
