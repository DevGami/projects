"""
Unit tests — PackageService (Module 02).

Tests package generation, signature verification, key wrapping, and download.
Uses mock DB session to test service logic in isolation.
"""

from __future__ import annotations

import base64
import json
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from server.app.services.package_service import PackageService
from shared.crypto.aes import AESCipher
from shared.crypto.hashing import HashUtils
from shared.crypto.rsa import RSASigner


@pytest.fixture(scope="module")
def rsa_keys():
    """RSA-2048 key pair for tests."""
    return RSASigner.generate_key_pair()


@pytest.fixture(scope="module")
def center_keys():
    """Center RSA key pair for key-wrapping tests."""
    return RSASigner.generate_key_pair()


def _make_db_with_questions(questions: list) -> AsyncMock:
    """Create mock DB that returns the given question list from execute()."""
    db = AsyncMock()
    db.add = MagicMock()
    db.flush = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = questions
    db.execute = AsyncMock(return_value=mock_result)
    return db


def _make_db_with_package(package) -> AsyncMock:
    """Create mock DB that returns the given package from scalar_one_or_none()."""
    db = AsyncMock()
    db.add = MagicMock()
    db.flush = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = package
    db.execute = AsyncMock(return_value=mock_result)
    return db


def _make_mock_question(qid: str | None = None) -> MagicMock:
    """Create a mock Question model instance."""
    q = MagicMock()
    q.id = qid or str(uuid.uuid4())
    q.content_hash = HashUtils.sha256(f"question-{q.id}".encode())
    q.is_deleted = False
    return q


def _make_mock_package(rsa_keys_pair) -> MagicMock:
    """Build a minimal Package-like mock with valid AES encryption + RSA signature."""
    private_pem, _ = rsa_keys_pair
    aes_key = AESCipher.generate_key()
    ciphertext, nonce, tag = AESCipher.encrypt(b"manifest data", aes_key)
    package_hash = HashUtils.sha256(ciphertext)
    sig = RSASigner.sign(package_hash.encode("utf-8"), private_pem)

    pkg = MagicMock()
    pkg.id = "pkg-001"
    pkg.package_hash = package_hash
    pkg.signature = base64.b64encode(sig).decode("utf-8")
    pkg.encrypted_payload = base64.b64encode(ciphertext).decode("utf-8")
    pkg.encryption_iv = base64.b64encode(nonce).decode("utf-8")
    key_storage = {
        "aes_key_b64": base64.b64encode(aes_key).decode("utf-8"),
        "nonce_b64": base64.b64encode(nonce).decode("utf-8"),
        "tag_b64": base64.b64encode(tag).decode("utf-8"),
        "variant_mapping": {},
    }
    pkg.variant_mapping = json.dumps(key_storage)
    return pkg


# ============================================================
# generate()
# ============================================================


