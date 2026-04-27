from pydantic import BaseModel
from typing import List, Optional

class MatchRequest(BaseModel):
    user_id: str
    top_k: Optional[int] = 5
    custom_tags: Optional[List[str]] = None

class MatchResult(BaseModel):
    user_id: str
    similarity: float
    github_username: str = ""
    skills: List[str] = []

class MatchResponse(BaseModel):
    matches: List[MatchResult]
