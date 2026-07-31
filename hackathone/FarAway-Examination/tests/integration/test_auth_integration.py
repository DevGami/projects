"""
Integration tests — Module 03 Authentication.

Tests the full candidate auth pipeline with mock DB:
  - Valid QR + face → session created
  - Valid QR + no face → QR-only session
  - Valid QR + face fail → 401
  - Supervisor override → session + audit log
  - Clerk users API: /users/me, /users/sync
"""

from __future__ import annotations

import base64
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from server.app.services.auth_service import AuthService
from server.app.services.face_verification_service import FaceVerificationService
from server.app.services.qr_token_service import QRTokenGenerator
from shared.crypto.jwt_handler import JWTHandler
from shared.crypto.rsa import RSASigner


# ===========================================================================
# Fixtures
# ===========================================================================


@pytest.fixture(scope="module")
def cloud_keys():
    """Cloud RSA key pair for QR token signing."""
    return RSASigner.generate_key_pair()


@pytest.fixture(scope="module")
def edge_keys():
    """Edge RSA key pair for session JWT signing."""
    return RSASigner.generate_key_pair()


def _make_candidate(
    candidate_id: str | None = None,
    exam_id: str | None = None,
    embedding: bytes | None = None,
    seat: str | None = "A1",
) -> MagicMock:
    """Create a mock Candidate ORM object."""
    c = MagicMock()
    c.id = candidate_id or str(uuid.uuid4())
    c.exam_id = exam_id or str(uuid.uuid4())
    c.photo_embedding = embedding
    c.seat_number = seat
    return c


def _make_qr_token(
    cloud_keys_pair,
    candidate_id: str,
    exam_id: str,
    expired: bool = False,
    nonce: str | None = None,
) -> str:
    """Generate a valid signed QR token."""
    private_pem, _ = cloud_keys_pair
    gen = QRTokenGenerator(private_pem)
    now = datetime.now(tz=timezone.utc)
    if expired:
        expires_at = now - timedelta(minutes=5)
        issued_at = now - timedelta(hours=1)
    else:
        issued_at = now
        expires_at = now + timedelta(hours=1)
    return gen.generate(
        candidate_id=candidate_id,
        exam_id=exam_id,
        center_id=str(uuid.uuid4()),
        nonce=nonce or uuid.uuid4().hex,
        issued_at=issued_at,
        expires_at=expires_at,
    )


def _make_auth_db(candidate: MagicMock, cloud_keys_pair) -> tuple[AsyncMock, bytes]:
    """
    Build a mock DB and patch settings for auth integration tests.
    Returns (db, cloud_public_key_pem).
    """
    _, cloud_public_pem = cloud_keys_pair
    db = AsyncMock()
    db.add = MagicMock()
    db.flush = AsyncMock()

    call_count = [0]

    async def mock_execute(stmt):
        r = MagicMock()
        call_count[0] += 1
        idx = call_count[0]
        if idx == 1:
            # First call: nonce lookup → None (not used)
            r.scalar_one_or_none.return_value = None
        elif idx == 2:
            # Second call: candidate lookup → candidate
            r.scalar_one_or_none.return_value = candidate
        elif idx == 3:
            # Audit: count of existing events (for sequence number)
            r.scalar.return_value = 0
            r.scalar_one_or_none.return_value = None
        elif idx == 4:
            # Audit: previous event hash lookup
            r.scalar_one_or_none.return_value = None  # No previous event → genesis
        else:
            r.scalar_one_or_none.return_value = None
            r.scalar.return_value = 0
            r.scalars.return_value.all.return_value = []
        return r

    db.execute = mock_execute
    return db, cloud_public_pem


# ===========================================================================
# Full Auth Flow (QR only)
# ===========================================================================


