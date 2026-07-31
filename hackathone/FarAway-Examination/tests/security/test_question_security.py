"""Security tests for Question Pool encryption."""

import base64
import json
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from server.app.services.question_service import QuestionService
from shared.crypto.aes import AESCipher


@pytest.fixture
def mock_db():
    return AsyncMock()


@pytest.fixture
def question_service(mock_db, aes_key):
    return QuestionService(db=mock_db, aes_key=aes_key)


@pytest.mark.asyncio
class TestQuestionSecurity:
    """Security verification for Module 01 (Question Pool)."""

    async def test_tampered_ciphertext_fails_decryption(self, question_service, mock_db, aes_key):
        """T-003: Tampering with encrypted content must fail authentication tag check."""
        plaintext = json.dumps({"content": "test"}).encode("utf-8")
        ciphertext, nonce, tag = AESCipher.encrypt(plaintext, aes_key)
        
        # Tamper with the ciphertext (flip a bit)
        tampered_cipher = bytearray(ciphertext)
        if len(tampered_cipher) > 0:
            tampered_cipher[0] ^= 0xFF
            
        combined = f"{base64.b64encode(tampered_cipher).decode('utf-8')}:{base64.b64encode(tag).decode('utf-8')}"
        
        q_mock = MagicMock()
        q_mock.id = uuid4()
        q_mock.encrypted_content = combined
        q_mock.encryption_iv = base64.b64encode(nonce).decode("utf-8")
        q_mock.is_deleted = False
        
        mock_db.scalar.return_value = q_mock

        with pytest.raises(Exception):  # Cryptography raises InvalidTag
            await question_service.get(str(q_mock.id))

    async def test_tampered_tag_fails_decryption(self, question_service, mock_db, aes_key):
        """T-004: Tampering with the auth tag must fail decryption."""
        plaintext = json.dumps({"content": "test"}).encode("utf-8")
        ciphertext, nonce, tag = AESCipher.encrypt(plaintext, aes_key)
        
        # Tamper with tag
        tampered_tag = bytearray(tag)
        tampered_tag[0] ^= 0xFF
            
        combined = f"{base64.b64encode(ciphertext).decode('utf-8')}:{base64.b64encode(tampered_tag).decode('utf-8')}"
        
        q_mock = MagicMock()
        q_mock.id = uuid4()
        q_mock.encrypted_content = combined
        q_mock.encryption_iv = base64.b64encode(nonce).decode("utf-8")
        q_mock.is_deleted = False
        
        mock_db.scalar.return_value = q_mock

        with pytest.raises(Exception):
            await question_service.get(str(q_mock.id))
