from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from schemas.ingest import IngestResponse
from parsers.linkedin_parser import LinkedInParser
from pipelines.embedder import get_embedder
from pipelines.supabase_client import get_supabase

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
    except Exception as e:
        print("Supabase Error:", str(e))
        raise HTTPException(status_code=500, detail=f"Supabase error: {str(e)}")
    
    return IngestResponse(chunks_stored=chunks_stored, extracted_tags=extracted_skills)
