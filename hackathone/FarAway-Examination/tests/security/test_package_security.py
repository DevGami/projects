"""
Security tests — Package Delivery (Module 02).

Covers:
  T-001: Correct key decrypts; wrong key raises InvalidTag
  T-002: Tampered encrypted payload → signature verification fails
  T-003: Tampered signature → verify() returns False
  T-004: Center A's wrapped key cannot decrypt for center B (key isolation)
  T-005: Two encryptions of same plaintext produce different ciphertext (nonce uniqueness)
  T-006: Package without key is completely opaque (cannot brute-force without AES key)
"""

from __future__ import annotations

import base64
import json

import pytest
from cryptography.exceptions import InvalidTag

from shared.crypto.aes import AESCipher
from shared.crypto.hashing import HashUtils
from shared.crypto.rsa import RSASigner


@pytest.fixture(scope="module")
def server_keys():
    return RSASigner.generate_key_pair()


@pytest.fixture(scope="module")
def center_a_keys():
    return RSASigner.generate_key_pair()


@pytest.fixture(scope="module")
def center_b_keys():
    return RSASigner.generate_key_pair()


# ============================================================
# T-001: AES key correctness
# ============================================================


class TestT001KeyCorrectness:
    """T-001: Correct key decrypts; wrong key raises InvalidTag."""

    def test_correct_key_decrypts_package(self, center_a_keys):
        """Package encrypted with center A's public key decrypts with center A's private key."""
        center_private_pem, center_public_pem = center_a_keys
        aes_key = AESCipher.generate_key()
        manifest = json.dumps({"exam_id": "exam-001", "questions": ["q1", "q2"]}).encode()

        # Encrypt package with AES
        ciphertext, nonce, tag = AESCipher.encrypt(manifest, aes_key)
        # Wrap AES key with center public key
        wrapped_key = RSASigner.encrypt_key(aes_key, center_public_pem)

        # Center unwraps AES key and decrypts
        recovered_key = RSASigner.decrypt_key(wrapped_key, center_private_pem)
        plaintext = AESCipher.decrypt(ciphertext, recovered_key, nonce, tag)

        assert plaintext == manifest

    def test_wrong_aes_key_raises_invalid_tag(self):
        """Decrypting with a wrong AES key must raise InvalidTag."""
        correct_key = AESCipher.generate_key()
        wrong_key = AESCipher.generate_key()
        ciphertext, nonce, tag = AESCipher.encrypt(b"exam manifest", correct_key)

        with pytest.raises(InvalidTag):
            AESCipher.decrypt(ciphertext, wrong_key, nonce, tag)


# ============================================================
# T-002: Tampered payload signature detection
# ============================================================


class TestT002TamperedPayload:
    """T-002: Tampered encrypted payload → signature verification fails."""

    def test_tampered_payload_fails_hash_check(self, server_keys):
        """Modifying the encrypted payload changes the SHA-256 hash — signature mismatch."""
        private_pem, public_pem = server_keys
        aes_key = AESCipher.generate_key()
        ciphertext, nonce, tag = AESCipher.encrypt(b"exam manifest", aes_key)

        package_hash = HashUtils.sha256(ciphertext)
        signature = RSASigner.sign(package_hash.encode("utf-8"), private_pem)

        # Tamper: flip one byte in ciphertext
        tampered_ciphertext = bytes([ciphertext[0] ^ 0xFF]) + ciphertext[1:]
        tampered_hash = HashUtils.sha256(tampered_ciphertext)

        # Signature over original hash does NOT match tampered hash
        valid = RSASigner.verify(tampered_hash.encode("utf-8"), signature, public_pem)
        assert valid is False

    def test_tampered_payload_also_breaks_aes_tag(self):
        """A tampered ciphertext also breaks the GCM auth tag (double protection)."""
        aes_key = AESCipher.generate_key()
        ciphertext, nonce, tag = AESCipher.encrypt(b"exam manifest", aes_key)

        tampered = bytes([ciphertext[0] ^ 0xFF]) + ciphertext[1:]
        with pytest.raises(InvalidTag):
            AESCipher.decrypt(tampered, aes_key, nonce, tag)


# ============================================================
# T-003: Tampered signature
# ============================================================


class TestT003TamperedSignature:
    """T-003: Tampered RSA signature → verify() returns False."""

    def test_single_bit_flip_fails_verification(self, server_keys):
        """Flipping one bit in the signature must fail PSS verification."""
        private_pem, public_pem = server_keys
        data = b"package_hash_value_abc123"
        signature = RSASigner.sign(data, private_pem)

        # Flip a bit in the middle of the signature
        idx = len(signature) // 2
        tampered = signature[:idx] + bytes([signature[idx] ^ 0x01]) + signature[idx + 1:]

        assert RSASigner.verify(data, tampered, public_pem) is False

    def test_truncated_signature_fails(self, server_keys):
        """A truncated signature must fail verification."""
        private_pem, public_pem = server_keys
        data = b"some data"
        signature = RSASigner.sign(data, private_pem)
        truncated = signature[:128]

        assert RSASigner.verify(data, truncated, public_pem) is False

    def test_completely_different_signature_fails(self, server_keys, center_a_keys):
        """A signature from a different key must fail verification."""
        _, server_public_pem = server_keys
        center_private_pem, _ = center_a_keys
        data = b"package_hash"
        wrong_signature = RSASigner.sign(data, center_private_pem)

        assert RSASigner.verify(data, wrong_signature, server_public_pem) is False


