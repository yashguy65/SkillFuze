from pydantic import BaseModel
from typing import Optional, List

class GitHubIngestRequest(BaseModel):
    user_id: str
    github_username: str
    token: Optional[str] = None

class IngestResponse(BaseModel):
    chunks_stored: int
    extracted_tags: Optional[List[str]] = None

class LinkedInProfileRequest(BaseModel):
    user_id: str
    name: Optional[str] = None
    headline: Optional[str] = None
    skills: Optional[List[str]] = None

class PurgeRequest(BaseModel):
    user_id: str

class PurgeResponse(BaseModel):
    success: bool
    chunks_deleted: int
