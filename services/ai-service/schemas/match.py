from pydantic import BaseModel
from typing import List, Optional

class MatchRequest(BaseModel):
    user_id: str
    top_k: Optional[int] = 5

class MatchResult(BaseModel):
    user_id: str
    similarity: float

class MatchResponse(BaseModel):
    matches: List[MatchResult]
