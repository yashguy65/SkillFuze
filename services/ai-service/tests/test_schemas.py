"""Unit tests for Pydantic v2 request/response schemas.

Ensures all schemas validate correctly and reject invalid input,
catching breaking changes before they reach production.
"""
import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from pydantic import ValidationError
from schemas.ingest import GitHubIngestRequest, IngestResponse
from schemas.match import MatchRequest, MatchResponse, MatchResult
from schemas.persona import PersonaRequest, PersonaResponse
from schemas.tags import TagsIngestRequest, TagsIngestResponse


# ── GitHubIngestRequest ─────────────────────────────────────────────────────

class TestGitHubIngestRequest:
    def test_valid_request(self):
        req = GitHubIngestRequest(user_id="abc-123", github_username="octocat")
        assert req.user_id == "abc-123"
        assert req.github_username == "octocat"
        assert req.token is None

    def test_with_optional_token(self):
        req = GitHubIngestRequest(
            user_id="abc", github_username="user", token="ghp_xxx"
        )
        assert req.token == "ghp_xxx"

    def test_missing_required_field(self):
        with pytest.raises(ValidationError):
            GitHubIngestRequest(user_id="abc")  # missing github_username

    def test_missing_user_id(self):
        with pytest.raises(ValidationError):
            GitHubIngestRequest(github_username="user")  # missing user_id


# ── IngestResponse ──────────────────────────────────────────────────────────

class TestIngestResponse:
    def test_valid_response(self):
        resp = IngestResponse(chunks_stored=5)
        assert resp.chunks_stored == 5
        assert resp.extracted_tags is None

    def test_with_tags(self):
        resp = IngestResponse(chunks_stored=3, extracted_tags=["python", "react"])
        assert resp.extracted_tags == ["python", "react"]

    def test_missing_chunks_stored(self):
        with pytest.raises(ValidationError):
            IngestResponse()


# ── MatchRequest ────────────────────────────────────────────────────────────

class TestMatchRequest:
    def test_minimal_request(self):
        req = MatchRequest(user_id="user-1")
        assert req.user_id == "user-1"
        assert req.top_k == 5  # default
        assert req.custom_tags is None
        assert req.search_query is None

    def test_full_request(self):
        req = MatchRequest(
            user_id="u1",
            top_k=10,
            custom_tags=["rust", "go"],
            search_query="backend developer",
        )
        assert req.top_k == 10
        assert req.custom_tags == ["rust", "go"]
        assert req.search_query == "backend developer"

    def test_missing_user_id(self):
        with pytest.raises(ValidationError):
            MatchRequest()


# ── MatchResult / MatchResponse ─────────────────────────────────────────────

class TestMatchResult:
    def test_valid_result(self):
        r = MatchResult(user_id="u2", similarity=0.87)
        assert r.github_username == ""  # default
        assert r.skills == []  # default

    def test_full_result(self):
        r = MatchResult(
            user_id="u2",
            similarity=0.95,
            github_username="dev123",
            skills=["python", "react"],
        )
        assert r.github_username == "dev123"

class TestMatchResponse:
    def test_empty_matches(self):
        resp = MatchResponse(matches=[])
        assert resp.matches == []

    def test_with_results(self):
        resp = MatchResponse(
            matches=[MatchResult(user_id="u1", similarity=0.9)]
        )
        assert len(resp.matches) == 1


# ── PersonaRequest / PersonaResponse ────────────────────────────────────────

class TestPersonaSchemas:
    def test_request(self):
        req = PersonaRequest(user_id="p-user")
        assert req.user_id == "p-user"

    def test_response(self):
        resp = PersonaResponse(
            summary="Test summary",
            role="Frontend Developer",
            skills=["python"],
            highlights=["Active in 5+ repos"],
            embedding=[0.1] * 384,
        )
        assert resp.role == "Frontend Developer"
        assert len(resp.embedding) == 384

    def test_request_missing_user_id(self):
        with pytest.raises(ValidationError):
            PersonaRequest()


# ── TagsIngestRequest / TagsIngestResponse ──────────────────────────────────

class TestTagsSchemas:
    def test_request(self):
        req = TagsIngestRequest(user_id="t-user", tags=["react", "next.js"])
        assert req.tags == ["react", "next.js"]

    def test_response(self):
        resp = TagsIngestResponse(success=True, chunks_stored=1)
        assert resp.success is True

    def test_request_missing_tags(self):
        with pytest.raises(ValidationError):
            TagsIngestRequest(user_id="t-user")

    def test_empty_tags_list_is_valid(self):
        req = TagsIngestRequest(user_id="t-user", tags=[])
        assert req.tags == []
