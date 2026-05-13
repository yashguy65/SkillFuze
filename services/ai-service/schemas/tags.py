from pydantic import BaseModel
from typing import List

class TagsIngestRequest(BaseModel):
    user_id: str
    tags: List[str]

class TagsIngestResponse(BaseModel):
    success: bool
    chunks_stored: int