class TestAuthFlowQROnly:
    """Integration: QR-only authentication (no face image)."""

    @pytest.mark.asyncio
    async def test_qr_only_creates_session(self, cloud_keys, edge_keys, monkeypatch, tmp_path):
        """Valid QR → session created, token issued."""
        private_pem, public_pem = edge_keys
        cloud_priv, cloud_pub = cloud_keys

        priv_path = tmp_path / "private.pem"
        cloud_pub_path = tmp_path / "cloud_public.pem"
        priv_path.write_bytes(private_pem)
        cloud_pub_path.write_bytes(cloud_pub)

        from server.app.config import settings
        monkeypatch.setattr(settings, "rsa_private_key_path", str(priv_path))
        monkeypatch.setattr(settings, "rsa_public_key_path", str(cloud_pub_path))

        candidate_id = str(uuid.uuid4())
        exam_id = str(uuid.uuid4())
        qr_json = _make_qr_token(cloud_keys, candidate_id, exam_id)

        candidate = _make_candidate(candidate_id=candidate_id, exam_id=exam_id, embedding=None)
        db, _ = _make_auth_db(candidate, cloud_keys)

        with patch("server.app.services.auth_service.AuditService.log_event", new=AsyncMock()):
            svc = AuthService(db)
            result = await svc.authenticate(qr_data=qr_json, face_image_base64=None)

        assert result["session_id"] is not None
        assert result["token"] is not None
        assert result["method"] == "qr_only"
        assert result["face_score"] == 0.0
        assert result["variant_id"] is not None

    @pytest.mark.asyncio
    async def test_qr_only_token_is_verifiable(self, cloud_keys, edge_keys, monkeypatch, tmp_path):
        """Issued JWT must be verifiable with the edge public key."""
        private_pem, public_pem = edge_keys
        cloud_priv, cloud_pub = cloud_keys

        priv_path = tmp_path / "private2.pem"
        cloud_pub_path = tmp_path / "cloud_pub2.pem"
        priv_path.write_bytes(private_pem)
        cloud_pub_path.write_bytes(cloud_pub)

        from server.app.config import settings
        monkeypatch.setattr(settings, "rsa_private_key_path", str(priv_path))
        monkeypatch.setattr(settings, "rsa_public_key_path", str(cloud_pub_path))

        candidate_id = str(uuid.uuid4())
        exam_id = str(uuid.uuid4())
        qr_json = _make_qr_token(cloud_keys, candidate_id, exam_id)

        candidate = _make_candidate(candidate_id=candidate_id, exam_id=exam_id)
        db, _ = _make_auth_db(candidate, cloud_keys)

        with patch("server.app.services.auth_service.AuditService.log_event", new=AsyncMock()):
            svc = AuthService(db)
            result = await svc.authenticate(qr_data=qr_json, face_image_base64=None)

        # Token must verify with edge public key
        claims = JWTHandler.verify_token(result["token"], public_pem)
        assert claims["candidate_id"] == candidate_id
        assert claims["exam_id"] == exam_id


# ===========================================================================
# Full Auth Flow (QR + Face)
# ===========================================================================


class TestAuthFlowQRFace:
    """Integration: dual-factor QR + face auth."""

    @pytest.mark.asyncio
    async def test_qr_face_pass(self, cloud_keys, edge_keys, monkeypatch, tmp_path):
        """QR valid + matching face → session created with method=qr_face."""
        private_pem, public_pem = edge_keys
        _, cloud_pub = cloud_keys

        priv_path = tmp_path / "private.pem"
        cloud_pub_path = tmp_path / "cloud_pub.pem"
        priv_path.write_bytes(private_pem)
        cloud_pub_path.write_bytes(cloud_pub)

        from server.app.config import settings
        monkeypatch.setattr(settings, "rsa_private_key_path", str(priv_path))
        monkeypatch.setattr(settings, "rsa_public_key_path", str(cloud_pub_path))
        monkeypatch.setattr(settings, "face_similarity_threshold", 0.6)

        # Build a matching embedding pair (same vector)
        embedding = FaceVerificationService.make_random_embedding()
        embedding_bytes = FaceVerificationService.embedding_to_bytes(embedding)
        live_b64 = base64.b64encode(embedding_bytes).decode()

        candidate_id = str(uuid.uuid4())
        exam_id = str(uuid.uuid4())
        qr_json = _make_qr_token(cloud_keys, candidate_id, exam_id)

        candidate = _make_candidate(
            candidate_id=candidate_id,
            exam_id=exam_id,
            embedding=embedding_bytes,
        )
        db, _ = _make_auth_db(candidate, cloud_keys)

        with patch("server.app.services.auth_service.AuditService.log_event", new=AsyncMock()):
            svc = AuthService(db)
            result = await svc.authenticate(qr_data=qr_json, face_image_base64=live_b64)

        assert result["method"] == "qr_face"
        assert result["face_score"] >= 0.99  # Same embedding → score ≈ 1.0

    @pytest.mark.asyncio
    async def test_qr_face_fail_raises(self, cloud_keys, edge_keys, monkeypatch, tmp_path):
        """QR valid + non-matching face → ValueError raised."""
        private_pem, public_pem = edge_keys
        _, cloud_pub = cloud_keys

        priv_path = tmp_path / "private.pem"
        cloud_pub_path = tmp_path / "cloud_pub.pem"
        priv_path.write_bytes(private_pem)
        cloud_pub_path.write_bytes(cloud_pub)

        from server.app.config import settings
        monkeypatch.setattr(settings, "rsa_private_key_path", str(priv_path))
        monkeypatch.setattr(settings, "rsa_public_key_path", str(cloud_pub_path))
        monkeypatch.setattr(settings, "face_similarity_threshold", 0.95)  # Very strict

        # Stored embedding (photo)
        stored_emb = FaceVerificationService.make_random_embedding()
        stored_bytes = FaceVerificationService.embedding_to_bytes(stored_emb)
        # Live = completely different random embedding
        live_emb = FaceVerificationService.make_random_embedding()
        live_bytes = FaceVerificationService.embedding_to_bytes(live_emb)
        live_b64 = base64.b64encode(live_bytes).decode()

        candidate_id = str(uuid.uuid4())
        exam_id = str(uuid.uuid4())
        qr_json = _make_qr_token(cloud_keys, candidate_id, exam_id)

        candidate = _make_candidate(
            candidate_id=candidate_id,
            exam_id=exam_id,
            embedding=stored_bytes,
        )
        db, _ = _make_auth_db(candidate, cloud_keys)

        svc = AuthService(db)
        with pytest.raises(ValueError, match="Face verification failed"):
            await svc.authenticate(qr_data=qr_json, face_image_base64=live_b64)


