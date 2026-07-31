"""Security tests — threat mitigation validation."""


class TestAuditChainTampering:
    """T-009: Audit chain corruption detection."""

    def test_modified_event_detected(self):
        """Modifying any event payload should break chain verification."""
        # TODO: Implement
        ...

    def test_deleted_event_detected(self):
        """Removing an event from the chain should be detectable."""
        # TODO: Implement
        ...


class TestQRAntiReplay:
    """T-007: QR token anti-replay."""

    def test_nonce_cannot_be_reused(self):
        """A used nonce should be rejected on second attempt."""
        # TODO: Implement
        ...


class TestEncryptionIntegrity:
    """T-008: Answer tampering detection."""

    def test_tampered_answer_detected(self):
        """Modified answer in DB should fail hash verification."""
        # TODO: Implement
        ...


class TestKeyIsolation:
    """T-004: Key interception prevention."""

    def test_aes_key_encrypted_with_center_rsa(self):
        """AES key should be wrapped with center's RSA public key."""
        # TODO: Implement
        ...

    def test_wrong_rsa_key_cannot_unwrap(self):
        """AES key should not be extractable with wrong RSA key."""
        # TODO: Implement
        ...
