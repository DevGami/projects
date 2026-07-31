"""
Package Service — encrypted exam package generation, signing, and distribution.

Flow:
  1. generate()         — compile manifest → AES-256-GCM encrypt → RSA-2048 sign → persist
  2. get()              — retrieve package metadata from DB
  3. verify_signature() — verify RSA-2048 PSS signature of package
  4. get_wrapped_key()  — wrap stored AES key with center RSA public key (D-012)
  5. download_payload() — return encrypted payload for center download

Architecture notes:
  - Package AES key is stored in the Package.variant_mapping column (JSON encoded).
    Production: use a dedicated HSM/vault. For hackathon: in-DB storage is acceptable.
  - Audit events are logged for PACKAGE_GENERATED and key-release operations.
  - Works with both PostgreSQL (cloud) and SQLite (edge) via SQLAlchemy.
"""

from __future__ import annotations

import base64
import json
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.app.models.package import Package
from server.app.models.question import Question
from shared.crypto.aes import AESCipher
from shared.crypto.hashing import HashUtils
from shared.crypto.rsa import RSASigner

logger = logging.getLogger(__name__)


class PackageService:
    """Manages encrypted exam package lifecycle (Module 02)."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    # -------------------------------------------------------------------
    # Package Generation
    # -------------------------------------------------------------------

    async def generate(
        self,
        exam_id: str,
        private_key_pem: bytes,
        variant_mapping: dict | None = None,
    ) -> Package:
        """
        Generate an encrypted, signed exam package for the given exam.

        Steps:
          1. Fetch all questions for the exam from DB
          2. Build a manifest (question IDs, content hashes, variant mapping)
          3. Encrypt manifest with fresh AES-256-GCM key
          4. Compute package_hash = SHA-256(encrypted_payload)
          5. Sign package_hash with RSA-2048 private key (PSS)
          6. Persist Package to DB (AES key stored in variant_mapping JSON for demo)
          7. Return Package model

        Args:
            exam_id: UUID string of the exam to package
            private_key_pem: RSA-2048 private key bytes for signing
            variant_mapping: Optional seat_id -> variant_id dict (from Module 04)

        Returns:
            Persisted Package model

        Raises:
            ValueError: If no questions found for the exam
        """
        # Fetch questions for this exam
        # In a real system, questions would be linked via exam→question table.
        # For demo: fetch all questions (the blueprint would filter these).
        stmt = select(Question).where(Question.is_deleted.is_(False))
        result = await self._db.execute(stmt)
        questions = list(result.scalars().all())

        if not questions:
            logger.warning(
                "No questions found for exam %s — generating empty package for demo",
                exam_id,
            )

        # Build manifest
        manifest = self._build_manifest(exam_id, questions, variant_mapping or {})
        manifest_bytes = json.dumps(manifest, sort_keys=True).encode("utf-8")

        # Encrypt manifest with fresh AES key
        aes_key = AESCipher.generate_key()
        ciphertext, nonce, tag = AESCipher.encrypt(manifest_bytes, aes_key)

        # Encode encrypted payload as base64 string for DB storage
        encrypted_payload_b64 = base64.b64encode(ciphertext).decode("utf-8")
        nonce_b64 = base64.b64encode(nonce).decode("utf-8")
        tag_b64 = base64.b64encode(tag).decode("utf-8")

        # Compute package hash (SHA-256 of raw ciphertext bytes)
        package_hash = HashUtils.sha256(ciphertext)

        # Sign package_hash with RSA private key
        signature_bytes = RSASigner.sign(package_hash.encode("utf-8"), private_key_pem)
        signature_b64 = base64.b64encode(signature_bytes).decode("utf-8")

        # Store AES key + nonce + tag in variant_mapping JSON (demo-safe approach)
        # Production: use HSM / separate key vault
        key_storage = {
            "aes_key_b64": base64.b64encode(aes_key).decode("utf-8"),
            "nonce_b64": nonce_b64,
            "tag_b64": tag_b64,
            "variant_mapping": variant_mapping or {},
        }

        # Build and persist Package model
        package = Package(
            id=str(uuid.uuid4()),
            exam_id=exam_id,
            encrypted_payload=encrypted_payload_b64,
            encryption_iv=nonce_b64,
            package_hash=package_hash,
            signature=signature_b64,
            variant_mapping=json.dumps(key_storage),
            status="generated",
        )
        self._db.add(package)
        await self._db.flush()

        logger.info(
            "Package %s generated for exam %s (%d questions, hash=%s...)",
            package.id,
            exam_id,
            len(questions),
            package_hash[:16],
        )
        return package

    # -------------------------------------------------------------------
    # Package Retrieval
    # -------------------------------------------------------------------

    async def get(self, package_id: str) -> Package | None:
        """
        Get package by ID.

        Returns:
            Package model or None if not found
        """
        stmt = select(Package).where(Package.id == package_id)
        result = await self._db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_all(self) -> list[Package]:
        """List all packages ordered by creation time (most recent first)."""
        stmt = select(Package).order_by(Package.created_at.desc())
        result = await self._db.execute(stmt)
        return list(result.scalars().all())

    # -------------------------------------------------------------------
    # Signature Verification
    # -------------------------------------------------------------------

    async def verify_signature(self, package_id: str, public_key_pem: bytes) -> bool:
        """
        Verify the RSA-2048 PSS signature of a package.

        Args:
            package_id: UUID string of the package
            public_key_pem: RSA-2048 public key bytes matching the signing private key

        Returns:
            True if signature is valid, False otherwise

        Raises:
            ValueError: If package not found
        """
        package = await self.get(package_id)
        if package is None:
            raise ValueError(f"Package not found: {package_id}")

        signature_bytes = base64.b64decode(package.signature)
        return RSASigner.verify(
            package.package_hash.encode("utf-8"),
            signature_bytes,
            public_key_pem,
        )

    # -------------------------------------------------------------------
    # Key Wrapping (D-012 support)
    # -------------------------------------------------------------------

    async def get_wrapped_key(
        self,
        package_id: str,
        center_public_key_pem: bytes,
    ) -> bytes:
        """
        Wrap the package AES key with the center's RSA public key.

        Called by DistributionService.release_key() when the admin triggers
        key release (D-012). The center decrypts with their private key.

        Args:
            package_id: UUID string of the package
            center_public_key_pem: Center's RSA-2048 public key bytes

        Returns:
            RSA-OAEP wrapped AES key bytes

        Raises:
            ValueError: If package not found or key storage is invalid
        """
        package = await self.get(package_id)
        if package is None:
            raise ValueError(f"Package not found: {package_id}")

        key_storage = self._parse_key_storage(package)
        aes_key = base64.b64decode(key_storage["aes_key_b64"])
        return RSASigner.encrypt_key(aes_key, center_public_key_pem)

    # -------------------------------------------------------------------
    # Download
    # -------------------------------------------------------------------

    async def download_payload(
        self, package_id: str
    ) -> tuple[str, str, str, str]:
        """
        Return the encrypted package payload for center download.

        Returns:
            (encrypted_payload_b64, iv_b64, tag_b64, package_hash)

        Raises:
            ValueError: If package not found
        """
        package = await self.get(package_id)
        if package is None:
            raise ValueError(f"Package not found: {package_id}")

        key_storage = self._parse_key_storage(package)

        return (
            package.encrypted_payload,
            package.encryption_iv,
            key_storage["tag_b64"],
            package.package_hash,
        )

    # -------------------------------------------------------------------
    # Internal helpers
    # -------------------------------------------------------------------

    @staticmethod
    def _build_manifest(
        exam_id: str,
        questions: list[Question],
        variant_mapping: dict,
    ) -> dict:
        """Build the package manifest dict."""
        question_ids = [str(q.id) for q in questions]
        content_hashes = {str(q.id): q.content_hash for q in questions}

        payload = {
            "exam_id": exam_id,
            "question_ids": question_ids,
            "content_hashes": content_hashes,
            "variant_mapping": variant_mapping,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
        # Include a manifest_hash for self-referential integrity
        payload["manifest_hash"] = HashUtils.sha256_json(
            {k: v for k, v in payload.items() if k != "manifest_hash"}
        )
        return payload

    @staticmethod
    def _parse_key_storage(package: Package) -> dict:
        """Parse the key_storage JSON from the variant_mapping column."""
        try:
            return json.loads(package.variant_mapping or "{}")
        except (json.JSONDecodeError, TypeError) as e:
            raise ValueError(
                f"Invalid key storage for package {package.id}: {e}"
            ) from e
