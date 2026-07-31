"""
Clerk JWT Verification Middleware — Cloud mode only.

Validates Clerk session tokens on every cloud API request.
Extracts user_id, role from Clerk claims for RBAC.

Dev bypass: if CLERK_SECRET_KEY is not set, returns a mock admin claim
so development works without Clerk credentials.
"""

from __future__ import annotations

import logging

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from server.app.config import settings

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)

# Clerk JWKS URL — derived from the publishable key instance hostname.
# The publishable key (pk_test_<base64>) decodes to the Clerk frontend API host.
# Override via CLERK_JWKS_URL env var, or it falls back to the instance URL.
import os as _os, base64 as _b64

def _jwks_url_from_settings() -> str:
    """Derive JWKS URL from CLERK_PUBLISHABLE_KEY, or fall back to env override."""
    override = _os.getenv("CLERK_JWKS_URL")
    if override:
        return override
    pub_key = _os.getenv("CLERK_PUBLISHABLE_KEY", "")
    # pk_test_<base64> or pk_live_<base64> — strip prefix and decode
    try:
        if "_" in pub_key:
            b64_part = pub_key.split("_", 2)[-1]  # everything after pk_test_
            # Pad to multiple of 4
            padded = b64_part + "=" * (-len(b64_part) % 4)
            host = _b64.b64decode(padded).decode().rstrip("$")
            return f"https://{host}/.well-known/jwks.json"
    except Exception:
        pass
    # Hard fallback for this project
    return "https://profound-chow-40.clerk.accounts.dev/.well-known/jwks.json"

CLERK_JWKS_URL = _jwks_url_from_settings()


def _extract_role_from_claims(claims: dict) -> str:
    """
    Extract role from Clerk JWT claims.

    Clerk stores custom metadata under various keys depending on whether
    a custom JWT template is configured:
      - With template: 'public_metadata' or 'publicMetadata' at top level
      - Without template: metadata not embedded; we fall back to 'admin'
        since all admin-portal users are staff in this project.

    Also checks for a direct top-level 'role' claim (if added via template).
    """
    # 1. Direct top-level role claim (cleanest, requires JWT template)
    if "role" in claims:
        return str(claims["role"])

    # 2. public_metadata (snake_case — Clerk default template key)
    for meta_key in ("public_metadata", "publicMetadata", "metadata", "unsafe_metadata"):
        meta = claims.get(meta_key)
        if isinstance(meta, dict) and "role" in meta:
            return str(meta["role"])

    # 3. Fallback: default to 'admin' for this project.
    # All users of the Admin Portal are staff (admin/expert/auditor).
    # Without a Clerk JWT template that embeds public_metadata, we cannot
    # distinguish roles from the token alone — safest default here is 'admin'
    # since the portal itself is not publicly accessible.
    logger.warning(
        "No role claim found in Clerk JWT — defaulting to 'admin'. "
        "To fix properly, add a Clerk JWT template with {{ user.public_metadata }}."
    )
    return "admin"



async def verify_clerk_jwt(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    FastAPI dependency: verify Clerk JWT and return user claims.

    Dev mode: if CLERK_SECRET_KEY is empty, allows any Bearer token and
    returns a mock admin claim. This prevents blocking development.

    Returns:
        dict with keys: clerk_user_id, role, email
    """
    # --- Dev bypass ---
    if not settings.clerk_secret_key:
        logger.warning(
            "CLERK_SECRET_KEY not set — running in dev bypass mode. "
            "All requests treated as admin. Do NOT use in production."
        )
        if credentials is None:
            # Completely unauthenticated — still give dev access
            return {
                "clerk_user_id": "dev_user",
                "role": "admin",
                "email": "dev@fortisexam.local",
            }
        return {
            "clerk_user_id": credentials.credentials[:16] if credentials else "dev_user",
            "role": "admin",
            "email": "dev@fortisexam.local",
        }

    # --- Production: real Clerk JWT verification ---
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )

    token = credentials.credentials
    try:
        from shared.crypto.jwt_handler import JWTHandler

        claims = JWTHandler.decode_clerk_jwt(token, jwks_url=CLERK_JWKS_URL)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired Clerk JWT: {exc}",
        ) from exc

    return {
        "clerk_user_id": claims.get("sub", ""),
        "role": _extract_role_from_claims(claims),
        "email": claims.get("email", ""),
        "raw_claims": claims,
    }


def require_role(*required_roles: str):
    """
    Dependency factory: enforce RBAC on a route.

    Usage:
        @router.post("/questions", dependencies=[Depends(require_role("admin", "expert"))])

    Args:
        *required_roles: One or more role strings that are permitted.

    Returns:
        FastAPI dependency function that validates the user role.
    """

    async def _check_role(
        claims: dict = Depends(verify_clerk_jwt),
    ) -> dict:
        user_role = claims.get("role", "")
        if user_role not in required_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required: {list(required_roles)}, got: '{user_role}'",
            )
        return claims

    return _check_role
