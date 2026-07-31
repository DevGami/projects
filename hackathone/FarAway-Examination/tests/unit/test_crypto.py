"""
Unit tests — shared/crypto (AES, RSA, hashing).

Tests the crypto primitives used throughout FortisExam for:
  - Package encryption (Module 02)
  - QR token signing (Module 03)
  - Answer hashing (Module 05)
  - Audit event hashing (Module 07)
"""

from __future__ import annotations

import os

import pytest
from cryptography.exceptions import InvalidTag

from shared.crypto.aes import AESCipher
from shared.crypto.hashing import HashUtils
from shared.crypto.rsa import RSASigner


# ============================================================
# AES-256-GCM Tests
# ============================================================


class TestAESCipher:
    """AES-256-GCM encryption/decryption tests."""

    def test_generate_key_returns_32_bytes(self):
        """generate_key() must return exactly 32 bytes."""
        key = AESCipher.generate_key()
        assert isinstance(key, bytes)
        assert len(key) == 32

    def test_generate_key_is_random(self):
        """Two generated keys must be different."""
        k1 = AESCipher.generate_key()
        k2 = AESCipher.generate_key()
        assert k1 != k2

    def test_encrypt_returns_three_components(self):
        """encrypt() must return (ciphertext, nonce, tag) tuple."""
        key = AESCipher.generate_key()
        result = AESCipher.encrypt(b"hello world", key)
        assert isinstance(result, tuple)
        assert len(result) == 3
        ciphertext, nonce, tag = result
        assert isinstance(ciphertext, bytes)
        assert isinstance(nonce, bytes)
        assert isinstance(tag, bytes)

    def test_nonce_is_12_bytes(self):
        """GCM nonce must be exactly 12 bytes."""
        key = AESCipher.generate_key()
        _, nonce, _ = AESCipher.encrypt(b"data", key)
        assert len(nonce) == 12

    def test_tag_is_16_bytes(self):
        """GCM authentication tag must be exactly 16 bytes."""
        key = AESCipher.generate_key()
        _, _, tag = AESCipher.encrypt(b"data", key)
        assert len(tag) == 16

    def test_encrypt_decrypt_roundtrip(self):
        """Encrypted data should decrypt to original plaintext."""
        key = AESCipher.generate_key()
        plaintext = b"The exam starts at 9 AM. AES-256-GCM rocks!"
        ciphertext, nonce, tag = AESCipher.encrypt(plaintext, key)
        recovered = AESCipher.decrypt(ciphertext, key, nonce, tag)
        assert recovered == plaintext

    def test_encrypt_empty_plaintext(self):
        """Empty plaintext should encrypt and decrypt correctly."""
        key = AESCipher.generate_key()
        ciphertext, nonce, tag = AESCipher.encrypt(b"", key)
        recovered = AESCipher.decrypt(ciphertext, key, nonce, tag)
        assert recovered == b""

    def test_encrypt_large_plaintext(self):
        """Large payload (1 MB) should encrypt and decrypt correctly."""
        key = AESCipher.generate_key()
        plaintext = os.urandom(1024 * 1024)  # 1 MB
        ciphertext, nonce, tag = AESCipher.encrypt(plaintext, key)
        recovered = AESCipher.decrypt(ciphertext, key, nonce, tag)
        assert recovered == plaintext

    def test_different_nonce_per_encryption(self):
        """Each encryption call must produce a unique nonce (no reuse)."""
        key = AESCipher.generate_key()
        plaintext = b"same data"
        _, nonce1, _ = AESCipher.encrypt(plaintext, key)
        _, nonce2, _ = AESCipher.encrypt(plaintext, key)
        assert nonce1 != nonce2

    def test_ciphertext_differs_due_to_unique_nonce(self):
        """Same plaintext + key but different nonce must produce different ciphertext."""
        key = AESCipher.generate_key()
        plaintext = b"same data"
        ct1, _, _ = AESCipher.encrypt(plaintext, key)
        ct2, _, _ = AESCipher.encrypt(plaintext, key)
        assert ct1 != ct2

    def test_tampered_ciphertext_raises_invalid_tag(self):
        """Modified ciphertext should raise InvalidTag."""
        key = AESCipher.generate_key()
        ciphertext, nonce, tag = AESCipher.encrypt(b"secret data", key)
        tampered = bytes([ciphertext[0] ^ 0xFF]) + ciphertext[1:]
        with pytest.raises(InvalidTag):
            AESCipher.decrypt(tampered, key, nonce, tag)

    def test_tampered_tag_raises_invalid_tag(self):
        """Modified authentication tag should raise InvalidTag."""
        key = AESCipher.generate_key()
        ciphertext, nonce, tag = AESCipher.encrypt(b"secret data", key)
        tampered_tag = bytes([tag[0] ^ 0xFF]) + tag[1:]
        with pytest.raises(InvalidTag):
            AESCipher.decrypt(ciphertext, key, nonce, tampered_tag)

    def test_wrong_key_raises_invalid_tag(self):
        """Decryption with wrong key should raise InvalidTag."""
        key1 = AESCipher.generate_key()
        key2 = AESCipher.generate_key()
        ciphertext, nonce, tag = AESCipher.encrypt(b"secret", key1)
        with pytest.raises(InvalidTag):
            AESCipher.decrypt(ciphertext, key2, nonce, tag)

    def test_invalid_key_size_raises_value_error(self):
        """Key that isn't 32 bytes should raise ValueError."""
        bad_key = b"too short"
        with pytest.raises(ValueError, match="32 bytes"):
            AESCipher.encrypt(b"data", bad_key)

    def test_invalid_nonce_size_raises_value_error(self):
        """Nonce that isn't 12 bytes should raise ValueError on decrypt."""
        key = AESCipher.generate_key()
        ciphertext, _, tag = AESCipher.encrypt(b"data", key)
        with pytest.raises(ValueError, match="12 bytes"):
            AESCipher.decrypt(ciphertext, key, b"short", tag)

    def test_decrypt_invalid_key_size_raises_value_error(self):
        """Decrypt with wrong key size should raise ValueError."""
        key = AESCipher.generate_key()
        ciphertext, nonce, tag = AESCipher.encrypt(b"data", key)
        with pytest.raises(ValueError, match="32 bytes"):
            AESCipher.decrypt(ciphertext, b"too-short-key", nonce, tag)


