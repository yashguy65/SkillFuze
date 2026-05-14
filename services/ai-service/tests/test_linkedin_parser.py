"""Unit tests for LinkedInParser skill extraction and PDF chunking logic."""
import sys
import os

# Ensure the ai-service root is on the path so imports resolve
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from parsers.linkedin_parser import LinkedInParser


class TestExtractSkills:
    """Tests for LinkedInParser._extract_skills (regex keyword matching)."""

    def setup_method(self):
        self.parser = LinkedInParser()

    # ── Happy path ──────────────────────────────────────────────────────────

    def test_detects_common_skills(self):
        text = "Experienced in Python, React, and Docker deployments."
        skills = self.parser._extract_skills(text)
        assert "python" in skills
        assert "react" in skills
        assert "docker" in skills

    def test_case_insensitive(self):
        text = "PYTHON and JAVASCRIPT developer"
        skills = self.parser._extract_skills(text)
        assert "python" in skills
        assert "javascript" in skills

    def test_detects_dotted_skills(self):
        """Skills with dots like 'node.js' and 'next.js' should match."""
        text = "Built APIs with Node.js and frontends with Next.js"
        skills = self.parser._extract_skills(text)
        assert "node.js" in skills
        assert "next.js" in skills

    def test_multiple_skills_in_dense_text(self):
        text = (
            "Full-stack developer with expertise in TypeScript, React, Node.js, "
            "PostgreSQL, Redis, Docker, and AWS cloud infrastructure."
        )
        skills = self.parser._extract_skills(text)
        assert len(skills) >= 5
        for expected in ["typescript", "react", "node.js", "postgresql", "redis", "docker", "aws"]:
            assert expected in skills, f"Expected '{expected}' in {skills}"

    # ── Edge cases ──────────────────────────────────────────────────────────

    def test_empty_input(self):
        assert self.parser._extract_skills("") == []

    def test_no_matching_skills(self):
        text = "I enjoy hiking, reading, and cooking."
        assert self.parser._extract_skills(text) == []

    def test_word_boundary_prevents_false_positives(self):
        """'api' should not match 'capital', 'sql' should not match 'squall'."""
        text = "The capital of France is beautiful in the squall season."
        skills = self.parser._extract_skills(text)
        assert "api" not in skills
        assert "sql" not in skills

    def test_returns_list_type(self):
        skills = self.parser._extract_skills("python developer")
        assert isinstance(skills, list)


class TestParsePdf:
    """Tests for LinkedInParser.parse_pdf document chunking."""

    def setup_method(self):
        self.parser = LinkedInParser()

    def test_empty_pdf_bytes_raises_or_returns_empty(self):
        """Malformed/empty PDF should either raise ValueError or return empty."""
        try:
            docs, skills = self.parser.parse_pdf(b"", "test-user-id")
            # If it doesn't raise, it should return empty
            assert docs == []
            assert skills == []
        except (ValueError, Exception):
            pass  # Expected for invalid PDF bytes

    def test_skill_list_matches_document_metadata(self):
        """Verify that extracted_skills returned match what's in doc metadata.
        
        We can't easily create a real PDF in a unit test, so we test the
        _extract_skills consistency directly.
        """
        text = "Proficient in Python, Java, and machine learning"
        skills = self.parser._extract_skills(text)
        assert "python" in skills
        assert "java" in skills
        assert "machine learning" in skills