class TestPackageGenerate:
    """Tests for PackageService.generate()."""

    @pytest.mark.asyncio
    async def test_generate_creates_package(self, rsa_keys):
        """generate() should return a Package with all required fields."""
        private_pem, _ = rsa_keys
        questions = [_make_mock_question() for _ in range(3)]
        db = _make_db_with_questions(questions)

        svc = PackageService(db)
        pkg = await svc.generate(exam_id="exam-001", private_key_pem=private_pem)

        assert pkg.exam_id == "exam-001"
        assert pkg.status == "generated"
        assert pkg.encrypted_payload is not None
        assert len(pkg.package_hash) == 64
        assert pkg.signature is not None
        assert pkg.encryption_iv is not None

    @pytest.mark.asyncio
    async def test_generate_package_hash_is_sha256_of_ciphertext(self, rsa_keys):
        """package_hash must equal SHA-256 of the encrypted payload bytes."""
        private_pem, _ = rsa_keys
        db = _make_db_with_questions([_make_mock_question()])

        svc = PackageService(db)
        pkg = await svc.generate(exam_id="exam-hash-test", private_key_pem=private_pem)

        ciphertext_bytes = base64.b64decode(pkg.encrypted_payload)
        expected_hash = HashUtils.sha256(ciphertext_bytes)
        assert pkg.package_hash == expected_hash

    @pytest.mark.asyncio
    async def test_generate_signature_is_verifiable(self, rsa_keys):
        """RSA signature must verify with matching public key."""
        private_pem, public_pem = rsa_keys
        db = _make_db_with_questions([_make_mock_question()])

        svc = PackageService(db)
        pkg = await svc.generate(exam_id="exam-sig-test", private_key_pem=private_pem)

        sig_bytes = base64.b64decode(pkg.signature)
        valid = RSASigner.verify(pkg.package_hash.encode("utf-8"), sig_bytes, public_pem)
        assert valid is True

    @pytest.mark.asyncio
    async def test_generate_with_no_questions(self, rsa_keys):
        """generate() should work even with no questions (demo edge case)."""
        private_pem, _ = rsa_keys
        db = _make_db_with_questions([])

        svc = PackageService(db)
        pkg = await svc.generate(exam_id="exam-empty", private_key_pem=private_pem)

        assert pkg.exam_id == "exam-empty"
        assert pkg.status == "generated"

    @pytest.mark.asyncio
    async def test_generate_unique_ids(self, rsa_keys):
        """Two generate() calls should produce different package IDs."""
        private_pem, _ = rsa_keys
        db = _make_db_with_questions([_make_mock_question()])

        svc = PackageService(db)
        pkg1 = await svc.generate(exam_id="exam-001", private_key_pem=private_pem)
        pkg2 = await svc.generate(exam_id="exam-001", private_key_pem=private_pem)
        assert pkg1.id != pkg2.id

    @pytest.mark.asyncio
    async def test_generate_different_ciphertext_each_time(self, rsa_keys):
        """Two packages for the same exam must have different ciphertexts (nonce uniqueness)."""
        private_pem, _ = rsa_keys
        db = _make_db_with_questions([_make_mock_question()])

        svc = PackageService(db)
        pkg1 = await svc.generate(exam_id="exam-001", private_key_pem=private_pem)
        pkg2 = await svc.generate(exam_id="exam-001", private_key_pem=private_pem)
        assert pkg1.encrypted_payload != pkg2.encrypted_payload


# ============================================================
# verify_signature()
# ============================================================


class TestVerifySignature:
    """Tests for PackageService.verify_signature()."""

    @pytest.mark.asyncio
    async def test_valid_signature_returns_true(self, rsa_keys):
        """verify_signature() should return True for a valid package."""
        _, public_pem = rsa_keys
        pkg = _make_mock_package(rsa_keys)
        db = _make_db_with_package(pkg)

        svc = PackageService(db)
        result = await svc.verify_signature("pkg-001", public_pem)
        assert result is True

    @pytest.mark.asyncio
    async def test_wrong_public_key_returns_false(self, rsa_keys, center_keys):
        """verify_signature() with wrong public key should return False."""
        _, center_public_pem = center_keys
        pkg = _make_mock_package(rsa_keys)
        db = _make_db_with_package(pkg)

        svc = PackageService(db)
        result = await svc.verify_signature("pkg-001", center_public_pem)
        assert result is False

    @pytest.mark.asyncio
    async def test_missing_package_raises_value_error(self, rsa_keys):
        """verify_signature() with unknown ID should raise ValueError."""
        _, public_pem = rsa_keys
        db = _make_db_with_package(None)

        svc = PackageService(db)
        with pytest.raises(ValueError, match="Package not found"):
            await svc.verify_signature("nonexistent", public_pem)


# ============================================================
# get_wrapped_key()
# ============================================================