# ===========================================================================
# Supervisor Override
# ===========================================================================


class TestSupervisorOverride:
    """Integration: supervisor override flow."""

    @pytest.mark.asyncio
    async def test_supervisor_override_creates_session(
        self, cloud_keys, edge_keys, monkeypatch, tmp_path
    ):
        """Supervisor override must create session without QR."""
        private_pem, public_pem = edge_keys
        priv_path = tmp_path / "private.pem"
        priv_path.write_bytes(private_pem)

        from server.app.config import settings
        monkeypatch.setattr(settings, "rsa_private_key_path", str(priv_path))

        candidate_id = str(uuid.uuid4())
        exam_id = str(uuid.uuid4())
        candidate = _make_candidate(candidate_id=candidate_id, exam_id=exam_id)

        # DB: candidate lookup + audit log calls
        db = AsyncMock()
        db.add = MagicMock()
        db.flush = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = candidate
        mock_result.scalar.return_value = 0
        mock_result.scalars.return_value.all.return_value = []
        db.execute = AsyncMock(return_value=mock_result)

        with patch("server.app.services.auth_service.AuditService.log_event", new=AsyncMock()):
            svc = AuthService(db)
            result = await svc.supervisor_override(
                candidate_id=candidate_id,
                exam_id=exam_id,
                invigilator_id="INV-001",
                reason="QR scanner malfunction at gate",
            )

        assert result["method"] == "supervisor_override"
        assert result["session_id"] is not None
        assert result["token"] is not None
        assert result["face_score"] == 0.0

    @pytest.mark.asyncio
    async def test_supervisor_override_token_verifiable(
        self, cloud_keys, edge_keys, monkeypatch, tmp_path
    ):
        """JWT from supervisor override must verify with edge public key."""
        private_pem, public_pem = edge_keys
        priv_path = tmp_path / "private.pem"
        priv_path.write_bytes(private_pem)

        from server.app.config import settings
        monkeypatch.setattr(settings, "rsa_private_key_path", str(priv_path))

        candidate_id = str(uuid.uuid4())
        exam_id = str(uuid.uuid4())
        candidate = _make_candidate(candidate_id=candidate_id, exam_id=exam_id)

        db = AsyncMock()
        db.add = MagicMock()
        db.flush = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = candidate
        mock_result.scalar.return_value = 0
        mock_result.scalars.return_value.all.return_value = []
        db.execute = AsyncMock(return_value=mock_result)

        with patch("server.app.services.auth_service.AuditService.log_event", new=AsyncMock()):
            svc = AuthService(db)
            result = await svc.supervisor_override(
                candidate_id=candidate_id,
                exam_id=exam_id,
                invigilator_id="INV-002",
                reason="Camera not functional, identity verified by ID card",
            )

        claims = JWTHandler.verify_token(result["token"], public_pem)
        assert claims["candidate_id"] == candidate_id
        assert claims["exam_id"] == exam_id

    @pytest.mark.asyncio
    async def test_supervisor_override_unknown_candidate_raises(
        self, edge_keys, monkeypatch, tmp_path
    ):
        """Override for unknown candidate must raise ValueError."""
        private_pem, _ = edge_keys
        priv_path = tmp_path / "private.pem"
        priv_path.write_bytes(private_pem)

        from server.app.config import settings
        monkeypatch.setattr(settings, "rsa_private_key_path", str(priv_path))

        db = AsyncMock()
        db.add = MagicMock()
        db.flush = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None  # Not found
        db.execute = AsyncMock(return_value=mock_result)

        svc = AuthService(db)
        with pytest.raises(ValueError, match="not found"):
            await svc.supervisor_override(
                candidate_id="unknown",
                exam_id="e1",
                invigilator_id="INV-003",
                reason="Emergency access request",
            )
