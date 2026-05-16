"""Unit tests for match.py helper functions.

These tests exercise _extract_skills, _strip_intent_words, and _calibrate
without requiring a live Supabase connection or embedder.
"""
import sys
import os

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from routers.match import _extract_skills, _strip_intent_words, _calibrate


class TestExtractSkills:
    def test_single_skill(self):
        assert "python" in _extract_skills("python")

    def test_multi_skill_comma_separated(self):
        skills = _extract_skills("python, css, html, javascript")
        assert "python" in skills
        assert "css" in skills
        assert "html" in skills
        assert "javascript" in skills

    def test_multi_skill_space_separated(self):
        skills = _extract_skills("python css html javascript")
        assert "python" in skills
        assert "css" in skills
        assert "html" in skills
        assert "javascript" in skills

    def test_natural_language_query(self):
        skills = _extract_skills("looking for someone with python")
        assert "python" in skills

    def test_phrase_skill_spring_boot(self):
        skills = _extract_skills("spring boot developer")
        assert "spring boot" in skills
        # "spring" alone should NOT also appear since "spring boot" consumed it
        assert "spring" not in skills

    def test_no_known_skills(self):
        skills = _extract_skills("I need a great engineer")
        assert skills == []

    def test_alias_nodejs(self):
        skills = _extract_skills("node.js")
        assert "node.js" in skills

    def test_alias_reactjs(self):
        skills = _extract_skills("reactjs")
        assert "reactjs" in skills


class TestStripIntentWords:
    def test_looking_for(self):
        result = _strip_intent_words("looking for someone with python")
        assert "python" in result.lower()
        assert "looking" not in result.lower()

    def test_find_me(self):
        result = _strip_intent_words("find me a developer who knows rust")
        assert "rust" in result.lower()

    def test_passthrough_plain_skills(self):
        result = _strip_intent_words("python css html")
        assert "python" in result.lower()
        assert "css" in result.lower()
        assert "html" in result.lower()


class TestCalibrate:
    def test_below_low_clamps_to_zero(self):
        assert _calibrate(0.0) == 0.0
        assert _calibrate(0.10) == 0.0

    def test_above_high_clamps_to_one(self):
        assert _calibrate(0.80) == 1.0
        assert _calibrate(1.00) == 1.0

    def test_midpoint(self):
        # SIM_LOW=0.20, SIM_HIGH=0.75 → midpoint 0.475 → 0.5
        result = _calibrate(0.475)
        assert abs(result - 0.5) < 0.01

    def test_high_end(self):
        result = _calibrate(0.75)
        assert result == pytest.approx(1.0)

    def test_low_end(self):
        result = _calibrate(0.20)
        assert result == pytest.approx(0.0)