# ============================================================
# RSA-2048 Tests
# ============================================================


class TestRSASigner:
    """RSA-2048 signing/verification and key wrapping tests."""

    @pytest.fixture(scope="class")
    def key_pair(self):
        """Generate a fresh RSA-2048 key pair for the test class."""
        return RSASigner.generate_key_pair()

    @pytest.fixture(scope="class")
    def other_key_pair(self):
        """Generate a second RSA-2048 key pair (for mismatch tests)."""
        return RSASigner.generate_key_pair()

    def test_generate_key_pair_returns_pem_bytes(self, key_pair):
        """Key pair must be PEM-encoded bytes."""
        private_pem, public_pem = key_pair
        assert private_pem.startswith(b"-----BEGIN RSA PRIVATE KEY-----") or \
               private_pem.startswith(b"-----BEGIN PRIVATE KEY-----")
        assert public_pem.startswith(b"-----BEGIN PUBLIC KEY-----")

    def test_sign_returns_bytes(self, key_pair):
        """sign() must return bytes."""
        private_pem, _ = key_pair
        sig = RSASigner.sign(b"test data", private_pem)
        assert isinstance(sig, bytes)

    def test_sign_verify_roundtrip(self, key_pair):
        """Signed data should verify with matching public key."""
        private_pem, public_pem = key_pair
        data = b"FortisExam package hash: abc123"
        signature = RSASigner.sign(data, private_pem)
        assert RSASigner.verify(data, signature, public_pem) is True

    def test_wrong_key_fails_verification(self, key_pair, other_key_pair):
        """Signature should fail with a different public key."""
        private_pem, _ = key_pair
        _, other_public_pem = other_key_pair
        data = b"some data"
        signature = RSASigner.sign(data, private_pem)
        assert RSASigner.verify(data, signature, other_public_pem) is False

    def test_tampered_data_fails_verification(self, key_pair):
        """Tampered data should fail verification."""
        private_pem, public_pem = key_pair
        data = b"original data"
        signature = RSASigner.sign(data, private_pem)
        assert RSASigner.verify(b"tampered data", signature, public_pem) is False

    def test_tampered_signature_fails_verification(self, key_pair):
        """Corrupted signature bytes should fail verification."""
        private_pem, public_pem = key_pair
        data = b"some data"
        signature = RSASigner.sign(data, private_pem)
        bad_sig = bytes([signature[0] ^ 0xFF]) + signature[1:]
        assert RSASigner.verify(data, bad_sig, public_pem) is False

    def test_key_wrapping_roundtrip(self, key_pair):
        """AES key should survive RSA OAEP encrypt → decrypt."""
        private_pem, public_pem = key_pair
        aes_key = AESCipher.generate_key()
        wrapped = RSASigner.encrypt_key(aes_key, public_pem)
        unwrapped = RSASigner.decrypt_key(wrapped, private_pem)
        assert unwrapped == aes_key

    def test_wrong_private_key_fails_unwrap(self, key_pair, other_key_pair):
        """AES key wrapped with public key A cannot be unwrapped with private key B."""
        _, public_pem_a = key_pair
        private_pem_b, _ = other_key_pair
        aes_key = AESCipher.generate_key()
        wrapped = RSASigner.encrypt_key(aes_key, public_pem_a)
        with pytest.raises(ValueError, match="RSA key decryption failed"):
            RSASigner.decrypt_key(wrapped, private_pem_b)

    def test_key_file_load(self, tmp_path, key_pair):
        """load_private_key() and load_public_key() should read PEM files correctly."""
        private_pem, public_pem = key_pair
        priv_path = tmp_path / "test_private.pem"
        pub_path = tmp_path / "test_public.pem"
        priv_path.write_bytes(private_pem)
        pub_path.write_bytes(public_pem)

        loaded_private = RSASigner.load_private_key(str(priv_path))
        loaded_public = RSASigner.load_public_key(str(pub_path))

        assert loaded_private == private_pem
        assert loaded_public == public_pem

    def test_load_missing_file_raises(self, tmp_path):
        """Loading a non-existent key file should raise FileNotFoundError."""
        with pytest.raises(FileNotFoundError):
            RSASigner.load_private_key(str(tmp_path / "nonexistent.pem"))


