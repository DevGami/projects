"""
JWT Handler — RS256 token creation and verification.

Two JWT modes:
  - Edge: Custom RSA-signed JWTs (RS256, created/verified locally, no internet)
  - Cloud: Clerk-issued JWTs (verified via JWKS endpoint, not created here)

Uses PyJWT 2.x with cryptography backend.
"""

from __future__ import annotations

import time
from typing import Any

import jwt
from jwt.algorithms import RSAAlgorithm



class JWTHandler:
    """JWT creation and verification for edge-local sessions."""

    # ---------------------------------------------------------------
    # Edge mode — RS256 with local RSA key pair
    # ---------------------------------------------------------------

    @staticmethod
    def create_token(
        payload: dict[str, Any],
        private_key_pem: bytes,
        expires_minutes: int = 180,
    ) -> str:
        """
        Create an RSA-signed JWT (RS256) for an edge session.

        Args:
            payload:          Claims to embed (candidate_id, exam_id, variant_id, …)
            private_key_pem:  RSA-2048 private key in PEM bytes
            expires_minutes:  Token lifetime in minutes (default 3 hours / exam duration)

        Returns:
            Signed JWT string
        """
        now = int(time.time())
        claims = {
            **payload,
            "iat": now,
            "exp": now + expires_minutes * 60,
        }
        token: str = jwt.encode(claims, private_key_pem, algorithm="RS256")
        return token

    @staticmethod
    def verify_token(
        token: str,
        public_key_pem: bytes,
        algorithms: list[str] | None = None,
    ) -> dict[str, Any]:
        """
        Verify an RSA-signed JWT and return its payload.

        Raises:
            jwt.ExpiredSignatureError   — token has expired
            jwt.InvalidSignatureError   — RSA signature verification failed
            jwt.DecodeError             — malformed JWT
            jwt.InvalidTokenError       — any other JWT error

        Args:
            token:          JWT string to verify
            public_key_pem: RSA-2048 public key in PEM bytes
            algorithms:     Allowed signing algorithms (default ["RS256"])

        Returns:
            Decoded payload dict
        """
        if algorithms is None:
            algorithms = ["RS256"]
        payload: dict[str, Any] = jwt.decode(
            token,
            public_key_pem,
            algorithms=algorithms,
            options={"verify_exp": True},
        )
        return payload

    # ---------------------------------------------------------------
    # Cloud mode — Clerk JWKS verification
    # ---------------------------------------------------------------

    @staticmethod
    def decode_clerk_jwt(
        token: str,
        jwks_url: str,
        audience: str | None = None,
    ) -> dict[str, Any]:
        """
        Verify a Clerk-issued JWT against the Clerk JWKS endpoint.

        Fetches public keys from Clerk, selects the matching key via `kid`,
        and verifies the RS256 signature.

        Raises:
            jwt.ExpiredSignatureError  — token expired
            jwt.InvalidTokenError      — bad signature or claims
            RuntimeError               — JWKS fetch failed or kid not found

        Args:
            token:      Clerk JWT from Authorization header
            jwks_url:   Clerk JWKS endpoint, e.g.
                        "https://clerk.your-domain.com/.well-known/jwks.json"
            audience:   Optional aud claim to verify

        Returns:
            Decoded Clerk claims dict (sub, email, role metadata, etc.)
        """
        import httpx  # lazy import — not needed on edge

        # 1. Decode header to get kid (key id) without verifying
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        if not kid:
            raise RuntimeError("JWT header missing 'kid' field")

        # 2. Fetch JWKS (JSON Web Key Set) from Clerk
        try:
            response = httpx.get(jwks_url, timeout=5.0)
            response.raise_for_status()
            jwks_data = response.json()
        except httpx.HTTPError as exc:
            raise RuntimeError(f"Failed to fetch JWKS from {jwks_url}: {exc}") from exc

        # 3. Find matching key by kid
        matching_key = None
        for key_data in jwks_data.get("keys", []):
            if key_data.get("kid") == kid:
                matching_key = key_data
                break
        if matching_key is None:
            raise RuntimeError(f"No JWKS key found for kid={kid}")

        # 4. Convert JWK → RSA public key
        public_key = RSAAlgorithm.from_jwk(matching_key)

        # 5. Verify and decode
        # leeway=300s (5m) tolerates clock skew between the Clerk issuer (browser),
        # the Docker container, and the host machine.
        options: dict[str, Any] = {"verify_exp": True}
        decode_kwargs: dict[str, Any] = {
            "algorithms": ["RS256"],
            "options": options,
            "leeway": 300,
        }
        if audience:
            decode_kwargs["audience"] = audience

        payload: dict[str, Any] = jwt.decode(token, public_key, **decode_kwargs)
        return payload
