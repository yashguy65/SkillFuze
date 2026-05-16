import json
import re
from collections import Counter
from pathlib import Path

import numpy as np
from fastapi import APIRouter, HTTPException
from schemas.match import MatchRequest, MatchResponse, MatchResult
from pipelines.embedder import get_embedder
from pipelines.supabase_client import get_supabase

router = APIRouter()

# ── Load skills dictionary ────────────────────────────────────────────────────
_SKILLS_PATH = Path(__file__).parent.parent / "parsers" / "skills_dictionary.json"
with open(_SKILLS_PATH, "r") as f:
    _SKILLS_DICT: dict[str, str] = json.load(f)

# Sort by length descending so longer phrases match first (e.g. "spring boot" before "spring")
_SKILL_KEYS_SORTED = sorted(_SKILLS_DICT.keys(), key=len, reverse=True)

# Intent filler words to strip from natural language queries
_FILLER_PATTERNS = [
    r"\b(looking for|i need|i want|find me|find|search for|search|someone who|a person who|"
    r"developer who|dev who|engineer who|programmer who|a dev with|someone with|"
    r"a developer with|a programmer with|who knows|who uses|that knows|that uses|"
    r"skilled in|experienced in|proficient in|expert in|good at|good with|"
    r"familiar with|knowledgeable in|specializes in|specializing in|"
    r"can work with|works with|using|with|and|or|the|a|an|,)\b",
]
_FILLER_RE = re.compile("|".join(_FILLER_PATTERNS), re.IGNORECASE)

# Cosine similarity calibration:
# MiniLM cosine scores for "python" vs a Python dev's chunks are typically 0.40–0.65.
# We remap [SIM_LOW, SIM_HIGH] → [0, 1] to give intuitive percentages.
SIM_LOW = 0.20   # score at or below this becomes 0 %
SIM_HIGH = 0.75  # score at or above this becomes 100 %


def _extract_skills(query: str) -> list[str]:
    """
    Extract recognized skill tokens from a natural language query.
    Returns lowercase canonical keys found in the skills dictionary,
    in the order they appear, deduplicated.
    """
    q = query.lower()
    found: list[str] = []
    seen: set[str] = set()
    used_spans: list[tuple[int, int]] = []

    for key in _SKILL_KEYS_SORTED:
        # Use lookaround assertions instead of \b so that symbol-containing
        # skills like 'c++', 'c#', '.net' are matched correctly.
        # \b fails when the token ends with a non-word character (e.g. '+')
        # because it requires a \w↔\W transition, which doesn't exist between
        # two adjacent non-word characters such as '+' and ' '.
        pattern = r"(?<!\w)" + re.escape(key) + r"(?!\w)"
        for m in re.finditer(pattern, q):
            start, end = m.start(), m.end()
            # Don't count overlapping spans
            if any(s <= start < e or s < end <= e for s, e in used_spans):
                continue
            # Guard against 'c' matching inside 'c++' or 'c#' –
            # if the character immediately after the match is '+' or '#',
            # skip this hit (it belongs to a longer token that wasn't matched).
            if end < len(q) and q[end] in ('+', '#'):
                continue
            if key not in seen:
                found.append(key)
                seen.add(key)
            used_spans.append((start, end))

    return found


