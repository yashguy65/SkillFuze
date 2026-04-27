from fastapi import APIRouter, HTTPException
from schemas.persona import PersonaRequest, PersonaResponse
from pipelines.embedder import get_embedder
from pipelines.supabase_client import get_supabase

router = APIRouter()

@router.post("/persona", response_model=PersonaResponse)
async def generate_persona(request: PersonaRequest):
    supabase = get_supabase()
    
    try:
        res = supabase.table("github_chunks").select("embedding, content, metadata").eq("user_id", request.user_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Supabase error: {str(e)}")
        
    if not res.data:
        raise HTTPException(status_code=404, detail="No data found for user")
        
    # Calculate average embedding to represent the user's overall persona
    import json
    import numpy as np
    
    parsed_embeddings = []
    for row in res.data:
        emb = row.get("embedding")
        if emb:
            parsed_embeddings.append(json.loads(emb) if isinstance(emb, str) else emb)
            
    if parsed_embeddings:
        avg_embedding = np.mean(parsed_embeddings, axis=0).tolist()
    else:
        embedder = get_embedder()
        avg_embedding = embedder.embed_query(f"Mock persona for {request.user_id}")
        
    # Extract languages from metadata to find top 4
    from collections import Counter
    lang_counter = Counter()
    for row in res.data:
        metadata = row.get("metadata", {})
        if metadata and "languages" in metadata:
            for lang in metadata["languages"]:
                lang_counter[lang] += 1
                
    # Get top 4 languages
    top_languages = [lang for lang, count in lang_counter.most_common(4)]
    if not top_languages:
        top_languages = ["Unknown"]
        
    # TODO: Generate a text summary using an LLM and spacy (Phase 3)
    
    return PersonaResponse(
        summary=f"Stub summary for {request.user_id} based on {len(res.data)} repos/chunks.",
        skills=top_languages,
        embedding=avg_embedding
    )
