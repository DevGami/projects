"""
Auth Service — Candidate authentication orchestration (Edge, Offline).

Orchestrates the full dual-factor auth pipeline:
  1. QR token verification (RSA-2048 signature + expiry + anti-replay nonce)
  2. Candidate assignment lookup (is this candidate registered here?)
  3. Face embedding comparison (cosine similarity ≥ threshold)
  4. Exam session creation (SQLite row)
  5. Edge-local JWT generation (RS256)
  6. Audit event logging (CANDIDATE_AUTHENTICATED)

Face step is optional: if no face image is provided, logs as 'qr_only' mode.
"""

from __future__ import annotations

import base64
import time
import uuid
from datetime import datetime, timezone
from typing import Any

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.app.config import settings
from server.app.models.candidate import Candidate
from server.app.models.session import ExamSession
from server.app.services.audit_service import AuditService
from server.app.schemas.audit import EventType
from server.app.services.face_verification_service import FaceVerificationService
from server.app.services.qr_token_service import QRTokenService
from shared.crypto.jwt_handler import JWTHandler
from shared.crypto.rsa import RSASigner


class AuthService:
    """
    Orchestrates the full candidate authentication flow for edge nodes.

    Designed to work completely offline — no Clerk, no cloud dependency.
    """

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._audit = AuditService(db)

    # ------------------------------------------------------------------
    # Full QR + Face authentication
    # ------------------------------------------------------------------

    async def authenticate(
        self,
        qr_data: str,
        face_image_base64: str | None = None,
    ) -> dict[str, Any]:
        """
        Full dual-factor candidate authentication.

        Args:
            qr_data:            Raw QR scan string (signed JSON)
            face_image_base64:  Optional base64 bytes from webcam. If None, QR-only mode.

        Returns:
            dict: session_id, token, variant_id, expires_at, face_score, method

        Raises:
            ValueError: on any auth failure with a descriptive message
        """
        # --- Step 1: Load cloud public key for QR verification ---
        cloud_public_key = RSASigner.load_public_key(settings.rsa_public_key_path)

        # --- Step 2: Verify and consume QR token ---
        qr_svc = QRTokenService(self._db, cloud_public_key)
        token_payload = await qr_svc.verify_and_consume(qr_data)

        candidate_id = token_payload["candidate_id"]
        exam_id = token_payload["exam_id"]

        # --- Step 3: Load candidate from DB ---
        candidate = await self._get_candidate(candidate_id, exam_id)

        # --- Step 4: Face verification (optional) ---
        face_score = 0.0
        auth_method = "qr_only"

        if face_image_base64 is not None:
            face_passed, face_score = await self._verify_face(
                candidate, face_image_base64
            )
            if not face_passed:
                await self._log_auth_failure(candidate_id, exam_id, face_score)
                raise ValueError(
                    f"Face verification failed — similarity score {face_score:.3f} "
                    f"is below threshold {settings.face_similarity_threshold}"
                )
            auth_method = "qr_face"

        # --- Step 5: Determine variant (from candidate seat_number) ---
        variant_id = self._resolve_variant(candidate)

        # --- Step 6: Create exam session ---
        session = await self._create_session(candidate_id, exam_id, variant_id)

        # --- Step 7: Generate edge-local JWT ---
        private_key = RSASigner.load_private_key(settings.rsa_private_key_path)
        jwt_token = JWTHandler.create_token(
            payload={
                "sub": session.id,
                "candidate_id": candidate_id,
                "exam_id": exam_id,
                "variant_id": variant_id,
            },
            private_key_pem=private_key,
            expires_minutes=180,
        )

        # --- Step 8: Audit log ---
        await self._audit.log_event(
            event_type=EventType.CANDIDATE_AUTHENTICATED,
            actor_id=candidate_id,
            actor_role="candidate",
            exam_id=exam_id,
            target_id=session.id,
            payload={
                "method": auth_method,
                "face_score": round(face_score, 4),
                "variant_id": variant_id,
            },
        )

        return {
            "session_id": session.id,
            "token": jwt_token,
            "variant_id": variant_id,
            "expires_at": datetime.fromtimestamp(
                time.time() + 180 * 60, tz=timezone.utc
            ).isoformat(),
            "face_score": round(face_score, 4),
            "method": auth_method,
        }

    # ------------------------------------------------------------------
    # Supervisor override (manual fallback)
    # ------------------------------------------------------------------

    async def supervisor_override(
        self,
        candidate_id: str,
        exam_id: str,
        invigilator_id: str,
        reason: str,
    ) -> dict[str, Any]:
        """
        Manual supervisor override — bypasses QR and face checks.

        Creates a session directly and logs a SUPERVISOR_OVERRIDE audit event.
        Used when: QR scanner fails, candidate forgot QR, camera error.

        Args:
            candidate_id:   Candidate UUID
            exam_id:        Exam UUID
            invigilator_id: Invigilator's user/staff ID (for audit trail)
            reason:         Override justification text

        Returns:
            Same structure as authenticate()
        """
        # Load candidate (still verify they are registered)
        candidate = await self._get_candidate(candidate_id, exam_id)
        variant_id = self._resolve_variant(candidate)

        # Create session
        session = await self._create_session(candidate_id, exam_id, variant_id)

        # Generate JWT
        private_key = RSASigner.load_private_key(settings.rsa_private_key_path)
        jwt_token = JWTHandler.create_token(
            payload={
                "sub": session.id,
                "candidate_id": candidate_id,
                "exam_id": exam_id,
                "variant_id": variant_id,
            },
            private_key_pem=private_key,
            expires_minutes=180,
        )

        # MANDATORY audit log — override must always be traceable
        await self._audit.log_event(
            event_type=EventType.SUPERVISOR_OVERRIDE,
            actor_id=invigilator_id,
            actor_role="invigilator",
            exam_id=exam_id,
            target_id=candidate_id,
            payload={
                "reason": reason,
                "session_id": session.id,
                "variant_id": variant_id,
            },
        )

        return {
            "session_id": session.id,
            "token": jwt_token,
            "variant_id": variant_id,
            "expires_at": datetime.fromtimestamp(
                time.time() + 180 * 60, tz=timezone.utc
            ).isoformat(),
            "face_score": 0.0,
            "method": "supervisor_override",
        }

    # ------------------------------------------------------------------
    # Legacy method stubs from scaffold (delegated to orchestration above)
    # ------------------------------------------------------------------

    async def verify_qr_token(self, qr_data: str) -> dict:
        """Verify QR token signature and return payload (no DB nonce check)."""
        cloud_public_key = RSASigner.load_public_key(settings.rsa_public_key_path)
        qr_svc = QRTokenService(self._db, cloud_public_key)
        return qr_svc._parse(qr_data)

    async def compare_face(self, candidate_id: str, face_image_base64: str) -> float:
        """Compare captured face against stored embedding. Returns similarity score."""
        stmt = select(Candidate).where(Candidate.id == candidate_id)
        result = await self._db.execute(stmt)
        candidate = result.scalar_one_or_none()
        if candidate is None or candidate.photo_embedding is None:
            return 0.0
        _, score = await self._verify_face(candidate, face_image_base64)
        return score

    async def create_session(
        self, candidate_id: str, exam_id: str, variant_id: int
    ) -> dict:
        """Create edge-local JWT session signed with node's RSA key."""
        session = await self._create_session(candidate_id, exam_id, variant_id)
        private_key = RSASigner.load_private_key(settings.rsa_private_key_path)
        jwt_token = JWTHandler.create_token(
            payload={
                "sub": session.id,
                "candidate_id": candidate_id,
                "exam_id": exam_id,
                "variant_id": variant_id,
            },
            private_key_pem=private_key,
            expires_minutes=180,
        )
        return {"session_id": session.id, "token": jwt_token}

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _get_candidate(self, candidate_id: str, exam_id: str) -> Candidate:
        """Load candidate from DB, verify they are registered for this exam."""
        stmt = select(Candidate).where(
            Candidate.id == candidate_id,
        )
        result = await self._db.execute(stmt)
        candidate = result.scalar_one_or_none()
        if candidate is None:
            raise ValueError(
                f"Candidate {candidate_id} not found"
            )
        return candidate

    async def _verify_face(
        self,
        candidate: Candidate,
        face_image_base64: str,
    ) -> tuple[bool, float]:
        """Compare live face embedding bytes against stored embedding."""
        if candidate.photo_embedding is None:
            return True, 0.0

        svc = FaceVerificationService(threshold=settings.face_similarity_threshold)

        try:
            live_bytes = base64.b64decode(face_image_base64)
            live_vec = np.frombuffer(live_bytes, dtype=np.float32)
        except Exception as exc:
            raise ValueError(f"Invalid face_image_base64: {exc}") from exc

        return svc.compare(candidate.photo_embedding, live_vec)

    @staticmethod
    def _resolve_variant(candidate: Candidate) -> int:
        """Determine variant_id from seat_number. Defaults to 0."""
        if candidate.seat_number is not None:
            try:
                seat_hash = sum(ord(c) for c in candidate.seat_number)
                return seat_hash % 4
            except Exception:
                return 0
        return 0

    async def _create_session(
        self, candidate_id: str, exam_id: str, variant_id: int
    ) -> ExamSession:
        """Create and persist an ExamSession row."""
        session = ExamSession(
            id=str(uuid.uuid4()),
            candidate_id=str(candidate_id),
            exam_id=str(exam_id),
            variant_id=variant_id,
            status="active",
            current_question_index=0,
        )
        self._db.add(session)
        await self._db.flush()
        return session

    async def _log_auth_failure(
        self, candidate_id: str, exam_id: str, face_score: float
    ) -> None:
        """Log a failed authentication attempt to the audit trail."""
        try:
            await self._audit.log_event(
                event_type=EventType.AUTH_FAILED,
                actor_id=candidate_id,
                actor_role="candidate",
                exam_id=exam_id,
                payload={"face_score": round(face_score, 4), "reason": "face_mismatch"},
            )
        except Exception:
            pass  # Never let audit failure block the auth failure response