def _strip_intent_words(query: str) -> str:
    """
    Remove filler/intent words from a natural language query, leaving only
    the meaningful skill/topic tokens.
    """
    cleaned = _FILLER_RE.sub(" ", query)
    # Collapse whitespace and punctuation remnants
    cleaned = re.sub(r"[^\w\s.#+]", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def _calibrate(sim: float) -> float:
    """Remap raw cosine similarity to an intuitive 0–1 display score."""
    calibrated = (sim - SIM_LOW) / (SIM_HIGH - SIM_LOW)
    return float(np.clip(calibrated, 0.0, 1.0))


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
        query_embedding = np.array(
            embedder.embed_query("software developer programmer")
        )

    # ── 2. Blend custom tags into the query if provided ────────────────────
    if request.custom_tags:
        tags_text = ", ".join(request.custom_tags)
        tags_embedding = np.array(embedder.embed_query(tags_text))
        # 60% user GitHub data, 40% custom tags
        query_embedding = query_embedding * 0.6 + tags_embedding * 0.4

    # ── 2.5. Process search query ─────────────────────────────────────────────
    queried_skills: list[str] = []  # recognised skills from the search query (lowercase keys)
    is_search = bool(request.search_query and request.search_query.strip())

    if is_search:
        raw_query = request.search_query.strip()

        # 1) Extract known skills for the reranking boost (the 'Bands')
        queried_skills = _extract_skills(raw_query)

        # 2) Embed the cleaned version of the FULL query for the initial retrieval.
        # This ensures that unknown skills (e.g. 'woodchipping') are still
        # part of the vector search, even if they aren't in our dictionary.
        stripped = _strip_intent_words(raw_query)
        embed_text = stripped if stripped else raw_query
        query_embedding = np.array(embedder.embed_query(embed_text))

    # Normalise so cosine distance stays meaningful
    norm = np.linalg.norm(query_embedding)
    if norm > 0:
        query_embedding = query_embedding / norm

    query_embedding_list = query_embedding.tolist()

    # ── 3. Run vector similarity search ────────────────────────────────────
    try:
        res = supabase.rpc(
            "match_github_chunks",
            {
                "query_embedding": query_embedding_list,
                "match_threshold": 0.0,
                "match_count": max(100, (request.top_k or 5) * 5),
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
        meta_res = type("R", (), {"data": []})(  # type: ignore[misc]
        )

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

        if uid not in username_map and meta.get("github_username"):
            username_map[uid] = meta["github_username"]

        if uid not in skills_map:
            skills_map[uid] = Counter()
        for lang in meta.get("languages", []):
            skills_map[uid][lang] += 1
        for topic in meta.get("topics", []):
            display_topic = topic.replace("-", " ").title()
            skills_map[uid][display_topic] += 1

        if uid not in total_stars_map:
            total_stars_map[uid] = 0
        total_stars_map[uid] += meta.get("stars", 0)

    # ── 6. Build final sorted results ──────────────────────────────────────
    results: list[MatchResult] = []

    for uid, info in user_best.items():
        top_skills = [lang for lang, _ in skills_map.get(uid, Counter()).most_common(20)]

        raw_sim = info["similarity"]

        # Calibrate the base cosine score to an intuitive display percentage
        sim = _calibrate(raw_sim)

        if is_search and queried_skills:
            # ── Multi-skill search: banded scoring ────────────────────────
            # match_ratio is the PRIMARY ranking key; cosine sim is a tiebreaker
            # within a band.  This guarantees a 5/5 match always beats a 4/5,
            # regardless of vector similarity or star count.

            # Normalise user languages for comparison (lowercase, no extra spaces)
            user_langs_lower = {l.lower().strip() for l in skills_map.get(uid, Counter()).keys()}
            # Also check canonical names from the skills dictionary
            user_langs_canonical = {
                _SKILLS_DICT.get(l_lower, l_lower).lower()
                for l_lower in user_langs_lower
            }
            user_langs_combined = user_langs_lower | user_langs_canonical

            matched_count = 0
            matched_display: list[str] = []

            for skill_key in queried_skills:
                canonical = _SKILLS_DICT.get(skill_key, skill_key).lower()
                if skill_key in user_langs_combined or canonical in user_langs_combined:
                    matched_count += 1
                    display_name = _SKILLS_DICT.get(skill_key, skill_key)
                    matched_display.append(display_name)

            total_queried = len(queried_skills)
            match_ratio = matched_count / total_queried if total_queried > 0 else 0.0
            calibrated = _calibrate(raw_sim)  # 0–1, used as tiebreaker only

            # Banded scoring: each band is 0.15 wide; cosine fills the top 0.05
            # of each band so bands never overlap.
            #   100%  → [0.95, 1.00)
            #   ≥ 80% → [0.80, 0.95)
            #   ≥ 60% → [0.65, 0.80)
            #   ≥ 40% → [0.50, 0.65)
            #   ≥ 20% → [0.35, 0.50)
            #   0%    → [0.00, 0.35)  (pure cosine, no match)
            if match_ratio == 1.0:
                sim = 0.95 + calibrated * 0.049   # 0.950 – 0.999
            elif match_ratio >= 0.8:
                sim = 0.80 + calibrated * 0.149   # 0.800 – 0.949
            elif match_ratio >= 0.6:
                sim = 0.65 + calibrated * 0.149   # 0.650 – 0.799
            elif match_ratio >= 0.4:
                sim = 0.50 + calibrated * 0.149   # 0.500 – 0.649
            elif match_ratio >= 0.2:
                sim = 0.35 + calibrated * 0.149   # 0.350 – 0.499
            else:
                # No matching skills at all – keep calibrated cosine but cap below
                # the lowest partial-match band so they never outrank real matches.
                sim = calibrated * 0.34            # 0.000 – 0.340

            # Surface matched skills at the top of the skills list
            for display in reversed(matched_display):
                display_norm = display.lower().strip()
                # Remove any existing entry with this name (case-insensitive)
                top_skills = [s for s in top_skills if s.lower().strip() != display_norm]
                top_skills.insert(0, display)
            top_skills = top_skills[:20]

        elif is_search and not queried_skills:
            # Concept / free-text search (no recognised skills) – keep calibrated sim
            pass

        # Small quality boost for highly starred devs (up to +0.02).
        # Intentionally tiny so it never crosses a band boundary.
        user_stars = total_stars_map.get(uid, 0)
        if user_stars > 0:
            star_boost = min(np.log1p(user_stars) * 0.002, 0.02)
            sim = min(sim + star_boost, 1.0)

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
