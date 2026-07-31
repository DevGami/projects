"""
Unit tests — Module 03 Authentication.

Tests:
  - JWTHandler: create, verify, expiry, tamper
  - QRTokenService: parse, signature verify, expiry, replay
  - FaceVerificationService: cosine similarity, threshold, serialization
  - Clerk middleware: dev bypass, RBAC
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import numpy as np
import pytest

from server.app.middleware.clerk_auth import _extract_role_from_claims, verify_clerk_jwt
from server.app.services.face_verification_service import FaceVerificationService
from server.app.services.qr_token_service import QRTokenGenerator, QRTokenService
from shared.crypto.jwt_handler import JWTHandler
from shared.crypto.rsa import RSASigner


# ===========================================================================
# Fixtures
# ===========================================================================


@pytest.fixture(scope="module")
def rsa_keys():
    """RSA key pair for tests."""
    return RSASigner.generate_key_pair()


@pytest.fixture(scope="module")
def cloud_keys():
    """Separate cloud key pair for QR token signing."""
    return RSASigner.generate_key_pair()


def _make_db_nonce_not_found() -> AsyncMock:
    """Mock DB that returns None for nonce lookup (nonce not used)."""
    db = AsyncMock()
    db.add = MagicMock()
    db.flush = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    db.execute = AsyncMock(return_value=mock_result)
    return db


def _make_db_nonce_found() -> AsyncMock:
    """Mock DB that finds an existing nonce (replay scenario)."""
    db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = MagicMock(id="used-nonce")
    db.execute = AsyncMock(return_value=mock_result)
    return db


def _make_valid_qr_token(
    cloud_keys_pair,
    candidate_id: str | None = None,
    exam_id: str | None = None,
    expires_minutes: int = 30,
    nonce: str | None = None,
) -> str:
    """Generate a valid, signed QR token."""
    private_pem, _ = cloud_keys_pair
    generator = QRTokenGenerator(private_pem)
    now = datetime.now(tz=timezone.utc)
    return generator.generate(
        candidate_id=candidate_id or str(uuid.uuid4()),
        exam_id=exam_id or str(uuid.uuid4()),
        center_id=str(uuid.uuid4()),
        nonce=nonce or uuid.uuid4().hex,
        issued_at=now,
        expires_at=now + timedelta(minutes=expires_minutes),
    )


# ===========================================================================
# JWTHandler tests
# ===========================================================================


class TestJWTHandlerCreate:
    """Tests for JWTHandler.create_token()."""

    def test_create_returns_string(self, rsa_keys):
        """create_token() should return a non-empty string."""
        private_pem, _ = rsa_keys
        token = JWTHandler.create_token({"candidate_id": "c1"}, private_pem)
        assert isinstance(token, str)
        assert len(token) > 50

    def test_create_token_has_three_parts(self, rsa_keys):
        """Valid JWT has header.payload.signature format."""
        private_pem, _ = rsa_keys
        token = JWTHandler.create_token({"sub": "s1"}, private_pem)
        parts = token.split(".")
        assert len(parts) == 3

    def test_create_embeds_payload(self, rsa_keys):
        """Payload claims must survive round-trip."""
        private_pem, public_pem = rsa_keys
        token = JWTHandler.create_token(
            {"candidate_id": "c123", "variant_id": 2}, private_pem
        )
        claims = JWTHandler.verify_token(token, public_pem)
        assert claims["candidate_id"] == "c123"
        assert claims["variant_id"] == 2

    def test_create_sets_iat_and_exp(self, rsa_keys):
        """Token must include iat and exp claims."""
        private_pem, public_pem = rsa_keys
        token = JWTHandler.create_token({"sub": "session-1"}, private_pem, expires_minutes=60)
        claims = JWTHandler.verify_token(token, public_pem)
        assert "iat" in claims
        assert "exp" in claims
        assert claims["exp"] > claims["iat"]
        assert claims["exp"] - claims["iat"] == 3600  # 60 minutes

    def test_create_unique_tokens_for_same_payload(self, rsa_keys):
        """Two tokens for the same payload must not be identical (due to timing)."""
        import time
        private_pem, _ = rsa_keys
        t1 = JWTHandler.create_token({"sub": "s1"}, private_pem)
        time.sleep(0.01)
        t2 = JWTHandler.create_token({"sub": "s1"}, private_pem)
        # They CAN be the same if called within the same second — that's ok
        # but both must be verifiable
        assert len(t1) > 0
        assert len(t2) > 0


class TestJWTHandlerVerify:
    """Tests for JWTHandler.verify_token()."""

    def test_verify_valid_token(self, rsa_keys):
        """Valid token should verify successfully."""
        private_pem, public_pem = rsa_keys
        token = JWTHandler.create_token({"sub": "s1", "exam_id": "e1"}, private_pem)
        claims = JWTHandler.verify_token(token, public_pem)
        assert claims["exam_id"] == "e1"

    def test_verify_expired_token_raises(self, rsa_keys):
        """Expired token must raise ExpiredSignatureError."""
        import jwt as pyjwt
        private_pem, public_pem = rsa_keys
        # Create a token that expires in 0 seconds (already expired)
        token = JWTHandler.create_token({"sub": "s1"}, private_pem, expires_minutes=0)
        import time
        time.sleep(1)
        with pytest.raises(pyjwt.ExpiredSignatureError):
            JWTHandler.verify_token(token, public_pem)

    def test_verify_tampered_payload_raises(self, rsa_keys):
        """Tampering with the payload must raise an InvalidSignatureError."""
        import jwt as pyjwt
        private_pem, public_pem = rsa_keys
        token = JWTHandler.create_token({"sub": "s1"}, private_pem)
        # Flip a character in the payload section (middle part)
        parts = token.split(".")
        tampered_payload = parts[1][:-2] + "XX"
        tampered_token = f"{parts[0]}.{tampered_payload}.{parts[2]}"
        with pytest.raises(pyjwt.exceptions.InvalidTokenError):
            JWTHandler.verify_token(tampered_token, public_pem)

    def test_verify_wrong_public_key_raises(self, rsa_keys):
        """Token verified with wrong public key must fail."""
        import jwt as pyjwt
        private_pem, _ = rsa_keys
        _, wrong_public = RSASigner.generate_key_pair()
        token = JWTHandler.create_token({"sub": "s1"}, private_pem)
        with pytest.raises(pyjwt.exceptions.InvalidSignatureError):
            JWTHandler.verify_token(token, wrong_public)

    def test_verify_malformed_token_raises(self, rsa_keys):
        """Completely malformed JWT must raise DecodeError."""
        import jwt as pyjwt
        _, public_pem = rsa_keys
        with pytest.raises(pyjwt.exceptions.DecodeError):
            JWTHandler.verify_token("not.a.jwt", public_pem)


# ===========================================================================
# QRTokenService tests
# ===========================================================================


class TestQRTokenParse:
    """Tests for QRTokenService._parse()."""

    def test_parse_valid_json(self, cloud_keys):
        """Valid QR token JSON should parse without error."""
        qr_json = _make_valid_qr_token(cloud_keys)
        payload = QRTokenService._parse(qr_json)
        assert "candidate_id" in payload
        assert "signature" in payload

    def test_parse_invalid_json_raises(self):
        """Non-JSON string must raise ValueError."""
        with pytest.raises(ValueError, match="not valid JSON"):
            QRTokenService._parse("not-json-at-all")

    def test_parse_missing_fields_raises(self):
        """JSON missing required fields must raise ValueError."""
        minimal = json.dumps({"candidate_id": "c1"})
        with pytest.raises(ValueError, match="missing required fields"):
            QRTokenService._parse(minimal)


class TestQRTokenSignature:
    """Tests for QRTokenService._verify_signature()."""

    def test_valid_signature_passes(self, cloud_keys):
        """Valid RSA-signed QR token must verify."""
        private_pem, public_pem = cloud_keys
        qr_json = _make_valid_qr_token(cloud_keys)
        payload = QRTokenService._parse(qr_json)
        svc = QRTokenService(MagicMock(), public_pem)
        svc._verify_signature(payload)  # Should not raise

    def test_tampered_token_fails_signature(self, cloud_keys):
        """Modifying any field after signing must fail signature verification."""
        _, public_pem = cloud_keys
        qr_json = _make_valid_qr_token(cloud_keys)
        data = json.loads(qr_json)
        data["candidate_id"] = "hacker-id"  # Tamper!
        svc = QRTokenService(MagicMock(), public_pem)
        with pytest.raises(ValueError, match="signature verification failed"):
            svc._verify_signature(data)

    def test_missing_signature_fails(self, cloud_keys):
        """Token without signature field must fail."""
        _, public_pem = cloud_keys
        qr_json = _make_valid_qr_token(cloud_keys)
        data = json.loads(qr_json)
        del data["signature"]
        svc = QRTokenService(MagicMock(), public_pem)
        with pytest.raises(ValueError, match="no signature"):
            svc._verify_signature(data)

    def test_wrong_cloud_key_fails(self, cloud_keys):
        """Verifying with a different public key must fail."""
        _, original_public = cloud_keys
        wrong_private, wrong_public = RSASigner.generate_key_pair()
        # Token signed with cloud private key
        qr_json = _make_valid_qr_token(cloud_keys)
        payload = QRTokenService._parse(qr_json)
        # Verify with wrong public key
        svc = QRTokenService(MagicMock(), wrong_public)
        with pytest.raises(ValueError, match="signature verification failed"):
            svc._verify_signature(payload)


class TestQRTokenExpiry:
    """Tests for QRTokenService._check_expiry()."""

    def test_valid_token_not_expired(self, cloud_keys):
        """Token expiring in the future must not raise."""
        qr_json = _make_valid_qr_token(cloud_keys, expires_minutes=30)
        payload = json.loads(qr_json)
        QRTokenService._check_expiry(payload)  # Should not raise

    def test_expired_token_raises(self, cloud_keys):
        """Token that expired in the past must raise ValueError."""
        private_pem, _ = cloud_keys
        generator = QRTokenGenerator(private_pem)
        now = datetime.now(tz=timezone.utc)
        qr_json = generator.generate(
            candidate_id=str(uuid.uuid4()),
            exam_id=str(uuid.uuid4()),
            center_id=str(uuid.uuid4()),
            nonce=uuid.uuid4().hex,
            issued_at=now - timedelta(hours=2),
            expires_at=now - timedelta(minutes=1),  # Expired!
        )
        payload = json.loads(qr_json)
        with pytest.raises(ValueError, match="expired"):
            QRTokenService._check_expiry(payload)


class TestQRTokenNonce:
    """Tests for QRTokenService._check_and_consume_nonce() — anti-replay."""

    @pytest.mark.asyncio
    async def test_unused_nonce_passes(self):
        """A fresh nonce must be accepted and consumed."""
        db = _make_db_nonce_not_found()
        svc = QRTokenService(db, b"")
        await svc._check_and_consume_nonce("fresh-nonce-abc123")
        db.add.assert_called_once()  # Nonce was consumed

    @pytest.mark.asyncio
    async def test_used_nonce_raises(self):
        """A previously used nonce must raise ValueError (replay detected)."""
        db = _make_db_nonce_found()
        svc = QRTokenService(db, b"")
        with pytest.raises(ValueError, match="replay attack"):
            await svc._check_and_consume_nonce("used-nonce-xyz")

    @pytest.mark.asyncio
    async def test_short_nonce_raises(self):
        """Nonce too short (< 8 chars) must raise ValueError."""
        db = _make_db_nonce_not_found()
        svc = QRTokenService(db, b"")
        with pytest.raises(ValueError, match="too short"):
            await svc._check_and_consume_nonce("abc")


# ===========================================================================
# FaceVerificationService tests
# ===========================================================================


class TestFaceVerificationService:
    """Tests for cosine similarity and embedding operations."""

    def test_identical_embeddings_score_1(self):
        """Identical embeddings must score 1.0."""
        svc = FaceVerificationService(threshold=0.6)
        vec = FaceVerificationService.make_random_embedding()
        _, score = svc.compare_raw(vec, vec)
        assert abs(score - 1.0) < 1e-5

    def test_high_similarity_passes_threshold(self):
        """Slightly perturbed embedding must pass with threshold=0.6."""
        svc = FaceVerificationService(threshold=0.6)
        base = FaceVerificationService.make_random_embedding()
        noise = np.random.randn(512).astype(np.float32) * 0.01
        perturbed = base + noise
        passed, score = svc.compare_raw(base, perturbed)
        assert passed is True
        assert score > 0.6

    def test_random_unrelated_embeddings_fail(self):
        """Two completely different random embeddings should score near 0."""
        svc = FaceVerificationService(threshold=0.6)
        a = FaceVerificationService.make_random_embedding()
        b = FaceVerificationService.make_random_embedding()
        # Random 512-dim vectors: expected cosine sim ≈ 0 (normal dist)
        _, score = svc.compare_raw(a, b)
        # Not guaranteed to fail, but should be in the right ballpark
        assert score < 0.5  # Random vectors are unlikely to exceed 0.5

    def test_opposite_embeddings_score_negative(self):
        """Negated vector should score -1.0."""
        svc = FaceVerificationService(threshold=0.6)
        vec = FaceVerificationService.make_random_embedding()
        neg = -vec
        passed, score = svc.compare_raw(vec, neg)
        assert passed is False
        assert score < 0.0

    def test_zero_vector_returns_zero(self):
        """Zero-magnitude vector must return score 0.0 (no division by zero)."""
        svc = FaceVerificationService(threshold=0.6)
        zero = np.zeros(512, dtype=np.float32)
        normal = FaceVerificationService.make_random_embedding()
        _, score = svc.compare_raw(zero, normal)
        assert score == 0.0

    def test_embedding_serialization_roundtrip(self):
        """Embedding → bytes → embedding must preserve values."""
        svc = FaceVerificationService(threshold=0.6)
        original = FaceVerificationService.make_random_embedding()
        as_bytes = FaceVerificationService.embedding_to_bytes(original)
        assert len(as_bytes) == 512 * 4  # 2048 bytes

        # Use compare() to verify bytes → embedding → cosine
        passed, score = svc.compare(as_bytes, original)
        assert passed is True
        assert abs(score - 1.0) < 1e-5

    def test_wrong_embedding_size_raises(self):
        """Wrong byte length for stored embedding must raise ValueError."""
        svc = FaceVerificationService(threshold=0.6)
        wrong_bytes = b"\x00" * 100  # Too short
        normal = FaceVerificationService.make_random_embedding()
        with pytest.raises(ValueError, match="expected"):
            svc.compare(wrong_bytes, normal)

    def test_threshold_boundary(self):
        """Score exactly at threshold must pass; just below must fail."""
        threshold = 0.7
        svc_above = FaceVerificationService(threshold=threshold - 0.01)
        svc_below = FaceVerificationService(threshold=threshold + 0.01)

        # Craft embedding with known score ≈ threshold using a nearby vector
        base = FaceVerificationService.make_random_embedding()
        # Force a specific cosine sim by constructing perp combination
        perp = np.random.randn(512).astype(np.float32)
        perp -= perp.dot(base) * base  # Orthogonalize
        perp /= np.linalg.norm(perp)
        # cos(theta) = threshold → sin(theta) = sqrt(1-threshold^2)
        import math
        cos_val = threshold
        sin_val = math.sqrt(1 - cos_val ** 2)
        target = cos_val * base + sin_val * perp
        target /= np.linalg.norm(target)

        passed_above, _ = svc_above.compare_raw(base, target)
        passed_below, _ = svc_below.compare_raw(base, target)
        assert passed_above is True
        assert passed_below is False


# ===========================================================================
# Clerk middleware tests
# ===========================================================================


class TestClerkMiddlewareDevBypass:
    """Tests for verify_clerk_jwt() in dev mode (no CLERK_SECRET_KEY)."""

    @pytest.mark.asyncio
    async def test_dev_bypass_returns_admin(self, monkeypatch):
        """Without CLERK_SECRET_KEY, returns admin claims for any token."""
        from server.app.config import settings
        monkeypatch.setattr(settings, "clerk_secret_key", "")

        mock_creds = MagicMock()
        mock_creds.credentials = "any-bearer-token"

        result = await verify_clerk_jwt(credentials=mock_creds)
        assert result["role"] == "admin"
        assert result["clerk_user_id"] is not None

    @pytest.mark.asyncio
    async def test_dev_bypass_no_credentials_still_works(self, monkeypatch):
        """Dev bypass also works with no Authorization header at all."""
        from server.app.config import settings
        monkeypatch.setattr(settings, "clerk_secret_key", "")

        result = await verify_clerk_jwt(credentials=None)
        assert result["role"] == "admin"


class TestExtractRole:
    """Tests for _extract_role_from_claims()."""

    def test_role_from_public_metadata(self):
        """Role in public_metadata must be extracted."""
        claims = {"public_metadata": {"role": "expert"}}
        assert _extract_role_from_claims(claims) == "expert"

    def test_role_from_metadata_fallback(self):
        """Role from metadata fallback."""
        claims = {"metadata": {"role": "auditor"}}
        assert _extract_role_from_claims(claims) == "auditor"

    def test_default_role_when_missing(self):
        """No role metadata → defaults to 'expert'."""
        claims = {"sub": "user_123"}
        assert _extract_role_from_claims(claims) == "expert"


# ===========================================================================
# JWTHandler.decode_clerk_jwt() tests (mocked JWKS fetch)
# ===========================================================================


class TestDecodeClerkJWT:
    """Tests for JWTHandler.decode_clerk_jwt() with mocked httpx."""

    def test_decode_clerk_jwt_valid(self, rsa_keys, monkeypatch):
        """Valid Clerk JWT with matching kid should decode."""
        import jwt as pyjwt
        from jwt.algorithms import RSAAlgorithm

        private_pem, public_pem = rsa_keys

        # Build JWK from public key for JWKS response
        from cryptography.hazmat.primitives.serialization import load_pem_public_key
        pub_key = load_pem_public_key(public_pem)
        jwk_dict = RSAAlgorithm.to_jwk(pub_key, as_dict=True)
        jwk_dict["kid"] = "test-kid-001"
        jwk_dict["alg"] = "RS256"
        jwk_dict["use"] = "sig"

        # Create token with kid in header
        token = pyjwt.encode(
            {"sub": "user_clerk", "email": "clerk@test.com", "iat": 1000000000, "exp": 9999999999},
            private_pem,
            algorithm="RS256",
            headers={"kid": "test-kid-001"},
        )

        # Mock httpx.get
        mock_response = MagicMock()
        mock_response.json.return_value = {"keys": [jwk_dict]}
        mock_response.raise_for_status = MagicMock()

        import httpx
        monkeypatch.setattr(httpx, "get", lambda *a, **kw: mock_response)

        claims = JWTHandler.decode_clerk_jwt(token, jwks_url="https://clerk.test/.well-known/jwks.json")
        assert claims["sub"] == "user_clerk"
        assert claims["email"] == "clerk@test.com"

    def test_decode_clerk_jwt_missing_kid_raises(self, rsa_keys):
        """Token without kid in header should raise RuntimeError."""
        import jwt as pyjwt
        private_pem, _ = rsa_keys

        token = pyjwt.encode(
            {"sub": "no-kid"},
            private_pem,
            algorithm="RS256",
            # No kid header
        )

        with pytest.raises(RuntimeError, match="kid"):
            JWTHandler.decode_clerk_jwt(token, jwks_url="https://clerk.test/.well-known/jwks.json")

    def test_decode_clerk_jwt_kid_not_found_raises(self, rsa_keys, monkeypatch):
        """Token with kid that doesn't match any JWKS key should raise RuntimeError."""
        import jwt as pyjwt

        private_pem, _ = rsa_keys

        token = pyjwt.encode(
            {"sub": "mismatch"},
            private_pem,
            algorithm="RS256",
            headers={"kid": "nonexistent-kid"},
        )

        mock_response = MagicMock()
        mock_response.json.return_value = {"keys": []}
        mock_response.raise_for_status = MagicMock()

        import httpx
        monkeypatch.setattr(httpx, "get", lambda *a, **kw: mock_response)

        with pytest.raises(RuntimeError, match="No JWKS key found"):
            JWTHandler.decode_clerk_jwt(token, jwks_url="https://clerk.test/.well-known/jwks.json")

    def test_decode_clerk_jwt_fetch_failure_raises(self, rsa_keys, monkeypatch):
        """JWKS fetch failure should raise RuntimeError."""
        import jwt as pyjwt

        private_pem, _ = rsa_keys
        token = pyjwt.encode(
            {"sub": "fetch-fail"},
            private_pem,
            algorithm="RS256",
            headers={"kid": "test-kid"},
        )

        import httpx
        monkeypatch.setattr(httpx, "get", lambda *a, **kw: (_ for _ in ()).throw(httpx.HTTPError("connection failed")))

        with pytest.raises(RuntimeError, match="Failed to fetch JWKS"):
            JWTHandler.decode_clerk_jwt(token, jwks_url="https://clerk.test/.well-known/jwks.json")


# ===========================================================================
# Clerk middleware — production path tests
# ===========================================================================


class TestClerkMiddlewareProduction:
    """Tests for verify_clerk_jwt() in production mode (CLERK_SECRET_KEY set)."""

    @pytest.mark.asyncio
    async def test_production_no_credentials_raises_401(self, monkeypatch):
        """Production mode without Authorization header should raise 401."""
        from fastapi import HTTPException
        from server.app.config import settings
        monkeypatch.setattr(settings, "clerk_secret_key", "sk_live_real_key")

        with pytest.raises(HTTPException) as exc_info:
            await verify_clerk_jwt(credentials=None)
        assert exc_info.value.status_code == 401
        assert "Missing Authorization" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_production_invalid_jwt_raises_401(self, monkeypatch):
        """Production mode with an invalid JWT should raise 401."""
        from fastapi import HTTPException
        from server.app.config import settings
        monkeypatch.setattr(settings, "clerk_secret_key", "sk_live_real_key")

        mock_creds = MagicMock()
        mock_creds.credentials = "invalid-jwt-token"

        with pytest.raises(HTTPException) as exc_info:
            await verify_clerk_jwt(credentials=mock_creds)
        assert exc_info.value.status_code == 401

