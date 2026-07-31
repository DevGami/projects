"""Integration tests for Question Cloud API endpoints."""

import pytest
from fastapi.testclient import TestClient

from server.app.main import app
from server.app.middleware.clerk_auth import require_role
from server.app.api.cloud.questions import get_question_service

client = TestClient(app)

# Mock auth dependency
async def mock_require_role():
    return {"clerk_user_id": "test_admin", "role": "admin"}


class MockQuestionService:
    async def create(self, subject, difficulty, content, options, correct_option, author_id):
        from unittest.mock import MagicMock
        from uuid import uuid4
        q = MagicMock()
        q.id = uuid4()
        return q

    async def list_all(self, page, page_size):
        return [
            {
                "id": "q-abc123",
                "subject": "Math",
                "difficulty": "easy",
                "created_by": "test_admin",
                "content_hash": "hash123",
                "created_at": "2026-06-12T00:00:00Z",
                "updated_at": "2026-06-12T00:00:00Z",
            }
        ]

    async def get(self, question_id):
        return {
            "id": question_id,
            "subject": "Math",
            "content": "2+2?",
            "options": ["3", "4", "5", "6"],   # list form internally
            "correct_option": 1,                # int internally
            "difficulty": "easy",
            "content_hash": "hash123",
            "created_by": "test_admin",
        }

    async def update(self, **kwargs):
        return {"id": kwargs["question_id"], "status": "updated"}

    async def delete(self, question_id, deleter_id):
        return True


# Override dependencies
app.dependency_overrides[require_role("admin", "expert")] = mock_require_role
app.dependency_overrides[require_role("admin")] = mock_require_role
app.dependency_overrides[get_question_service] = lambda: MockQuestionService()


# ─── New schema: options as {A,B,C,D} dict, correct_option as letter ──────────

VALID_CREATE_BODY = {
    "subject": "Math",
    "difficulty": "medium",
    "content": "What is 2+2?",
    "options": {"A": "3", "B": "4", "C": "5", "D": "6"},
    "correct_option": "B",
}

VALID_UPDATE_BODY = {
    "subject": "Science",
    "difficulty": "hard",
    "content": "Chemical formula for water?",
    "options": {"A": "H2O", "B": "CO2", "C": "O2", "D": "N2"},
    "correct_option": "A",
}


def test_create_question():
    response = client.post("/api/v1/questions/", json=VALID_CREATE_BODY)
    assert response.status_code == 201
    body = response.json()
    assert "id" in body
    assert body["status"] == "created"


def test_list_questions():
    response = client.get("/api/v1/questions/")
    assert response.status_code == 200
    body = response.json()
    # Must return { items, total, page, page_size }
    assert "items" in body
    assert "total" in body
    assert isinstance(body["items"], list)
    assert len(body["items"]) == 1
    # Each item must have is_encrypted field
    assert "is_encrypted" in body["items"][0]


def test_get_question():
    response = client.get("/api/v1/questions/q-abc123")
    assert response.status_code == 200
    body = response.json()
    assert body["subject"] == "Math"
    # Options must be returned as {A,B,C,D} dict
    assert isinstance(body["options"], dict)
    assert "A" in body["options"]
    # correct_option must be a letter
    assert body["correct_option"] in ("A", "B", "C", "D")


def test_update_question():
    response = client.put("/api/v1/questions/q-abc123", json=VALID_UPDATE_BODY)
    assert response.status_code == 200
    assert response.json()["status"] == "updated"


def test_delete_question():
    response = client.delete("/api/v1/questions/q-abc123")
    assert response.status_code == 200
    assert response.json()["status"] == "deleted"


def test_create_question_invalid_correct_option():
    """correct_option must be A/B/C/D — any other value should be rejected."""
    body = VALID_CREATE_BODY.copy()
    body["correct_option"] = "E"
    response = client.post("/api/v1/questions/", json=body)
    assert response.status_code == 422


def test_create_question_missing_option():
    """options must have all of A,B,C,D — missing key should fail validation."""
    body = VALID_CREATE_BODY.copy()
    body["options"] = {"A": "3", "B": "4"}  # missing C, D
    response = client.post("/api/v1/questions/", json=body)
    assert response.status_code == 422
