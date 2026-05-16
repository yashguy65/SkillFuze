from fastapi import APIRouter, HTTPException
from schemas.persona import PersonaRequest, PersonaResponse
from pipelines.embedder import get_embedder
from pipelines.supabase_client import get_supabase

router = APIRouter()

@router.post("/persona", response_model=PersonaResponse)
async def generate_persona(request: PersonaRequest):
    supabase = get_supabase()
    
    try:
        res = supabase.table("github_chunks").select("embedding, content, metadata").eq("user_id", request.user_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Supabase error: {str(e)}")
        
    if not res.data:
        raise HTTPException(status_code=404, detail="No data found for user")
        
    import json
    import numpy as np
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

    parsed_embeddings = []
    skill_counter = Counter()
    total_repos = len(res.data)
    
    if parsed_embeddings:
        avg_embedding = np.mean(parsed_embeddings, axis=0).tolist()
    else:
        embedder = get_embedder()
        avg_embedding = embedder.embed_query(f"Mock persona for {request.user_id}")
        
    try:
        from keybert import KeyBERT
        # Initialize KeyBERT with our existing SentenceTransformer model
        _embedder = get_embedder()
        kw_model = KeyBERT(model=_embedder.model)
    except Exception:
        kw_model = None

    for row in res.data:
        emb = row.get("embedding")
        if emb:
            parsed_embeddings.append(json.loads(emb) if isinstance(emb, str) else emb)
            
        metadata = row.get("metadata", {})
        if metadata:
            if "languages" in metadata:
                for lang in metadata["languages"]:
                    skill_counter[lang] += 2  # Weight languages higher
            if "topics" in metadata:
                for topic in metadata["topics"]:
                    # Clean topics (often lowercase-kebab) to be more readable
                    display_topic = topic.replace("-", " ").title()
                    skill_counter[display_topic] += 1
                
        content = row.get("content", "")
        if content:
            if skills_dict:
                text_lower = content.lower()
                for key, val in skills_dict.items():
                    if re.search(rf"\b{re.escape(key)}\b", text_lower):
                        skill_counter[val] += 1
                        
            if kw_model:
                keywords = kw_model.extract_keywords(
                    content,
                    keyphrase_ngram_range=(1, 2),
                    stop_words="english",
                    top_n=5
                )
                for kw, score in keywords:
                    if score > 0.3:
                        skill_counter[kw.title()] += 1
            

    # Get top 30 skills
    top_skills = [skill for skill, count in skill_counter.most_common(30)]
    if not top_skills:
        top_skills = ["Software Development"]
        
    # Determine Role
    FRONTEND_SKILLS = {"React", "Vue.js", "Angular", "HTML", "CSS", "TypeScript", "Tailwind CSS", "Next.js"}
    BACKEND_SKILLS = {"Node.js", "Python", "Go", "Java", "C#", "Ruby", "PHP", "SQL", "PostgreSQL", "MongoDB", "Docker", "AWS"}
    DATA_SKILLS = {"Python", "Machine Learning", "Data Science", "Pandas", "NumPy", "TensorFlow", "PyTorch", "SQL"}
    MOBILE_SKILLS = {"React Native", "Swift", "Kotlin", "Dart"}
    GAME_SKILLS = {"C++", "C#", "GDScript", "Unity 3D", "Unreal Engine"}

    scores = {"Frontend": 0, "Backend": 0, "Data/ML": 0, "Mobile": 0, "Game Dev": 0}
    for skill in top_skills:
        if skill in FRONTEND_SKILLS: scores["Frontend"] += 1
        if skill in BACKEND_SKILLS: scores["Backend"] += 1
        if skill in DATA_SKILLS: scores["Data/ML"] += 1
        if skill in MOBILE_SKILLS: scores["Mobile"] += 1
        if skill in GAME_SKILLS: scores["Game Dev"] += 1
        
    top_category = max(scores, key=scores.get)
    if scores[top_category] == 0:
        role = "Software Developer"
    elif scores["Frontend"] > 0 and scores["Backend"] > 0:
        role = "Full-stack Developer"
    else:
        role = f"{top_category} Developer"
        if top_category == "Data/ML": role = "Data/ML Engineer"

    # Generate Templated Summary
    if len(top_skills) > 2:
        primary_skills = ", ".join(top_skills[:2])
        other_skills = ", ".join(top_skills[2:])
        summary = f"Highly active {role} with experience across {total_repos} repositories. Strongest expertise in {primary_skills}, with additional experience in {other_skills}."
    else:
        summary = f"Active {role} focusing on {top_skills[0]} across {total_repos} repositories."

    # Highlights
    highlights = [
        f"Active in {total_repos}+ repositories",
        f"Primary focus: {top_skills[0]}" if top_skills else "Generalist Developer"
    ]
    if len(top_skills) > 1:
        highlights.append(f"Strong experience in {top_skills[1]}")

    return PersonaResponse(
        summary=summary,
        role=role,
        skills=top_skills,
        highlights=highlights,
        embedding=avg_embedding
    )
