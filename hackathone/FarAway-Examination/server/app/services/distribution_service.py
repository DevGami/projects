"""
Distribution Service — package delivery management + admin key release (D-012).

Responsibilities:
  - List available packages
  - Track delivery status per package
  - Admin-triggered key release: wrap AES key with center's RSA public key

Architecture note (D-012):
  The `release_key()` method implements the simplified hackathon version of
  "time-locked keys". Instead of a TEE-enforced time lock, an admin explicitly
  triggers key release via the API. This can be demonstrated live in the demo.

  Production would use:
  - AWS Nitro Enclaves for time-locked release
  - HSM-backed key storage instead of DB
"""

from __future__ import annotations

import base64
import logging
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from server.app.models.package import Package
from server.app.services.package_service import PackageService

logger = logging.getLogger(__name__)


class DistributionService:
    """Manages package delivery and admin-triggered key release."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    # -------------------------------------------------------------------
    # Key Release (D-012: Admin-triggered)
    # -------------------------------------------------------------------

    async def release_key(
        self,
        exam_id: str,
        center_public_key_pem: str,
    ) -> dict:
        """
        Admin-triggered key release (D-012).

        Finds the generated package for the given exam, wraps its AES
        decryption key with the center's RSA public key, and returns
        the wrapped key for secure delivery.

        Args:
            exam_id: UUID string of the exam
            center_public_key_pem: PEM string of the center's RSA public key

        Returns:
            dict with exam_id, package_id, wrapped_key_b64, released_at

        Raises:
            ValueError: If no package found for the exam
        """
        # Find package for this exam
        stmt = (
            select(Package)
            .where(Package.exam_id == exam_id)
            .order_by(Package.created_at.desc())
            .limit(1)
        )
        result = await self._db.execute(stmt)
        package = result.scalar_one_or_none()

        if package is None:
            raise ValueError(
                f"No package found for exam {exam_id}. "
                "Generate the package first via POST /packages/generate"
            )

        # Wrap AES key with center's RSA public key
        center_pub_pem_bytes = center_public_key_pem.encode("utf-8")
        pkg_svc = PackageService(self._db)
        wrapped_key_bytes = await pkg_svc.get_wrapped_key(
            str(package.id),
            center_pub_pem_bytes,
        )
        wrapped_key_b64 = base64.b64encode(wrapped_key_bytes).decode("utf-8")

        # Mark package as activated
        now = datetime.now(timezone.utc)
        await self._db.execute(
            update(Package)
            .where(Package.id == package.id)
            .values(status="activated")
        )
        await self._db.flush()

        logger.info(
            "Key released for exam %s (package %s) at %s",
            exam_id,
            package.id,
            now.isoformat(),
        )

        return {
            "exam_id": exam_id,
            "package_id": str(package.id),
            "wrapped_key_b64": wrapped_key_b64,
            "released_at": now.isoformat(),
        }

    # -------------------------------------------------------------------
    # Package Listing & Status
    # -------------------------------------------------------------------

    async def list_packages(self) -> list[dict]:
        """
        List all packages with their current delivery status.

        Returns:
            List of dicts with package metadata
        """
        stmt = select(Package).order_by(Package.created_at.desc())
        result = await self._db.execute(stmt)
        packages = result.scalars().all()

        return [
            {
                "package_id": str(p.id),
                "exam_id": str(p.exam_id),
                "status": p.status,
                "package_hash": p.package_hash,
                "created_at": (
                    p.created_at.isoformat() if p.created_at else None
                ),
            }
            for p in packages
        ]

    async def get_delivery_status(self, package_id: str) -> dict:
        """
        Get delivery status for a specific package.

        Args:
            package_id: UUID string of the package

        Returns:
            Dict with package_id, exam_id, status, created_at

        Raises:
            ValueError: If package not found
        """
        stmt = select(Package).where(Package.id == package_id)
        result = await self._db.execute(stmt)
        package = result.scalar_one_or_none()

        if package is None:
            raise ValueError(f"Package not found: {package_id}")

        return {
            "package_id": str(package.id),
            "exam_id": str(package.exam_id),
            "status": package.status,
            "package_hash": package.package_hash,
            "created_at": (
                package.created_at.isoformat() if package.created_at else None
            ),
        }
