"""
Cloud API — Package Management

Encrypted exam package generation and retrieval.
Protected by Clerk JWT middleware (cloud mode only).

Routes:
  POST /packages/generate         — Generate encrypted+signed package
  GET  /packages/{package_id}     — Get package metadata
  GET  /packages/{package_id}/download  — Download encrypted payload
  POST /packages/{package_id}/verify   — Verify RSA signature
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from server.app.config import settings
from server.app.db.database import get_db
from server.app.schemas.packages import (
    GeneratePackageRequest,
    PackageDownloadResponse,
    PackageResponse,
    PackageVerifyResponse,
)
from server.app.services.package_service import PackageService
from shared.crypto.rsa import RSASigner

router = APIRouter(prefix="/packages")


def _load_server_private_key() -> bytes:
    """Load the server RSA private key for package signing."""
    try:
        return RSASigner.load_private_key(settings.rsa_private_key_path)
    except FileNotFoundError:
        raise HTTPException(
            status_code=503,
            detail=(
                "Server RSA private key not found. "
                "Run: python scripts/generate_keys.py"
            ),
        )


def _load_server_public_key() -> bytes:
    """Load the server RSA public key for signature verification."""
    try:
        return RSASigner.load_public_key(settings.rsa_public_key_path)
    except FileNotFoundError:
        raise HTTPException(
            status_code=503,
            detail=(
                "Server RSA public key not found. "
                "Run: python scripts/generate_keys.py"
            ),
        )


@router.post("/generate", response_model=PackageResponse, status_code=201)
async def generate_package(
    request: GeneratePackageRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Generate an encrypted, RSA-signed exam package.

    Compiles all questions for the exam, encrypts with AES-256-GCM,
    signs the package hash with RSA-2048 (PSS), and persists to DB.

    The encrypted payload is unreadable without the AES key, which is
    released separately via POST /exams/{exam_id}/release-key.
    """
    private_key_pem = _load_server_private_key()
    svc = PackageService(db)

    try:
        package = await svc.generate(
            exam_id=request.exam_id,
            private_key_pem=private_key_pem,
        )
        await db.commit()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return PackageResponse(
        id=str(package.id),
        exam_id=str(package.exam_id),
        package_hash=package.package_hash,
        status=package.status,
        created_at=(
            package.created_at.isoformat() if package.created_at
            else datetime.now(timezone.utc).isoformat()
        ),
    )


@router.get("/{package_id}", response_model=PackageResponse)
async def get_package(
    package_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get package metadata (no payload or keys)."""
    svc = PackageService(db)
    package = await svc.get(package_id)

    if package is None:
        raise HTTPException(status_code=404, detail=f"Package not found: {package_id}")

    return PackageResponse(
        id=str(package.id),
        exam_id=str(package.exam_id),
        package_hash=package.package_hash,
        status=package.status,
        created_at=(
            package.created_at.isoformat() if package.created_at
            else ""
        ),
    )


@router.get("/{package_id}/download", response_model=PackageDownloadResponse)
async def download_package(
    package_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Download the encrypted exam package payload.

    Returns the AES-256-GCM ciphertext, nonce (iv), and authentication tag.
    The content is completely opaque without the AES key.
    """
    svc = PackageService(db)

    try:
        payload_b64, iv_b64, tag_b64, package_hash = await svc.download_payload(
            package_id
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return PackageDownloadResponse(
        package_id=package_id,
        encrypted_payload_b64=payload_b64,
        iv_b64=iv_b64,
        tag_b64=tag_b64,
        package_hash=package_hash,
    )


@router.post("/{package_id}/verify", response_model=PackageVerifyResponse)
async def verify_package(
    package_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Verify the RSA-2048 PSS signature of a package.

    A valid signature proves:
    1. The package was created by this server (private key holder)
    2. The encrypted payload has not been tampered with since generation
    """
    public_key_pem = _load_server_public_key()
    svc = PackageService(db)

    try:
        valid = await svc.verify_signature(package_id, public_key_pem)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return PackageVerifyResponse(
        package_id=package_id,
        valid=valid,
        package_hash=(await svc.get(package_id)).package_hash,
        checked_at=datetime.now(timezone.utc).isoformat(),
    )
