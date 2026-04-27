from pydantic import BaseModel
from typing import List

class PersonaRequest(BaseModel):
    user_id: str

class PersonaResponse(BaseModel):
    summary: str
    skills: List[str]
    embedding: List[float]
