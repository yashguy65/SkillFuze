import json
from collections import Counter

import numpy as np
from fastapi import APIRouter, HTTPException
from schemas.match import MatchRequest, MatchResponse, MatchResult
from pipelines.embedder import get_embedder
from pipelines.supabase_client import get_supabase

router = APIRouter()


@router.post("/match", response_model=MatchResponse)
async def match_users(request: MatchRequest):
    embedder = get_embedder()
    supabase = get_supabase()

    # ── 1. Build query embedding from the user's OWN data ──────────────────
    try:
        user_chunks = (
            supabase.table("github_chunks")
            .select("embedding, content, metadata")
            .eq("user_id", request.user_id)
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Supabase error: {e}")

    # Parse existing embeddings for this user
    parsed_embeddings = []
    for row in user_chunks.data or []:
        emb = row.get("embedding")
        if emb:
            parsed_embeddings.append(
                json.loads(emb) if isinstance(emb, str) else emb
            )

    if parsed_embeddings:
        query_embedding = np.mean(parsed_embeddings, axis=0)
    else:
        # Fallback: embed a generic developer profile string
        query_embedding = np.array(
            embedder.embed_query("software developer programmer")
        )

    # ── 2. Blend custom tags into the query if provided ────────────────────
    if request.custom_tags:
        tags_text = ", ".join(request.custom_tags)
        tags_embedding = np.array(embedder.embed_query(tags_text))
        # 60% user GitHub data, 40% custom tags
        query_embedding = query_embedding * 0.6 + tags_embedding * 0.4

    # Normalise so cosine distance stays meaningful
    norm = np.linalg.norm(query_embedding)
    if norm > 0:
        query_embedding = query_embedding / norm

    query_embedding_list = query_embedding.tolist()

    # ── 3. Run vector similarity search ────────────────────────────────────
    #   Fetch many chunks so we have enough after deduplication.
    try:
        res = supabase.rpc(
            "match_github_chunks",
            {
                "query_embedding": query_embedding_list,
                "match_threshold": 0.0,
                "match_count": 50,
            },
        ).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Supabase RPC error: {e}")

    # ── 4. Deduplicate by user_id, keeping the BEST similarity ─────────────
    user_best: dict[str, dict] = {}

    for row in res.data or []:
        uid = row["user_id"]
        if uid == request.user_id:
            continue  # skip self

        sim = row["similarity"]
        if uid not in user_best or sim > user_best[uid]["similarity"]:
            user_best[uid] = {
                "user_id": uid,
                "similarity": sim,
            }

    if not user_best:
        return MatchResponse(matches=[])

    # ── 5. Look up github_username & skills for each matched user ──────────
    matched_uids = list(user_best.keys())

    try:
        meta_res = (
            supabase.table("github_chunks")
            .select("user_id, metadata")
            .in_("user_id", matched_uids)
            .execute()
        )
    except Exception:
        meta_res = type("R", (), {"data": []})()

    # Aggregate github_username and languages per user
    username_map: dict[str, str] = {}
    skills_map: dict[str, Counter] = {}

    for row in meta_res.data or []:
        uid = row["user_id"]
        meta = row.get("metadata") or {}
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except (json.JSONDecodeError, TypeError):
                meta = {}

        # github_username – take first non-empty value
        if uid not in username_map and meta.get("github_username"):
            username_map[uid] = meta["github_username"]

        # languages
        if uid not in skills_map:
            skills_map[uid] = Counter()
        for lang in meta.get("languages", []):
            skills_map[uid][lang] += 1

    # ── 6. Build final sorted results ──────────────────────────────────────
    results: list[MatchResult] = []
    for uid, info in user_best.items():
        top_skills = [lang for lang, _ in skills_map.get(uid, Counter()).most_common(5)]
        results.append(
            MatchResult(
                user_id=uid,
                similarity=info["similarity"],
                github_username=username_map.get(uid, uid),
                skills=top_skills,
            )
        )

    results.sort(key=lambda r: r.similarity, reverse=True)
    results = results[: request.top_k or 5]

    return MatchResponse(matches=results)
