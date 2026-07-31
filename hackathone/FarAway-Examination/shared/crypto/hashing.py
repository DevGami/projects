"""
SHA-256 Hashing Utilities

Used for:
  - Content hash generation (question, answer, package)
  - Audit chain hash linking
  - Nonce generation

Spec: FIPS 180-4
"""

import hashlib
import json
import secrets


class HashUtils:
    """SHA-256 hashing and utility functions."""

    @staticmethod
    def sha256(data: bytes) -> str:
        """Compute SHA-256 hex digest."""
        return hashlib.sha256(data).hexdigest()

    @staticmethod
    def sha256_json(obj: dict) -> str:
        """Compute SHA-256 of JSON-serialized dict (deterministic).

        Uses sorted keys and compact separators for canonical form.
        """
        canonical = json.dumps(obj, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    @staticmethod
    def generate_nonce(length: int = 32) -> str:
        """Generate a cryptographically secure random hex nonce."""
        return secrets.token_hex(length)
