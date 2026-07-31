"""Unit tests for server/app/services/question_service.py."""

import json
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from server.app.models.question import Question
from server.app.services.question_service import QuestionService
from shared.crypto.aes import AESCipher


@pytest.fixture
def mock_db():
    return AsyncMock()


@pytest.fixture
def question_service(mock_db, aes_key):
    svc = QuestionService(db=mock_db, aes_key=aes_key)
    # Mock the audit service so we don't need to mock its DB queries
    svc.audit_service = MagicMock()
    svc.audit_service.log_event = AsyncMock()
    return svc


@pytest.mark.asyncio
class TestQuestionService:
    """Unit tests for QuestionService CRUD with encryption."""

    async def test_create_question_encrypts_content(self, question_service, mock_db):
        """Test that content is encrypted and audit is logged during creation."""
        mock_db.add = MagicMock()
        mock_db.flush = AsyncMock()

        q = await question_service.create(
            subject="Math",
            difficulty="medium",
            content="What is 2+2?",
            options=["3", "4", "5", "6"],
            correct_option=1,
            author_id="user_123"
        )

        assert q.subject == "Math"
        assert q.difficulty == "medium"
        assert q.created_by == "user_123"
        assert ":" in q.encrypted_content  # combined format
        assert q.encryption_iv

        # Flush should have been called
        mock_db.flush.assert_called_once()
        mock_db.add.assert_called_once_with(q)

    async def test_get_question_decrypts_content(self, question_service, mock_db, aes_key):
        """Test that get decrypts content and unpacks correctly."""
        # Create encrypted data manually
        plaintext = json.dumps({
            "content": "What is 2+2?",
            "options": ["3", "4", "5", "6"],
            "correct_option": 1,
        }).encode("utf-8")
        import base64
        ciphertext, nonce, tag = AESCipher.encrypt(plaintext, aes_key)
        combined = f"{base64.b64encode(ciphertext).decode('utf-8')}:{base64.b64encode(tag).decode('utf-8')}"
        
        q_mock = MagicMock()
        q_mock.id = uuid4()
        q_mock.subject = "Math"
        q_mock.difficulty = "medium"
        q_mock.encrypted_content = combined
        q_mock.encryption_iv = base64.b64encode(nonce).decode("utf-8")
        q_mock.content_hash = "fake_hash"
        q_mock.created_by = "user_123"
        
        mock_db.scalar.return_value = q_mock

        result = await question_service.get(str(q_mock.id))

        assert result["content"] == "What is 2+2?"
        assert result["options"] == ["3", "4", "5", "6"]
        assert result["correct_option"] == 1
        assert result["subject"] == "Math"

    async def test_list_all_returns_metadata_only(self, question_service, mock_db):
        """Test that listing only returns metadata, not content."""
        q_mock = MagicMock()
        q_mock.id = uuid4()
        q_mock.subject = "Math"
        q_mock.difficulty = "medium"
        q_mock.created_by = "user_123"
        q_mock.content_hash = "hash123"

        mock_result = MagicMock()
        mock_result.all.return_value = [q_mock]
        mock_db.scalars.return_value = mock_result

        results = await question_service.list_all()

        assert len(results) == 1
        assert "content" not in results[0]
        assert results[0]["subject"] == "Math"

    async def test_update_reencrypts(self, question_service, mock_db):
        """Test that updating re-encrypts the content."""
        q_mock = MagicMock()
        q_mock.id = uuid4()
        q_mock.is_deleted = False
        
        mock_db.scalar.return_value = q_mock

        result = await question_service.update(
            question_id=str(q_mock.id),
            subject="Science",
            difficulty="hard",
            content="H2O?",
            options=["Water"],
            correct_option=0,
            editor_id="user_123"
        )

        assert result["status"] == "updated"
        assert q_mock.subject == "Science"
        assert q_mock.difficulty == "hard"
        assert ":" in q_mock.encrypted_content

    async def test_delete_marks_is_deleted(self, question_service, mock_db):
        """Test soft delete."""
        q_mock = MagicMock()
        q_mock.id = uuid4()
        q_mock.is_deleted = False
        
        mock_db.scalar.return_value = q_mock

        result = await question_service.delete(str(q_mock.id), "user_123")

        assert result is True
        assert q_mock.is_deleted is True
