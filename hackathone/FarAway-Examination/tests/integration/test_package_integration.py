"""
Integration tests — Package Service (Module 02).

Tests the full pipeline using in-memory SQLite.
The Package and Question models use PostgreSQL UUID columns, so we use
a custom table creation approach for SQLite compatibility.
"""

from __future__ import annotations

import base64
import json
import uuid

import pytest
import pytest_asyncio
from sqlalchemy import Column, DateTime, String, Text, Boolean
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from server.app.services.distribution_service import DistributionService
from server.app.services.package_service import PackageService
from shared.crypto.aes import AESCipher
from shared.crypto.hashing import HashUtils
from shared.crypto.rsa import RSASigner


# ============================================================
# SQLite-compatible in-memory models
# ============================================================

class _TestBase(DeclarativeBase):
    pass


class SQLiteQuestion(_TestBase):
    """SQLite-compatible Question model (String IDs instead of PostgreSQL UUID)."""
    __tablename__ = "questions"

    id = Column(String(36), primary_key=True)
    subject = Column(String(100), nullable=False)
    difficulty = Column(String(20), nullable=False)
    encrypted_content = Column(Text, nullable=False)
    encryption_iv = Column(String(64), nullable=False)
    content_hash = Column(String(64), nullable=False)
    created_by = Column(String(255), nullable=False)
    is_deleted = Column(Boolean, default=False)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)


class SQLitePackage(_TestBase):
    """SQLite-compatible Package model."""
    __tablename__ = "packages"

    id = Column(String(36), primary_key=True)
    exam_id = Column(String(36), nullable=False)
    encrypted_payload = Column(Text, nullable=False)
    encryption_iv = Column(String(64), nullable=False)
    package_hash = Column(String(64), nullable=False)
    signature = Column(Text, nullable=False)
    variant_mapping = Column(Text, nullable=True)
    status = Column(String(50), default="generated")
    created_at = Column(DateTime)


# ============================================================
# Fixtures
# ============================================================


@pytest.fixture(scope="module")
def rsa_keys():
    return RSASigner.generate_key_pair()


@pytest.fixture(scope="module")
def center_keys():
    return RSASigner.generate_key_pair()


