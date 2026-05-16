from pydantic import BaseModel
from typing import List

class PersonaRequest(BaseModel):
    user_id: str

class PersonaResponse(BaseModel):
    summary: str
    role: str
    skills: List[str]
    highlights: List[str]
    embedding: List[float]
