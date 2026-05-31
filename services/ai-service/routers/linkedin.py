from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from schemas.ingest import IngestResponse, LinkedInProfileRequest
from parsers.linkedin_parser import LinkedInParser
from pipelines.embedder import get_embedder
from pipelines.supabase_client import get_supabase
from langchain_core.documents import Document
from pipelines.redis_client import cache_delete, cache_delete_pattern

router = APIRouter()


@router.post("/ingest/linkedin", response_model=IngestResponse)
async def ingest_linkedin_data(
    user_id: str = Form(...),
    file: UploadFile = File(...)
):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
        
    try:
        pdf_bytes = await file.read()
        parser = LinkedInParser()
        documents, extracted_skills = parser.parse_pdf(pdf_bytes, user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    if not documents:
        return IngestResponse(chunks_stored=0, extracted_tags=[])

    # Embed documents
    embedder = get_embedder()
    texts = [doc.page_content for doc in documents]
    embeddings = embedder.embed_documents(texts)
    
    # Upsert to Supabase
    supabase = get_supabase()
    
    rows = []
    for doc, emb in zip(documents, embeddings):
        rows.append({
            "user_id": user_id,
            "repo_name": doc.metadata.get("repo", ""),
            "content": doc.page_content,
            "metadata": doc.metadata,
            "embedding": emb
        })
        
    try:
        # Delete old linkedin chunks for this user
        # Note: using 'linkedin_profile' as repo_name for compatibility
        supabase.table("github_chunks").delete().eq("user_id", user_id).eq("repo_name", "linkedin_profile").execute()
        # Insert new chunks
        supabase.table("github_chunks").insert(rows).execute()
        chunks_stored = len(rows)
        print(f"Successfully inserted {chunks_stored} LinkedIn chunks into Supabase")
        cache_delete(f"embed:{user_id}")
        cache_delete_pattern(f"match:{user_id}:*")
    except Exception as e:
        print("Supabase Error:", str(e))
        raise HTTPException(status_code=500, detail=f"Supabase error: {str(e)}")
    
    return IngestResponse(chunks_stored=chunks_stored, extracted_tags=extracted_skills)


@router.post("/ingest/linkedin-profile", response_model=IngestResponse)
async def ingest_linkedin_profile(payload: LinkedInProfileRequest):
    """
    Ingest LinkedIn profile data from OIDC metadata (no PDF required).
    Accepts structured fields: name, headline, skills list.
    Used for auto-sync on first LinkedIn sign-in and manual re-sync from Settings.
    """
    user_id = payload.user_id
    name = payload.name or ""
    headline = payload.headline or ""
    skills = payload.skills or []

    # Build a text document from available OIDC fields
    parts = []
    if name:
        parts.append(f"Name: {name}")
    if headline:
        parts.append(f"Headline: {headline}")
    if skills:
        parts.append("Skills: " + ", ".join(skills))

    if not parts:
        return IngestResponse(chunks_stored=0, extracted_tags=[])

    text = "\n".join(parts)

    # Create a single document (profile is short — no splitting needed)
    base_meta = {
        "user_id": user_id,
        "source": "linkedin",
        "repo": "linkedin_profile",
    }
    documents = [Document(page_content=text, metadata={**base_meta, "languages": skills})]

    # Embed
    embedder = get_embedder()
    embeddings = embedder.embed_documents([text])

    rows = [{
        "user_id": user_id,
        "repo_name": "linkedin_profile",
        "content": text,
        "metadata": base_meta,
        "embedding": embeddings[0]
    }]

    supabase = get_supabase()
    try:
        # Replace existing linkedin_profile chunks for this user
        supabase.table("github_chunks").delete()\
            .eq("user_id", user_id)\
            .eq("repo_name", "linkedin_profile")\
            .execute()
        supabase.table("github_chunks").insert(rows).execute()
        print(f"Inserted LinkedIn profile identity chunk for user {user_id}")
        cache_delete(f"embed:{user_id}")
        cache_delete_pattern(f"match:{user_id}:*")
    except Exception as e:
        print("Supabase Error:", str(e))
        raise HTTPException(status_code=500, detail=f"Supabase error: {str(e)}")

    return IngestResponse(chunks_stored=1, extracted_tags=skills)
