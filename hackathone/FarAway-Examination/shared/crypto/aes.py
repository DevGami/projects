"""
AES-256-GCM Encryption/Decryption

Used for:
  - Question content encryption at rest
  - Exam package encryption for distribution
  - Recovery snapshot encryption (optional)

Spec: NIST SP 800-38D (GCM mode)
Key size: 256-bit (32 bytes)
Nonce: 96-bit (12 bytes) — random per encryption
Tag: 128-bit (16 bytes) — GCM authentication tag

Security note: Never reuse a (key, nonce) pair. This implementation
enforces unique nonces via os.urandom(12) on every call.
"""

import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


class AESCipher:
    """AES-256-GCM authenticated encryption."""

    NONCE_SIZE = 12  # bytes (96-bit GCM nonce)
    KEY_SIZE = 32    # bytes (256-bit key)

    @staticmethod
    def generate_key() -> bytes:
        """Generate a random 256-bit AES key."""
        return os.urandom(AESCipher.KEY_SIZE)

    @staticmethod
    def encrypt(plaintext: bytes, key: bytes) -> tuple[bytes, bytes, bytes]:
        """
        Encrypt plaintext with AES-256-GCM.

        A fresh 12-byte nonce is generated on every call — nonce reuse
        is catastrophic for GCM security (see D-002 consequences).

        Args:
            plaintext: Data to encrypt (bytes)
            key: 32-byte AES-256 key

        Returns:
            (ciphertext, nonce, tag) — all bytes
            - ciphertext: encrypted data (same length as plaintext)
            - nonce: 12-byte random nonce used for this encryption
            - tag: 16-byte GCM authentication tag

        Raises:
            ValueError: If key is not 32 bytes
        """
        if len(key) != AESCipher.KEY_SIZE:
            raise ValueError(
                f"AES key must be {AESCipher.KEY_SIZE} bytes, got {len(key)}"
            )

        nonce = os.urandom(AESCipher.NONCE_SIZE)
        aesgcm = AESGCM(key)

        # AESGCM.encrypt returns ciphertext + tag concatenated
        ct_and_tag = aesgcm.encrypt(nonce, plaintext, associated_data=None)

        # Split: last 16 bytes are the GCM tag
        ciphertext = ct_and_tag[:-16]
        tag = ct_and_tag[-16:]

        return ciphertext, nonce, tag

    @staticmethod
    def decrypt(ciphertext: bytes, key: bytes, nonce: bytes, tag: bytes) -> bytes:
        """
        Decrypt AES-256-GCM ciphertext.

        Args:
            ciphertext: Encrypted data bytes
            key: 32-byte AES-256 key
            nonce: 12-byte nonce used during encryption
            tag: 16-byte GCM authentication tag

        Returns:
            Plaintext bytes

        Raises:
            cryptography.exceptions.InvalidTag: If ciphertext or tag has been tampered with
            ValueError: If key is not 32 bytes or nonce is not 12 bytes
        """
        if len(key) != AESCipher.KEY_SIZE:
            raise ValueError(
                f"AES key must be {AESCipher.KEY_SIZE} bytes, got {len(key)}"
            )
        if len(nonce) != AESCipher.NONCE_SIZE:
            raise ValueError(
                f"Nonce must be {AESCipher.NONCE_SIZE} bytes, got {len(nonce)}"
            )

        aesgcm = AESGCM(key)

        # AESGCM.decrypt expects ciphertext + tag concatenated
        ct_with_tag = ciphertext + tag
        return aesgcm.decrypt(nonce, ct_with_tag, associated_data=None)
