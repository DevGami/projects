"""
QR Token Service — Parse, validate, and consume QR-based auth tokens.

QR tokens are RSA-2048 signed by the cloud server at registration time.
The edge node verifies the signature (offline), checks the nonce (anti-replay),
and confirms the candidate is assigned to this exam.

Token structure (JSON in QR code):
    {
        "candidate_id": "uuid",
        "exam_id": "uuid",
        "center_id": "uuid",
        "nonce": "32-byte random hex",
        "issued_at": "ISO-8601 datetime",
        "expires_at": "ISO-8601 datetime",
        "signature": "base64 RSA-PSS signature of above fields"
    }
"""

from __future__ import annotations

import base64
import json
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.app.models.used_nonce import UsedNonce
from shared.crypto.rsa import RSASigner


class QRTokenService:
    """Validates QR tokens: RSA signature + expiry + anti-replay nonce."""

    def __init__(self, db: AsyncSession, cloud_public_key_pem: bytes) -> None:
        """
        Args:
            db:                   Async DB session (SQLite on edge)
            cloud_public_key_pem: RSA-2048 public key from cloud server (PEM bytes)
        """
        self._db = db
        self._public_key = cloud_public_key_pem

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def verify_and_consume(self, qr_json: str) -> dict:
        """
        Full QR token verification pipeline:
          1. Parse JSON
          2. Verify RSA-2048 signature
          3. Check expiry
          4. Check nonce (anti-replay)
          5. Consume nonce (mark as used)

        Args:
            qr_json: Raw string from QR scanner (JSON)

        Returns:
            Parsed token payload dict (candidate_id, exam_id, center_id, nonce, …)

        Raises:
            ValueError: on any verification failure (with descriptive message)
        """
        payload = self._parse(qr_json)
        self._verify_signature(payload)
        self._check_expiry(payload)
        await self._check_and_consume_nonce(payload["nonce"])
        return payload

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _parse(qr_json: str) -> dict:
        """Parse and minimally validate the QR JSON structure."""
        try:
            data = json.loads(qr_json)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid QR token format: not valid JSON — {exc}") from exc

        required_fields = {
            "candidate_id", "exam_id", "center_id",
            "nonce", "issued_at", "expires_at", "signature",
        }
        missing = required_fields - set(data.keys())
        if missing:
            raise ValueError(f"QR token missing required fields: {missing}")

        return data

    def _verify_signature(self, payload: dict) -> None:
        """Verify RSA-PSS signature over the token payload (excluding 'signature' field)."""
        signature_b64 = payload.get("signature", "")
        if not signature_b64:
            raise ValueError("QR token has no signature field")

        # Canonicalize: sorted JSON of all fields except 'signature'
        unsigned_payload = {k: v for k, v in payload.items() if k != "signature"}
        canonical = json.dumps(unsigned_payload, sort_keys=True, separators=(",", ":"))

        try:
            sig_bytes = base64.b64decode(signature_b64)
        except Exception as exc:
            raise ValueError(f"QR token signature is not valid base64: {exc}") from exc

        is_valid = RSASigner.verify(canonical.encode("utf-8"), sig_bytes, self._public_key)
        if not is_valid:
            raise ValueError("QR token RSA signature verification failed — token may be forged")

    @staticmethod
    def _check_expiry(payload: dict) -> None:
        """Check that the token has not expired."""
        expires_at_str = payload.get("expires_at", "")
        try:
            expires_at = datetime.fromisoformat(expires_at_str)
        except ValueError as exc:
            raise ValueError(f"Invalid expires_at format in QR token: {exc}") from exc

        # Make timezone-aware if naive
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        now = datetime.now(tz=timezone.utc)
        if now > expires_at:
            raise ValueError(
                f"QR token has expired at {expires_at.isoformat()} "
                f"(current time: {now.isoformat()})"
            )

    async def _check_and_consume_nonce(self, nonce: str) -> None:
        """
        Check nonce has not been used before, then mark it as consumed.

        This prevents replay attacks where a stolen QR code is scanned twice.
        """
        if not nonce or len(nonce) < 8:
            raise ValueError("QR token nonce is missing or too short")

        # Check if nonce already exists
        stmt = select(UsedNonce).where(UsedNonce.id == nonce)
        result = await self._db.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing is not None:
            raise ValueError(
                f"QR token nonce has already been used — replay attack detected (nonce={nonce[:8]}…)"
            )

        # Consume: insert nonce into used set
        used = UsedNonce(id=nonce)
        self._db.add(used)
        await self._db.flush()


class QRTokenGenerator:
    """
    Generates signed QR tokens for candidates (cloud side).

    Used during exam registration to create QR codes that candidates
    will present at the exam center on exam day.
    """

    def __init__(self, private_key_pem: bytes) -> None:
        self._private_key = private_key_pem

    def generate(
        self,
        candidate_id: str,
        exam_id: str,
        center_id: str,
        nonce: str,
        issued_at: datetime,
        expires_at: datetime,
    ) -> str:
        """
        Create a signed QR token JSON string.

        Args:
            candidate_id: Candidate UUID
            exam_id:      Exam UUID
            center_id:    Center UUID
            nonce:        Random single-use hex string (32+ bytes)
            issued_at:    Token issue time
            expires_at:   Token expiry time

        Returns:
            JSON string to encode in QR code
        """
        payload = {
            "candidate_id": candidate_id,
            "exam_id": exam_id,
            "center_id": center_id,
            "nonce": nonce,
            "issued_at": issued_at.isoformat(),
            "expires_at": expires_at.isoformat(),
        }
        canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
        signature = RSASigner.sign(canonical.encode("utf-8"), self._private_key)
        payload["signature"] = base64.b64encode(signature).decode("utf-8")
        return json.dumps(payload)
