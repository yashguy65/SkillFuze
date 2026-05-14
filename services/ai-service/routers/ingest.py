import os
from fastapi import APIRouter, HTTPException
from schemas.ingest import GitHubIngestRequest, IngestResponse
from parsers.github_parser import GitHubParser
from pipelines.embedder import get_embedder
from pipelines.supabase_client import get_supabase

router = APIRouter()

@router.post("/ingest", response_model=IngestResponse)
async def ingest_github_data(request: GitHubIngestRequest):
    token = request.token or os.environ.get("GITHUB_TOKEN")
    if not token:
        raise HTTPException(status_code=400, detail="GitHub token required in request or GITHUB_TOKEN env var")
    
    parser = GitHubParser(token=token)
    try:
        documents = await parser.fetch_user_data(request.github_username, request.user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    if not documents:
        return IngestResponse(chunks_stored=0)

    # Embed documents
    embedder = get_embedder()
    texts = [doc.page_content for doc in documents]
    embeddings = embedder.embed_documents(texts)
    
    # Upsert to Supabase
    supabase = get_supabase()
    
    rows = []
    for doc, emb in zip(documents, embeddings):
        rows.append({
            "user_id": request.user_id,
            "repo_name": doc.metadata.get("repo", ""),
            "content": doc.page_content,
            "metadata": doc.metadata,
            "embedding": emb
        })
        
    # Collect unique languages across all repo docs to return as tags
    seen_langs: set = set()
    extracted_tags: list = []
    for doc in documents:
        for lang in doc.metadata.get("languages", []):
            lang_lower = lang.lower()
            if lang_lower not in seen_langs:
                seen_langs.add(lang_lower)
                extracted_tags.append(lang)

    try:
        # Delete old chunks for this user to avoid duplicates on re-ingest (excluding custom_tags)
        supabase.table("github_chunks").delete().eq("user_id", request.user_id).neq("repo_name", "custom_tags").execute()
        # Insert new chunks
        res = supabase.table("github_chunks").insert(rows).execute()
        chunks_stored = len(rows)  # res.data might be empty depending on Supabase version
        print(f"Successfully inserted {chunks_stored} chunks into Supabase, tags: {extracted_tags}")
    except Exception as e:
        print("Supabase Error:", str(e))
        raise HTTPException(status_code=500, detail=f"Supabase error: {str(e)}")
    
    return IngestResponse(chunks_stored=chunks_stored, extracted_tags=extracted_tags)
