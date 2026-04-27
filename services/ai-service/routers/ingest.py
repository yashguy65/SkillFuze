import os
from fastapi import APIRouter, HTTPException
from schemas.ingest import GitHubIngestRequest, IngestResponse
from parsers.github_parser import GitHubParser
from pipelines.embedder import get_embedder

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
    
    # TODO: Upsert to Supabase pgvector
    # For now, we stub this out
    chunks_stored = len(documents)
    
    return IngestResponse(chunks_stored=chunks_stored)
