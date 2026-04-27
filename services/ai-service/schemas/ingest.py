from pydantic import BaseModel
from typing import Optional

class GitHubIngestRequest(BaseModel):
    user_id: str
    github_username: str
    token: Optional[str] = None

class IngestResponse(BaseModel):
    chunks_stored: int
