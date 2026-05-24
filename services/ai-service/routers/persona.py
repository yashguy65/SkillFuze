from fastapi import APIRouter, HTTPException
from schemas.persona import PersonaRequest, PersonaResponse
from pipelines.supabase_client import get_supabase

router = APIRouter()

@router.post("/persona", response_model=PersonaResponse)
async def generate_persona(request: PersonaRequest):
    supabase = get_supabase()
    
    try:
        res = supabase.table("github_chunks").select("content, metadata").eq("user_id", request.user_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Supabase error: {str(e)}")
        
    if not res.data:
        raise HTTPException(status_code=404, detail="No data found for user")
        
    import json
    import os
    import re
    from collections import Counter
    
    # Load skills dictionary
    dict_path = os.path.join(os.path.dirname(__file__), "..", "parsers", "skills_dictionary.json")
    try:
        with open(dict_path, "r", encoding="utf-8") as f:
            skills_dict = json.load(f)
    except Exception:
        skills_dict = {}

    skill_counter = Counter()
    total_repos = sum(1 for r in res.data if r.get("metadata", {}).get("repo_name") != "custom_tags" and r.get("repo_name") != "custom_tags")
    
    for row in res.data:
        metadata = row.get("metadata", {}) or {}
        
        # Custom tags chunk — give those tags the highest weight
        if metadata.get("type") == "custom_tags":
            for tag in metadata.get("tags", []):
                skill_counter[tag] += 5
        else:
            if "languages" in metadata:
                for lang in metadata["languages"]:
                    skill_counter[lang] += 2
            if "topics" in metadata:
                for topic in metadata["topics"]:
                    display_topic = topic.replace("-", " ").title()
                    skill_counter[display_topic] += 1
                
        content = row.get("content", "")
        if content and metadata.get("type") != "custom_tags":
            if skills_dict:
                text_lower = content.lower()
                for key, val in skills_dict.items():
                    if re.search(rf"\b{re.escape(key)}\b", text_lower):
                        skill_counter[val] += 1

    # Get top 30 skills
    top_skills = [skill for skill, count in skill_counter.most_common(30)]
    if not top_skills:
        top_skills = ["Software Development"]

    return PersonaResponse(
        summary="",
        role="Developer",
        skills=top_skills,
        highlights=[],
        embedding=[]
    )
