"""
Redis singleton for the SkillFuze AI service.

Connection is established lazily the first time get_redis() is called.
If REDIS_URL is not set (e.g. local dev without Redis), all helpers
return None / no-op so callers never need to guard individually.

Upstash users: set REDIS_URL to the rediss:// URL shown on the
Upstash console ("Redis URL" field, NOT the REST URL).
"""

import json
import os
from typing import Any

_redis_client = None
_redis_attempted = False  # avoid re-trying after a failed init


def get_redis():
    """Return a connected Redis client, or None if unavailable."""
    global _redis_client, _redis_attempted

    if _redis_attempted:
        return _redis_client

    _redis_attempted = True
    url = os.environ.get("REDIS_URL")
    if not url:
        print("[Redis] REDIS_URL not set — caching disabled.")
        return None

    try:
        import redis as redis_lib  # type: ignore[import]

        _redis_client = redis_lib.from_url(
            url,
            decode_responses=True,   # strings, not bytes
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        # Verify connection
        _redis_client.ping()
        print("[Redis] Connected successfully.")
    except Exception as exc:
        print(f"[Redis] Connection failed — caching disabled. Reason: {exc}")
        _redis_client = None

    return _redis_client


# ── Typed helpers ─────────────────────────────────────────────────────────────

def cache_get(key: str) -> Any | None:
    """Return deserialized JSON value, or None on miss / error."""
    r = get_redis()
    if r is None:
        return None
    try:
        raw = r.get(key)
        return json.loads(raw) if raw is not None else None
    except Exception as exc:
        print(f"[Redis] cache_get({key!r}) error: {exc}")
        return None


def cache_set(key: str, value: Any, ttl: int) -> None:
    """Serialize value to JSON and store with TTL (seconds)."""
    r = get_redis()
    if r is None:
        return
    try:
        r.setex(key, ttl, json.dumps(value))
    except Exception as exc:
        print(f"[Redis] cache_set({key!r}) error: {exc}")


def cache_delete(key: str) -> None:
    """Delete a single key."""
    r = get_redis()
    if r is None:
        return
    try:
        r.delete(key)
    except Exception as exc:
        print(f"[Redis] cache_delete({key!r}) error: {exc}")


def cache_delete_pattern(pattern: str) -> None:
    """Delete all keys matching a glob pattern (uses SCAN, safe for production)."""
    r = get_redis()
    if r is None:
        return
    try:
        keys = list(r.scan_iter(pattern, count=100))
        if keys:
            r.delete(*keys)
    except Exception as exc:
        print(f"[Redis] cache_delete_pattern({pattern!r}) error: {exc}")
