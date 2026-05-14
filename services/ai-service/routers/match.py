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
    weights = []
    for row in user_chunks.data or []:
        emb = row.get("embedding")
        meta = row.get("metadata", {})
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except Exception:
                meta = {}
                
        weight = 1.0
        if meta.get("repo") == "profile":
            weight = 2.0
        elif meta.get("repo") == "linkedin_profile":
            weight = 3.0
        elif meta.get("source") == "github":
            stars = meta.get("stars", 0)
            weight += np.log1p(stars) * 0.5
            
        if emb:
            parsed_embeddings.append(
                json.loads(emb) if isinstance(emb, str) else emb
            )
            weights.append(weight)

    if parsed_embeddings:
        query_embedding = np.average(parsed_embeddings, axis=0, weights=weights)
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

    # ── 2.5. Use search query if provided ────────────────────────────────────
    if request.search_query:
        # If the user explicitly searches, overwrite the profile context entirely.
        # This ensures pure semantic search based on their exact keywords.
        query_embedding = np.array(embedder.embed_query(request.search_query))

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

    # Aggregate github_username, languages, and total stars per user
    username_map: dict[str, str] = {}
    skills_map: dict[str, Counter] = {}
    total_stars_map: dict[str, int] = {}

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
            
        # total stars
        if uid not in total_stars_map:
            total_stars_map[uid] = 0
        total_stars_map[uid] += meta.get("stars", 0)

    # ── 6. Build final sorted results ──────────────────────────────────────
    results: list[MatchResult] = []
    for uid, info in user_best.items():
        top_skills = [lang for lang, _ in skills_map.get(uid, Counter()).most_common(5)]
        
        sim = info["similarity"]
        # Hybrid Search: Give a significant boost if the search query matches a tag/language
        if request.search_query:
            sq_lower = request.search_query.lower().strip()
            user_langs = list(skills_map.get(uid, Counter()).keys())
            
            matched_exact = False
            matched_partial = False
            matched_lang = None
            
            for l in user_langs:
                l_clean = l.lower().strip()
                if sq_lower == l_clean:
                    matched_exact = True
                    matched_lang = l
                    break
                elif sq_lower in l_clean:
                    matched_partial = True
                    if not matched_lang:
                        matched_lang = l
            
            if matched_exact:
                sim = max(sim + 0.50, 0.99)
            elif matched_partial:
                sim += 0.30
                
            # Force the matched tag to be visible in the UI so the user understands WHY they matched
            if matched_lang and matched_lang not in top_skills:
                top_skills.insert(0, matched_lang)
                if len(top_skills) > 5:
                    top_skills.pop()
                
        # Boost based on total repository stars
        user_stars = total_stars_map.get(uid, 0)
        if user_stars > 0:
            # Add up to 0.10 similarity for highly starred devs (e.g. 1000 stars = ~0.069 boost)
            star_boost = min(np.log1p(user_stars) * 0.01, 0.10)
            sim += star_boost
                
        # Clamp to max 1.0 to prevent weird >100% UI bugs
        sim = min(sim, 1.0)
                
        results.append(
            MatchResult(
                user_id=uid,
                similarity=sim,
                github_username=username_map.get(uid, uid),
                skills=top_skills,
            )
        )

    results.sort(key=lambda r: r.similarity, reverse=True)
    results = results[: request.top_k or 5]

    return MatchResponse(matches=results)
