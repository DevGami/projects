"""
Security tests — Module 03 Authentication.

Threat coverage:
  T-007: QR token replay attack (nonce reuse)
  T-008: Tampered QR token (forged candidate_id)
  T-009: Expired QR token
  T-010: Wrong RSA key used to sign/verify JWT
  T-011: RBAC bypass attempts
  T-012: Face spoofing (low similarity embedding)
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from server.app.services.face_verification_service import FaceVerificationService
from server.app.services.qr_token_service import QRTokenGenerator, QRTokenService
from shared.crypto.jwt_handler import JWTHandler
from shared.crypto.rsa import RSASigner


@pytest.fixture(scope="module")
def cloud_keys():
    return RSASigner.generate_key_pair()


@pytest.fixture(scope="module")
def edge_keys():
    return RSASigner.generate_key_pair()


def _db_nonce_not_used() -> AsyncMock:
    db = AsyncMock()
    db.add = MagicMock()
    db.flush = AsyncMock()
    r = MagicMock()
    r.scalar_one_or_none.return_value = None
    db.execute = AsyncMock(return_value=r)
    return db


def _db_nonce_used() -> AsyncMock:
    db = AsyncMock()
    r = MagicMock()
    r.scalar_one_or_none.return_value = MagicMock(id="used")
    db.execute = AsyncMock(return_value=r)
    return db


def _make_qr(cloud_keys_pair, candidate_id, exam_id, expired=False, nonce=None):
    private_pem, _ = cloud_keys_pair
    gen = QRTokenGenerator(private_pem)
    now = datetime.now(tz=timezone.utc)
    if expired:
        expires = now - timedelta(hours=1)
        issued = now - timedelta(hours=2)
    else:
        expires = now + timedelta(hours=1)
        issued = now
    return gen.generate(
        candidate_id=candidate_id,
        exam_id=exam_id,
        center_id=str(uuid.uuid4()),
        nonce=nonce or uuid.uuid4().hex,
        issued_at=issued,
        expires_at=expires,
    )


# ===========================================================================
# T-007: Replay Attack
# ===========================================================================


class TestT007ReplayAttack:
    """T-007: QR token replay — same nonce rejected second time."""

    @pytest.mark.asyncio
    async def test_same_qr_cannot_be_used_twice(self, cloud_keys):
        """First use: accepted. Second use: replay detected."""
        _, public_pem = cloud_keys
        nonce = uuid.uuid4().hex

        # First use: nonce not in DB
        db_fresh = _db_nonce_not_used()
        svc1 = QRTokenService(db_fresh, public_pem)
        await svc1._check_and_consume_nonce(nonce)
        db_fresh.add.assert_called_once()

        # Second use: nonce already in DB
        db_used = _db_nonce_used()
        svc2 = QRTokenService(db_used, public_pem)
        with pytest.raises(ValueError, match="replay"):
            await svc2._check_and_consume_nonce(nonce)

    @pytest.mark.asyncio
    async def test_different_nonces_both_accepted(self, cloud_keys):
        """Different nonces on separate tokens are each independently valid."""
        _, public_pem = cloud_keys
        for i in range(5):
            db = _db_nonce_not_used()
            svc = QRTokenService(db, public_pem)
            await svc._check_and_consume_nonce(f"nonce-{i:08d}-abcdefabcdef")
            db.add.assert_called_once()

    @pytest.mark.asyncio
    async def test_empty_nonce_rejected(self, cloud_keys):
        """Empty nonce must be rejected regardless of DB state."""
        _, public_pem = cloud_keys
        db = _db_nonce_not_used()
        svc = QRTokenService(db, public_pem)
        with pytest.raises(ValueError, match="missing or too short"):
            await svc._check_and_consume_nonce("")


# ===========================================================================
# T-008: Tampered QR Token
# ===========================================================================


class TestT008TamperedQRToken:
    """T-008: Any modification to QR payload must fail signature verification."""

    def test_tampered_candidate_id_detected(self, cloud_keys):
        """Changing candidate_id after signing must be detected."""
        _, public_pem = cloud_keys
        qr_json = _make_qr(cloud_keys, "legitimate-candidate", "exam-1")
        data = json.loads(qr_json)
        data["candidate_id"] = "attacker-candidate"

        svc = QRTokenService(MagicMock(), public_pem)
        with pytest.raises(ValueError, match="signature verification failed"):
            svc._verify_signature(data)

    def test_tampered_exam_id_detected(self, cloud_keys):
        """Changing exam_id after signing must be detected."""
        _, public_pem = cloud_keys
        qr_json = _make_qr(cloud_keys, "cand-1", "exam-original")
        data = json.loads(qr_json)
        data["exam_id"] = "exam-privileged"

        svc = QRTokenService(MagicMock(), public_pem)
        with pytest.raises(ValueError, match="signature verification failed"):
            svc._verify_signature(data)

    def test_tampered_center_id_detected(self, cloud_keys):
        """Changing center_id must fail verification."""
        _, public_pem = cloud_keys
        qr_json = _make_qr(cloud_keys, "cand-1", "exam-1")
        data = json.loads(qr_json)
        data["center_id"] = "attacker-center"

        svc = QRTokenService(MagicMock(), public_pem)
        with pytest.raises(ValueError, match="signature verification failed"):
            svc._verify_signature(data)

    def test_tampered_nonce_detected(self, cloud_keys):
        """Changing nonce must fail verification."""
        _, public_pem = cloud_keys
        qr_json = _make_qr(cloud_keys, "cand-1", "exam-1")
        data = json.loads(qr_json)
        data["nonce"] = "attacker-nonce-00000000"

        svc = QRTokenService(MagicMock(), public_pem)
        with pytest.raises(ValueError, match="signature verification failed"):
            svc._verify_signature(data)

    def test_truncated_signature_rejected(self, cloud_keys):
        """Truncated signature must fail."""
        _, public_pem = cloud_keys
        qr_json = _make_qr(cloud_keys, "cand-1", "exam-1")
        data = json.loads(qr_json)
        data["signature"] = data["signature"][:10]

        svc = QRTokenService(MagicMock(), public_pem)
        with pytest.raises(ValueError):
            svc._verify_signature(data)

    def test_forged_with_different_key_rejected(self, cloud_keys):
        """Token signed with attacker key must fail with cloud public key."""
        _, cloud_public = cloud_keys
        attacker_priv, _ = RSASigner.generate_key_pair()

        # Attacker generates a token with their own private key
        attacker_gen = QRTokenGenerator(attacker_priv)
        now = datetime.now(tz=timezone.utc)
        forged_qr = attacker_gen.generate(
            candidate_id="victim-candidate",
            exam_id="exam-1",
            center_id="center-1",
            nonce=uuid.uuid4().hex,
            issued_at=now,
            expires_at=now + timedelta(hours=1),
        )
        data = json.loads(forged_qr)

        # Verify against CLOUD public key → must fail
        svc = QRTokenService(MagicMock(), cloud_public)
        with pytest.raises(ValueError, match="signature verification failed"):
            svc._verify_signature(data)


# ===========================================================================
# T-009: Expired Token
# ===========================================================================


class TestT009ExpiredToken:
    """T-009: Expired QR tokens must be rejected."""

    def test_expired_qr_token_rejected(self, cloud_keys):
        """QR token with expires_at in the past must raise ValueError."""
        qr_json = _make_qr(cloud_keys, "cand-1", "exam-1", expired=True)
        data = json.loads(qr_json)
        with pytest.raises(ValueError, match="expired"):
            QRTokenService._check_expiry(data)

    def test_future_expiry_accepted(self, cloud_keys):
        """QR token expiring far in the future must not be rejected."""
        qr_json = _make_qr(cloud_keys, "cand-1", "exam-1", expired=False)
        data = json.loads(qr_json)
        QRTokenService._check_expiry(data)  # Should not raise

    def test_expired_edge_jwt_rejected(self, edge_keys):
        """Expired edge JWT must raise ExpiredSignatureError."""
        import jwt as pyjwt
        import time

        private_pem, public_pem = edge_keys
        token = JWTHandler.create_token(
            {"sub": "session-1", "candidate_id": "c1"},
            private_pem,
            expires_minutes=0,
        )
        time.sleep(1)  # Ensure expiry
        with pytest.raises(pyjwt.ExpiredSignatureError):
            JWTHandler.verify_token(token, public_pem)


# ===========================================================================
# T-010: Wrong RSA Key
# ===========================================================================


class TestT010WrongRSAKey:
    """T-010: JWT signed with wrong key must fail verification."""

    def test_jwt_wrong_public_key_rejected(self, edge_keys):
        """JWT verified with mismatched public key must raise error."""
        import jwt as pyjwt

        private_pem, _ = edge_keys
        _, wrong_public = RSASigner.generate_key_pair()

        token = JWTHandler.create_token({"sub": "s1"}, private_pem)
        with pytest.raises(pyjwt.exceptions.InvalidSignatureError):
            JWTHandler.verify_token(token, wrong_public)

    def test_jwt_with_edge_key_rejected_by_cloud_key(self):
        """JWT signed by edge key must not validate against cloud key."""
        import jwt as pyjwt

        edge_priv, _ = RSASigner.generate_key_pair()
        _, cloud_pub = RSASigner.generate_key_pair()

        token = JWTHandler.create_token({"sub": "s1"}, edge_priv)
        with pytest.raises(pyjwt.exceptions.InvalidSignatureError):
            JWTHandler.verify_token(token, cloud_pub)


# ===========================================================================
# T-011: RBAC Bypass
# ===========================================================================


class TestT011RBACBypass:
    """T-011: Role-based access control enforcement."""

    @pytest.mark.asyncio
    async def test_require_role_allows_correct_role(self, monkeypatch):
        """User with correct role passes require_role check."""
        from server.app.middleware.clerk_auth import require_role
        from server.app.config import settings

        monkeypatch.setattr(settings, "clerk_secret_key", "")  # Dev bypass

        mock_creds = MagicMock()
        mock_creds.credentials = "token"

        checker = require_role("admin", "expert")
        # Simulate claims from dev bypass (role=admin)
        result = await checker(claims={"role": "admin", "clerk_user_id": "dev"})
        assert result["role"] == "admin"

    @pytest.mark.asyncio
    async def test_require_role_blocks_wrong_role(self):
        """User with wrong role gets 403 from require_role."""
        from fastapi import HTTPException
        from server.app.middleware.clerk_auth import require_role

        checker = require_role("admin")
        with pytest.raises(HTTPException) as exc_info:
            await checker(claims={"role": "expert", "clerk_user_id": "user_123"})
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_require_role_blocks_no_role(self):
        """User with no role gets 403."""
        from fastapi import HTTPException
        from server.app.middleware.clerk_auth import require_role

        checker = require_role("admin", "expert")
        with pytest.raises(HTTPException) as exc_info:
            await checker(claims={"clerk_user_id": "user_123"})
        assert exc_info.value.status_code == 403


# ===========================================================================
# T-012: Face Spoofing
# ===========================================================================


class TestT012FaceSpoofing:
    """T-012: Low-similarity face embedding must not pass authentication."""

    def test_random_embedding_fails_high_threshold(self):
        """Random face embedding vs stored must fail at high threshold."""
        svc = FaceVerificationService(threshold=0.95)
        stored = FaceVerificationService.make_random_embedding()
        attacker = FaceVerificationService.make_random_embedding()
        passed, score = svc.compare_raw(stored, attacker)
        # Random vectors: cosine sim ≈ 0, should fail
        assert passed is False

    def test_zero_embedding_always_fails(self):
        """An all-zero embedding (adversarial) must never pass."""
        import numpy as np
        svc = FaceVerificationService(threshold=0.6)
        stored = FaceVerificationService.make_random_embedding()
        zero = np.zeros(512, dtype=np.float32)
        passed, score = svc.compare_raw(stored, zero)
        assert passed is False
        assert score == 0.0

    def test_opposite_embedding_fails(self):
        """Negated embedding (worst case) must fail."""
        svc = FaceVerificationService(threshold=0.0)  # Even at 0 threshold
        stored = FaceVerificationService.make_random_embedding()
        opposite = -stored
        passed, score = svc.compare_raw(stored, opposite)
        # Score = -1.0, threshold = 0.0 → still fails
        assert passed is False
        assert score < 0.0

    def test_high_threshold_requires_near_identical_embedding(self):
        """Threshold=0.99 requires near-identical embedding to pass."""
        svc = FaceVerificationService(threshold=0.99)
        stored = FaceVerificationService.make_random_embedding()
        # Add only tiny noise
        import numpy as np
        tiny_noise = np.random.randn(512).astype(np.float32) * 0.001
        close = stored + tiny_noise
        passed, score = svc.compare_raw(stored, close)
        # Should still pass (tiny perturbation)
        assert passed is True

        # Add moderate noise → should fail at 0.99
        moderate_noise = np.random.randn(512).astype(np.float32) * 0.5
        far = stored + moderate_noise
        passed_far, score_far = svc.compare_raw(stored, far)
        assert passed_far is False