# ============================================================
# T-004: Key Isolation
# ============================================================


class TestT004KeyIsolation:
    """T-004: Center A's wrapped key cannot decrypt for center B."""

    def test_center_b_cannot_unwrap_center_a_key(self, center_a_keys, center_b_keys):
        """AES key wrapped for center A must fail unwrapping by center B."""
        _, center_a_public = center_a_keys
        center_b_private, _ = center_b_keys

        aes_key = AESCipher.generate_key()
        wrapped_for_a = RSASigner.encrypt_key(aes_key, center_a_public)

        with pytest.raises(ValueError, match="RSA key decryption failed"):
            RSASigner.decrypt_key(wrapped_for_a, center_b_private)

    def test_two_centers_get_different_wrapped_keys(self, center_a_keys, center_b_keys):
        """The same AES key wrapped for two centers produces different ciphertext."""
        _, center_a_public = center_a_keys
        _, center_b_public = center_b_keys

        aes_key = AESCipher.generate_key()
        wrapped_a = RSASigner.encrypt_key(aes_key, center_a_public)
        wrapped_b = RSASigner.encrypt_key(aes_key, center_b_public)

        assert wrapped_a != wrapped_b

    def test_each_center_only_decrypts_own_key(self, center_a_keys, center_b_keys):
        """Center A and B each correctly unwrap their own copy of the same AES key."""
        center_a_private, center_a_public = center_a_keys
        center_b_private, center_b_public = center_b_keys

        aes_key = AESCipher.generate_key()
        wrapped_a = RSASigner.encrypt_key(aes_key, center_a_public)
        wrapped_b = RSASigner.encrypt_key(aes_key, center_b_public)

        recovered_a = RSASigner.decrypt_key(wrapped_a, center_a_private)
        recovered_b = RSASigner.decrypt_key(wrapped_b, center_b_private)

        assert recovered_a == aes_key
        assert recovered_b == aes_key


# ============================================================
# T-005: Nonce Uniqueness
# ============================================================


class TestT005NonceUniqueness:
    """T-005: Encryption of the same data must always produce unique ciphertexts."""

    def test_same_plaintext_different_nonce(self):
        """Two encryptions of the same data produce different nonces."""
        key = AESCipher.generate_key()
        plaintext = b"same exam manifest content"

        _, nonce1, _ = AESCipher.encrypt(plaintext, key)
        _, nonce2, _ = AESCipher.encrypt(plaintext, key)

        assert nonce1 != nonce2

    def test_same_plaintext_different_ciphertext(self):
        """Two encryptions of the same data produce different ciphertext."""
        key = AESCipher.generate_key()
        plaintext = b"same exam manifest content"

        ct1, _, _ = AESCipher.encrypt(plaintext, key)
        ct2, _, _ = AESCipher.encrypt(plaintext, key)

        assert ct1 != ct2

    def test_100_encryptions_all_unique_nonces(self):
        """100 consecutive encryptions must all produce unique nonces."""
        key = AESCipher.generate_key()
        nonces = set()
        for _ in range(100):
            _, nonce, _ = AESCipher.encrypt(b"data", key)
            nonces.add(nonce)
        assert len(nonces) == 100


# ============================================================
# T-006: Package Opacity
# ============================================================


class TestT006PackageOpacity:
    """T-006: Without the AES key, the encrypted package must be completely opaque."""

    def test_encrypted_payload_not_json_parseable(self):
        """Encrypted payload should not be valid JSON (opaque)."""
        key = AESCipher.generate_key()
        manifest = json.dumps({"exam_id": "exam-001", "secrets": "sensitive"}).encode()
        ciphertext, _, _ = AESCipher.encrypt(manifest, key)

        ciphertext_b64 = base64.b64encode(ciphertext).decode()
        try:
            parsed = json.loads(ciphertext_b64)
            # If it parsed (extremely unlikely), check it doesn't reveal exam content
            assert "exam_id" not in str(parsed)
        except (json.JSONDecodeError, UnicodeDecodeError):
            pass  # Expected: encrypted data is not valid JSON

    def test_content_not_visible_in_ciphertext(self):
        """Known plaintext strings should NOT appear in the ciphertext."""
        key = AESCipher.generate_key()
        secret = b"TOP_SECRET_EXAM_CONTENT"
        ciphertext, _, _ = AESCipher.encrypt(secret, key)
        assert b"TOP_SECRET_EXAM_CONTENT" not in ciphertext
        assert secret not in ciphertext