@pytest_asyncio.fixture
async def db_session():
    """Async in-memory SQLite session for integration tests."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
    )

    async with engine.begin() as conn:
        await conn.run_sync(_TestBase.metadata.drop_all)
        await conn.run_sync(_TestBase.metadata.create_all)

    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with session_factory() as session:
        yield session

    await engine.dispose()


async def _insert_question(session: AsyncSession) -> str:
    """Insert a SQLite-compatible question row and return its ID."""
    qid = str(uuid.uuid4())
    content = b"Q: What is photosynthesis?"
    aes_key = AESCipher.generate_key()
    ciphertext, nonce, tag = AESCipher.encrypt(content, aes_key)

    q = SQLiteQuestion(
        id=qid,
        subject="Biology",
        difficulty="medium",
        encrypted_content=base64.b64encode(ciphertext).decode(),
        encryption_iv=base64.b64encode(nonce).decode(),
        content_hash=HashUtils.sha256(content),
        created_by="test-admin",
        is_deleted=False,
    )
    session.add(q)
    await session.flush()
    return qid


async def _insert_package(
    session: AsyncSession,
    exam_id: str,
    private_key_pem: bytes,
    aes_key: bytes | None = None,
) -> SQLitePackage:
    """Insert a SQLite-compatible package row and return it."""
    if aes_key is None:
        aes_key = AESCipher.generate_key()

    manifest = json.dumps({"exam_id": exam_id, "question_ids": []}).encode()
    ciphertext, nonce, tag = AESCipher.encrypt(manifest, aes_key)

    encrypted_payload_b64 = base64.b64encode(ciphertext).decode()
    nonce_b64 = base64.b64encode(nonce).decode()
    tag_b64 = base64.b64encode(tag).decode()
    package_hash = HashUtils.sha256(ciphertext)
    sig = RSASigner.sign(package_hash.encode(), private_key_pem)

    key_storage = {
        "aes_key_b64": base64.b64encode(aes_key).decode(),
        "nonce_b64": nonce_b64,
        "tag_b64": tag_b64,
        "variant_mapping": {},
    }

    pkg = SQLitePackage(
        id=str(uuid.uuid4()),
        exam_id=exam_id,
        encrypted_payload=encrypted_payload_b64,
        encryption_iv=nonce_b64,
        package_hash=package_hash,
        signature=base64.b64encode(sig).decode(),
        variant_mapping=json.dumps(key_storage),
        status="generated",
    )
    session.add(pkg)
    await session.flush()
    return pkg


# ============================================================
# Core crypto pipeline (no DB models required)
# ============================================================

class TestCryptoPipelineIntegration:
    """Full crypto pipeline tests without DB dependency issues."""

    def test_aes_rsa_full_pipeline(self, rsa_keys, center_keys):
        """Full pipeline: AES encrypt → RSA sign → RSA wrap key → verify → unwrap → decrypt."""
        private_pem, public_pem = rsa_keys
        center_private_pem, center_public_pem = center_keys

        # 1. Generate AES key and encrypt manifest
        aes_key = AESCipher.generate_key()
        manifest = json.dumps({"exam_id": "exam-001", "questions": ["q1", "q2"]}).encode()
        ciphertext, nonce, tag = AESCipher.encrypt(manifest, aes_key)

        # 2. Compute hash and sign
        package_hash = HashUtils.sha256(ciphertext)
        signature = RSASigner.sign(package_hash.encode(), private_pem)

        # 3. Verify signature (center or anyone with public key)
        assert RSASigner.verify(package_hash.encode(), signature, public_pem) is True

        # 4. Wrap AES key for center
        wrapped_key = RSASigner.encrypt_key(aes_key, center_public_pem)

        # 5. Center unwraps AES key
        recovered_key = RSASigner.decrypt_key(wrapped_key, center_private_pem)
        assert recovered_key == aes_key

        # 6. Center decrypts the package
        plaintext = AESCipher.decrypt(ciphertext, recovered_key, nonce, tag)
        assert json.loads(plaintext)["exam_id"] == "exam-001"

    def test_tamper_detected_at_signature_level(self, rsa_keys):
        """Tampered payload is caught by RSA signature check."""
        private_pem, public_pem = rsa_keys
        aes_key = AESCipher.generate_key()
        manifest = b"exam manifest content"
        ciphertext, nonce, tag = AESCipher.encrypt(manifest, aes_key)
        package_hash = HashUtils.sha256(ciphertext)
        signature = RSASigner.sign(package_hash.encode(), private_pem)

        # Tamper the ciphertext
        tampered = bytes([ciphertext[0] ^ 0xFF]) + ciphertext[1:]
        tampered_hash = HashUtils.sha256(tampered)

        # Signature over original hash doesn't match tampered hash
        assert RSASigner.verify(tampered_hash.encode(), signature, public_pem) is False

    def test_tamper_detected_at_aes_level(self, rsa_keys):
        """Tampered payload is also caught by GCM auth tag."""
        from cryptography.exceptions import InvalidTag
        aes_key = AESCipher.generate_key()
        manifest = b"exam manifest content"
        ciphertext, nonce, tag = AESCipher.encrypt(manifest, aes_key)
        tampered = bytes([ciphertext[0] ^ 0xFF]) + ciphertext[1:]

        with pytest.raises(InvalidTag):
            AESCipher.decrypt(tampered, aes_key, nonce, tag)

    def test_nonce_uniqueness_across_packages(self):
        """100 package encryptions must produce unique nonces."""
        aes_key = AESCipher.generate_key()
        nonces = {AESCipher.encrypt(b"manifest", aes_key)[1] for _ in range(100)}
        assert len(nonces) == 100

    def test_different_centers_cannot_share_keys(self, center_keys):
        """Key wrapped for center A cannot be decrypted by center B."""
        center_a_private, center_a_public = center_keys
        center_b_private, center_b_public = RSASigner.generate_key_pair()

        aes_key = AESCipher.generate_key()
        wrapped_for_a = RSASigner.encrypt_key(aes_key, center_a_public)

        with pytest.raises(ValueError, match="RSA key decryption failed"):
            RSASigner.decrypt_key(wrapped_for_a, center_b_private)


# ============================================================
# PackageService unit-style integration (mocked DB)
# ============================================================

class TestPackageServiceWithMockDB:
    """PackageService integration tests using mock DB (avoids SQLite UUID issues)."""

    from unittest.mock import AsyncMock, MagicMock

    @pytest.mark.asyncio
    async def test_generate_and_verify_full_cycle(self, rsa_keys):
        """generate() → verify_signature() full cycle with real crypto."""
        from unittest.mock import AsyncMock, MagicMock

        private_pem, public_pem = rsa_keys

        # Setup mock DB
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        db = AsyncMock()
        db.add = MagicMock()
        db.flush = AsyncMock()
        db.execute = AsyncMock(return_value=mock_result)

        svc = PackageService(db)
        pkg = await svc.generate(exam_id="exam-cycle", private_key_pem=private_pem)

        # Now verify the signature using the package data
        sig_bytes = base64.b64decode(pkg.signature)
        valid = RSASigner.verify(pkg.package_hash.encode(), sig_bytes, public_pem)
        assert valid is True

    @pytest.mark.asyncio
    async def test_download_decrypt_cycle(self, rsa_keys):
        """generate() → download_payload() → AESCipher.decrypt() reads manifest."""
        from unittest.mock import AsyncMock, MagicMock

        private_pem, _ = rsa_keys
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_result.scalar_one_or_none.return_value = None  # Will be set dynamically

        db = AsyncMock()
        db.add = MagicMock()
        db.flush = AsyncMock()

        generated_pkg = None

        async def mock_execute(stmt):
            nonlocal generated_pkg
            r = MagicMock()
            if generated_pkg is None:
                # First call: question query
                r.scalars.return_value.all.return_value = []
            else:
                # Subsequent calls: package lookup
                r.scalar_one_or_none.return_value = generated_pkg
            return r

        db.execute = mock_execute

        svc = PackageService(db)
        generated_pkg = await svc.generate(exam_id="exam-download", private_key_pem=private_pem)

        payload_b64, iv_b64, tag_b64, pkg_hash = await svc.download_payload(generated_pkg.id)

        # Decrypt
        key_storage = json.loads(generated_pkg.variant_mapping)
        aes_key = base64.b64decode(key_storage["aes_key_b64"])
        ct = base64.b64decode(payload_b64)
        nonce = base64.b64decode(iv_b64)
        tag = base64.b64decode(tag_b64)

        plaintext = AESCipher.decrypt(ct, aes_key, nonce, tag)
        manifest = json.loads(plaintext)
        assert manifest["exam_id"] == "exam-download"

    @pytest.mark.asyncio
    async def test_key_release_unwrap_decrypt(self, rsa_keys, center_keys):
        """Full D-012 flow: generate → release_key → center unwraps → decrypts."""
        from unittest.mock import AsyncMock, MagicMock

        private_pem, _ = rsa_keys
        center_private_pem, center_public_pem = center_keys

        # Generate package
        mock_result_q = MagicMock()
        mock_result_q.scalars.return_value.all.return_value = []
        db = AsyncMock()
        db.add = MagicMock()
        db.flush = AsyncMock()
        db.execute = AsyncMock(return_value=mock_result_q)

        pkg_svc = PackageService(db)
        exam_id = str(uuid.uuid4())
        pkg = await pkg_svc.generate(exam_id=exam_id, private_key_pem=private_pem)

        # Setup mock for DistributionService (finds the package)
        mock_result_p = MagicMock()
        mock_result_p.scalar_one_or_none.return_value = pkg
        db2 = AsyncMock()
        db2.add = MagicMock()
        db2.flush = AsyncMock()
        db2.execute = AsyncMock(return_value=mock_result_p)

        dist_svc = DistributionService(db2)
        result = await dist_svc.release_key(
            exam_id=exam_id,
            center_public_key_pem=center_public_pem.decode(),
        )

        # Center unwraps the key
        wrapped_key = base64.b64decode(result["wrapped_key_b64"])
        aes_key = RSASigner.decrypt_key(wrapped_key, center_private_pem)

        # Decrypt the package
        ct = base64.b64decode(pkg.encrypted_payload)
        nonce = base64.b64decode(pkg.encryption_iv)
        key_storage = json.loads(pkg.variant_mapping)
        tag = base64.b64decode(key_storage["tag_b64"])

        plaintext = AESCipher.decrypt(ct, aes_key, nonce, tag)
        manifest = json.loads(plaintext)
        assert manifest["exam_id"] == exam_id
