"""
Edge JWT Verification Middleware — Edge mode only.

Validates per-node RSA-signed JWTs for candidate sessions.
No Clerk dependency — fully offline.
"""

from __future__ import annotations

import logging

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from server.app.config import settings
from shared.crypto.jwt_handler import JWTHandler
from shared.crypto.rsa import RSASigner

logger = logging.getLogger(__name__)

security = HTTPBearer()


async def verify_edge_jwt(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    FastAPI dependency: verify edge-local RSA-signed JWT and return session claims.

    Loads the edge node's RSA public key from the path in settings,
    verifies the RS256 signature, and returns the decoded session payload.

    Returns:
        dict with keys: sub (session_id), candidate_id, exam_id, variant_id

    Raises:
        HTTPException 401 — missing, expired, or invalid token
    """
    token = credentials.credentials

    try:
        public_key_pem = RSASigner.load_public_key(settings.rsa_public_key_path)
        claims = JWTHandler.verify_token(token, public_key_pem)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired edge session token: {exc}",
        ) from exc

    return claims