# ============================================================
# HashUtils Tests
# ============================================================


class TestHashUtils:
    """SHA-256 hashing utility tests."""

    def test_sha256_returns_64_char_hex(self):
        """SHA-256 hex digest must be 64 characters."""
        result = HashUtils.sha256(b"hello")
        assert len(result) == 64
        assert all(c in "0123456789abcdef" for c in result)

    def test_sha256_is_deterministic(self):
        """Same input must always produce the same hash."""
        h1 = HashUtils.sha256(b"consistent input")
        h2 = HashUtils.sha256(b"consistent input")
        assert h1 == h2

    def test_sha256_different_inputs_differ(self):
        """Different inputs must produce different hashes."""
        assert HashUtils.sha256(b"abc") != HashUtils.sha256(b"abd")

    def test_sha256_json_is_deterministic(self):
        """sha256_json() must be deterministic regardless of key order."""
        d1 = {"b": 2, "a": 1}
        d2 = {"a": 1, "b": 2}
        assert HashUtils.sha256_json(d1) == HashUtils.sha256_json(d2)

    def test_sha256_json_different_dicts_differ(self):
        """Different dicts must produce different hashes."""
        assert HashUtils.sha256_json({"a": 1}) != HashUtils.sha256_json({"a": 2})

    def test_generate_nonce_is_random(self):
        """generate_nonce() must return different values each call."""
        n1 = HashUtils.generate_nonce()
        n2 = HashUtils.generate_nonce()
        assert n1 != n2

    def test_generate_nonce_default_length(self):
        """Default nonce (length=32) should be 64 hex characters."""
        nonce = HashUtils.generate_nonce()
        assert len(nonce) == 64
