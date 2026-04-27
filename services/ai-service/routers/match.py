from fastapi import APIRouter
from schemas.match import MatchRequest, MatchResponse, MatchResult
from pipelines.embedder import get_embedder

router = APIRouter()

@router.post("/match", response_model=MatchResponse)
async def match_users(request: MatchRequest):
    # embedder = get_embedder()
    # query_embedding = embedder.embed_query(f"Match query for {request.user_id}")
    
    # TODO: Run cosine similarity search in Supabase using query_embedding
    
    # Stub response
    return MatchResponse(
        matches=[
            MatchResult(user_id="user_123", similarity=0.95),
            MatchResult(user_id="user_456", similarity=0.82)
        ]
    )
