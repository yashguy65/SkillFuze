from fastapi import APIRouter, HTTPException
from schemas.tags import TagsIngestRequest, TagsIngestResponse
from pipelines.embedder import get_embedder
from pipelines.supabase_client import get_supabase

router = APIRouter()

@router.post("/tags/ingest", response_model=TagsIngestResponse)
async def ingest_tags(request: TagsIngestRequest):
    if not request.tags:
        # If no tags, we should probably delete the custom tags chunk
        supabase = get_supabase()
        try:
            supabase.table("github_chunks").delete().eq("user_id", request.user_id).eq("repo_name", "custom_tags").execute()
            return TagsIngestResponse(success=True, chunks_stored=0)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Supabase error: {str(e)}")

    content = ", ".join(request.tags)
    
    # Embed the tags
    embedder = get_embedder()
    try:
        embedding = embedder.embed_query(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding error: {str(e)}")
        
    row = {
        "user_id": request.user_id,
        "repo_name": "custom_tags",
        "content": content,
        "metadata": {"tags": request.tags, "type": "custom_tags", "languages": request.tags},
        "embedding": embedding
    }
    
    supabase = get_supabase()
    
    try:
        # Delete old custom_tags chunk
        supabase.table("github_chunks").delete().eq("user_id", request.user_id).eq("repo_name", "custom_tags").execute()
        # Insert new custom_tags chunk
        supabase.table("github_chunks").insert([row]).execute()
        chunks_stored = 1
    except Exception as e:
        print("Supabase Error:", str(e))
        raise HTTPException(status_code=500, detail=f"Supabase error: {str(e)}")
    
    return TagsIngestResponse(success=True, chunks_stored=chunks_stored)
