from fastapi import APIRouter, HTTPException
from schemas.match import MatchRequest, MatchResponse, MatchResult
from pipelines.embedder import get_embedder
from pipelines.supabase_client import get_supabase

router = APIRouter()

@router.post("/match", response_model=MatchResponse)
async def match_users(request: MatchRequest):
    embedder = get_embedder()
    # Stub query embedding for Phase 2
    query_embedding = embedder.embed_query(f"Match query for {request.user_id}")
    
    supabase = get_supabase()
    try:
        res = supabase.rpc(
            "match_github_chunks",
            {
                "query_embedding": query_embedding,
                "match_threshold": 0.0,
                "match_count": request.top_k or 5
            }
        ).execute()
        
        matches = []
        for row in res.data:
            # We can optionally exclude the querying user themselves
            if row["user_id"] != request.user_id:
                matches.append(MatchResult(user_id=row["user_id"], similarity=row["similarity"]))
                
        return MatchResponse(matches=matches)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Supabase error: {str(e)}")