class TestGetWrappedKey:
    """Tests for PackageService.get_wrapped_key() (D-012 support)."""

    @pytest.mark.asyncio
    async def test_wrapped_key_roundtrip(self, rsa_keys, center_keys):
        """AES key wrapped with center public key should unwrap to original."""
        center_private_pem, center_public_pem = center_keys

        aes_key = AESCipher.generate_key()
        ciphertext, nonce, tag = AESCipher.encrypt(b"manifest", aes_key)
        key_storage = {
            "aes_key_b64": base64.b64encode(aes_key).decode("utf-8"),
            "nonce_b64": base64.b64encode(nonce).decode("utf-8"),
            "tag_b64": base64.b64encode(tag).decode("utf-8"),
            "variant_mapping": {},
        }
        pkg = MagicMock()
        pkg.id = "pkg-wrap"
        pkg.variant_mapping = json.dumps(key_storage)

        db = _make_db_with_package(pkg)
        svc = PackageService(db)
        wrapped = await svc.get_wrapped_key("pkg-wrap", center_public_pem)

        unwrapped = RSASigner.decrypt_key(wrapped, center_private_pem)
        assert unwrapped == aes_key

    @pytest.mark.asyncio
    async def test_missing_package_raises_value_error(self, center_keys):
        """get_wrapped_key() with unknown ID should raise ValueError."""
        _, center_public_pem = center_keys
        db = _make_db_with_package(None)

        svc = PackageService(db)
        with pytest.raises(ValueError, match="Package not found"):
            await svc.get_wrapped_key("nonexistent", center_public_pem)


# ============================================================
# _build_manifest() helper
# ============================================================


class TestBuildManifest:
    """Tests for the manifest builder helper."""

    def test_manifest_contains_required_fields(self):
        """Manifest must contain exam_id, question_ids, content_hashes, variant_mapping."""
        q = _make_mock_question("q-001")
        manifest = PackageService._build_manifest("exam-1", [q], {"seat-1": "v-1"})

        assert manifest["exam_id"] == "exam-1"
        assert "q-001" in manifest["question_ids"]
        assert "q-001" in manifest["content_hashes"]
        assert manifest["variant_mapping"] == {"seat-1": "v-1"}
        assert "generated_at" in manifest
        assert "manifest_hash" in manifest

    def test_manifest_hash_is_sha256_64_chars(self):
        """manifest_hash must be a valid 64-char SHA-256 hex string."""
        q = _make_mock_question("q-fixed")
        manifest = PackageService._build_manifest("exam-x", [q], {})
        assert "manifest_hash" in manifest
        assert len(manifest["manifest_hash"]) == 64


# ============================================================
# DistributionService tests
# ============================================================

from server.app.services.distribution_service import DistributionService


class TestDistributionListPackages:
    """Tests for DistributionService.list_packages()."""

    @pytest.mark.asyncio
    async def test_list_packages_returns_list(self):
        """list_packages() should return a list of dicts."""
        pkg_mock = MagicMock()
        pkg_mock.id = "pkg-001"
        pkg_mock.exam_id = "exam-001"
        pkg_mock.status = "generated"
        pkg_mock.package_hash = "a" * 64
        pkg_mock.created_at = None

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [pkg_mock]
        db = AsyncMock()
        db.execute = AsyncMock(return_value=mock_result)

        svc = DistributionService(db)
        result = await svc.list_packages()

        assert len(result) == 1
        assert result[0]["package_id"] == "pkg-001"
        assert result[0]["status"] == "generated"

    @pytest.mark.asyncio
    async def test_list_packages_empty(self):
        """list_packages() with no packages returns empty list."""
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        db = AsyncMock()
        db.execute = AsyncMock(return_value=mock_result)

        svc = DistributionService(db)
        result = await svc.list_packages()
        assert result == []


class TestDistributionDeliveryStatus:
    """Tests for DistributionService.get_delivery_status()."""

    @pytest.mark.asyncio
    async def test_get_delivery_status_found(self):
        """get_delivery_status() returns dict for existing package."""
        pkg_mock = MagicMock()
        pkg_mock.id = "pkg-002"
        pkg_mock.exam_id = "exam-002"
        pkg_mock.status = "activated"
        pkg_mock.package_hash = "b" * 64
        pkg_mock.created_at = None

        db = _make_db_with_package(pkg_mock)
        svc = DistributionService(db)
        result = await svc.get_delivery_status("pkg-002")

        assert result["package_id"] == "pkg-002"
        assert result["status"] == "activated"

    @pytest.mark.asyncio
    async def test_get_delivery_status_not_found(self):
        """get_delivery_status() raises ValueError for missing package."""
        db = _make_db_with_package(None)
        svc = DistributionService(db)

        with pytest.raises(ValueError, match="Package not found"):
            await svc.get_delivery_status("nonexistent")

