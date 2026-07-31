"""
Pydantic schemas for Module 02 — Cryptographic Package Delivery.

All request/response models for:
  - Package generation
  - Package download
  - Package signature verification
  - Admin-triggered key release (D-012)
  - Distribution status
"""

from __future__ import annotations

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Package Generation
# ---------------------------------------------------------------------------


class GeneratePackageRequest(BaseModel):
    """Request to compile and encrypt an exam package."""

    exam_id: str = Field(..., description="UUID of the exam to package")
    center_public_key_pem: str = Field(
        ...,
        description=(
            "PEM-encoded RSA-2048 public key of the exam center. "
            "Used to wrap the AES package key for secure delivery."
        ),
    )

    model_config = {"json_schema_extra": {
        "example": {
            "exam_id": "550e8400-e29b-41d4-a716-446655440000",
            "center_public_key_pem": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----",
        }
    }}


class PackageResponse(BaseModel):
    """Package metadata (no encrypted payload or keys)."""

    id: str
    exam_id: str
    package_hash: str = Field(..., description="SHA-256 of the encrypted payload")
    status: str = Field(..., description="generated | distributed | activated")
    created_at: str


# ---------------------------------------------------------------------------
# Package Download
# ---------------------------------------------------------------------------


class PackageDownloadResponse(BaseModel):
    """Encrypted package payload for download by the edge center."""

    package_id: str
    encrypted_payload_b64: str = Field(
        ...,
        description="Base64-encoded AES-256-GCM ciphertext of the exam manifest",
    )
    iv_b64: str = Field(
        ...,
        description="Base64-encoded 12-byte GCM nonce",
    )
    tag_b64: str = Field(
        ...,
        description="Base64-encoded 16-byte GCM authentication tag",
    )
    package_hash: str = Field(
        ...,
        description="SHA-256 of encrypted_payload — verify before use",
    )


# ---------------------------------------------------------------------------
# Package Verification
# ---------------------------------------------------------------------------


class PackageVerifyResponse(BaseModel):
    """Result of RSA signature verification."""

    package_id: str
    valid: bool
    package_hash: str
    checked_at: str


# ---------------------------------------------------------------------------
# Key Release (D-012)
# ---------------------------------------------------------------------------


class ReleaseKeyRequest(BaseModel):
    """
    Admin-triggered key release request (D-012).

    The center submits its RSA public key; the server wraps the package
    AES key with it and returns the wrapped key. Only the center's private
    key can unwrap it.
    """

    center_public_key_pem: str = Field(
        ...,
        description="PEM-encoded RSA-2048 public key of the exam center",
    )

    model_config = {"json_schema_extra": {
        "example": {
            "center_public_key_pem": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----",
        }
    }}


class ReleaseKeyResponse(BaseModel):
    """
    Response to admin-triggered key release.

    The wrapped_key_b64 is the AES package key encrypted with the center's
    RSA public key (OAEP padding). The center decrypts it with their private
    key and uses it to decrypt the exam package.
    """

    exam_id: str
    package_id: str
    wrapped_key_b64: str = Field(
        ...,
        description="Base64-encoded RSA-OAEP wrapped AES package key",
    )
    released_at: str


# ---------------------------------------------------------------------------
# Distribution
# ---------------------------------------------------------------------------


class PackageStatusResponse(BaseModel):
    """Delivery status of a single package."""

    package_id: str
    exam_id: str
    status: str
    created_at: str


class PackageListResponse(BaseModel):
    """List of packages with their current status."""

    packages: list[PackageStatusResponse]
    total: int
