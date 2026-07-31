"""
RSA-2048 Signing/Verification + Key Wrapping

Used for:
  - QR token signing (cloud) and verification (edge)
  - Package signature generation and verification
  - AES key wrapping for per-center distribution (D-012)
  - Edge-local JWT signing (per-node key pair)

Spec: PKCS#1 v2.2 / RFC 8017
Padding: PSS (signatures), OAEP (key encryption)
Hash: SHA-256 for both

Note: RSA-4096 is the production target (D-008).
      RSA-2048 is used for the hackathon (faster keygen/ops).
"""

from __future__ import annotations

from pathlib import Path

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey, RSAPublicKey


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _load_private_key_obj(private_key_pem: bytes) -> RSAPrivateKey:
    """Deserialize a PEM private key into a cryptography key object."""
    return serialization.load_pem_private_key(private_key_pem, password=None)  # type: ignore[return-value]


def _load_public_key_obj(public_key_pem: bytes) -> RSAPublicKey:
    """Deserialize a PEM public key into a cryptography key object."""
    return serialization.load_pem_public_key(public_key_pem)  # type: ignore[return-value]


def _pss_padding() -> padding.PSS:
    """Standard PSS padding for RSA signatures (SHA-256, max salt length)."""
    return padding.PSS(
        mgf=padding.MGF1(hashes.SHA256()),
        salt_length=padding.PSS.MAX_LENGTH,
    )


def _oaep_padding() -> padding.OAEP:
    """Standard OAEP padding for RSA key encryption (SHA-256)."""
    return padding.OAEP(
        mgf=padding.MGF1(algorithm=hashes.SHA256()),
        algorithm=hashes.SHA256(),
        label=None,
    )


# ---------------------------------------------------------------------------
# RSASigner
# ---------------------------------------------------------------------------

class RSASigner:
    """RSA-2048 digital signatures and key operations."""

    KEY_SIZE = 2048
    PUBLIC_EXPONENT = 65537

    @staticmethod
    def generate_key_pair() -> tuple[bytes, bytes]:
        """
        Generate RSA-2048 key pair.

        Returns:
            (private_key_pem, public_key_pem) — both as bytes in PEM format
        """
        private_key = rsa.generate_private_key(
            public_exponent=RSASigner.PUBLIC_EXPONENT,
            key_size=RSASigner.KEY_SIZE,
        )
        private_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        )
        public_pem = private_key.public_key().public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        return private_pem, public_pem

    @staticmethod
    def sign(data: bytes, private_key_pem: bytes) -> bytes:
        """
        Sign data with RSA private key using PSS padding + SHA-256.

        Args:
            data: Bytes to sign (typically a hash digest)
            private_key_pem: RSA-2048 private key in PEM format

        Returns:
            Signature bytes (256 bytes for RSA-2048)
        """
        private_key = _load_private_key_obj(private_key_pem)
        return private_key.sign(data, _pss_padding(), hashes.SHA256())

    @staticmethod
    def verify(data: bytes, signature: bytes, public_key_pem: bytes) -> bool:
        """
        Verify RSA signature.

        Args:
            data: The original bytes that were signed
            signature: Signature bytes to verify
            public_key_pem: RSA-2048 public key in PEM format

        Returns:
            True if signature is valid, False otherwise (never raises)
        """
        try:
            public_key = _load_public_key_obj(public_key_pem)
            public_key.verify(signature, data, _pss_padding(), hashes.SHA256())
            return True
        except Exception:
            return False

    @staticmethod
    def encrypt_key(aes_key: bytes, public_key_pem: bytes) -> bytes:
        """
        Wrap an AES key with an RSA public key (OAEP padding).

        Used for secure per-center key delivery (D-012). The wrapped key
        can only be unwrapped by the holder of the matching private key.

        Args:
            aes_key: AES key bytes to wrap (typically 32 bytes)
            public_key_pem: Recipient's RSA-2048 public key in PEM format

        Returns:
            RSA-OAEP encrypted AES key (256 bytes for RSA-2048)
        """
        public_key = _load_public_key_obj(public_key_pem)
        return public_key.encrypt(aes_key, _oaep_padding())

    @staticmethod
    def decrypt_key(encrypted_key: bytes, private_key_pem: bytes) -> bytes:
        """
        Unwrap an RSA-OAEP encrypted AES key with the matching private key.

        Args:
            encrypted_key: RSA-OAEP encrypted AES key bytes
            private_key_pem: RSA-2048 private key in PEM format (matching the
                             public key used for encryption)

        Returns:
            Plaintext AES key bytes

        Raises:
            ValueError: If decryption fails (wrong key or tampered ciphertext)
        """
        try:
            private_key = _load_private_key_obj(private_key_pem)
            return private_key.decrypt(encrypted_key, _oaep_padding())
        except Exception as e:
            raise ValueError(f"RSA key decryption failed: {e}") from e

    @staticmethod
    def load_private_key(path: str) -> bytes:
        """
        Load RSA private key from PEM file.

        Args:
            path: Filesystem path to the PEM file

        Returns:
            PEM bytes

        Raises:
            FileNotFoundError: If file does not exist
        """
        return Path(path).read_bytes()

    @staticmethod
    def load_public_key(path: str) -> bytes:
        """
        Load RSA public key from PEM file.

        Args:
            path: Filesystem path to the PEM file

        Returns:
            PEM bytes

        Raises:
            FileNotFoundError: If file does not exist
        """
        return Path(path).read_bytes()
