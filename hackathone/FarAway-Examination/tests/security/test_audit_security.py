"""
Security Tests — Module 07: Audit Chain Tamper Detection

Validates threat mitigations documented in the Threat Model:
  - T-009: Audit Chain Corruption — detect modified/deleted/injected events
  - T-008: Answer Tampering — audit trail binds to answer content
  - T-004: Key isolation — AES key is wrapped with center RSA key
  - T-004: Wrong key cannot unwrap AES key

These tests go beyond unit testing to validate end-to-end security guarantees.
All tests use the pure ChainVerifier (no DB required) for speed and determinism.
"""

import hashlib

import pytest

from shared.audit.chain_verifier import GENESIS_HASH, ChainVerifier
from shared.crypto.hashing import HashUtils


# ---------------------------------------------------------------------------
# Helper: Build a valid chain
# ---------------------------------------------------------------------------

def build_valid_chain(n: int, exam_id: str = "exam-1") -> list[dict]:
    """Build a valid hash chain of n events."""
    events = []
    prev_hash = GENESIS_HASH

    for i in range(1, n + 1):
        payload = {
            "exam_id": exam_id,
            "index": i,
            "event_type": "CANDIDATE_AUTHENTICATED",
        }
        payload_hash = HashUtils.sha256_json(payload)
        data = f"{i}{payload_hash}{prev_hash}"
        event_hash = hashlib.sha256(data.encode("utf-8")).hexdigest()

        events.append({
            "id": f"event-{i}",
            "sequence": i,
            "payload": payload,
            "payload_hash": payload_hash,
            "previous_hash": prev_hash,
            "event_hash": event_hash,
        })
        prev_hash = event_hash

    return events


# ---------------------------------------------------------------------------
# T-009: Audit Chain Corruption
# ---------------------------------------------------------------------------

class TestT009AuditChainCorruption:
    """
    T-009: Attacker modifies or deletes audit events to cover tracks.
    Category: Repudiation
    Impact: CRITICAL — Loss of accountability
    Residual Risk: LOW (full chain replacement is detectable if any copy survives)
    """

    def test_T009_modified_event_payload_detected(self):
        """
        THREAT: Attacker modifies payload data in audit log.
        MITIGATION: payload_hash mismatch detected during chain verification.
        """
        chain = build_valid_chain(10)

        # Attack: Modify a candidate auth event to hide the real score
        chain[4]["payload"] = {
            "exam_id": "exam-1",
            "index": 5,
            "event_type": "CANDIDATE_AUTHENTICATED",
            "override": "score=1.0",  # Injected by attacker
        }

        result = ChainVerifier.verify(chain)

        assert result["is_valid"] is False, "Modified payload must break the chain"
        assert result["first_broken_at_sequence"] == 5
        assert result["failure_reason"] == "payload_hash_mismatch"

    def test_T009_modified_payload_hash_field_detected(self):
        """
        THREAT: Attacker modifies event AND updates payload_hash to match,
        but cannot update event_hash without knowing the full chain state.
        MITIGATION: event_hash mismatch detected.
        """
        chain = build_valid_chain(8)

        # Attack: Update payload AND payload_hash but leave event_hash stale
        new_payload = {"exam_id": "exam-1", "index": 3, "modified_by": "attacker"}
        chain[2]["payload"] = new_payload
        chain[2]["payload_hash"] = HashUtils.sha256_json(new_payload)
        # event_hash is now stale (based on old payload_hash)

        result = ChainVerifier.verify(chain)

        assert result["is_valid"] is False, "Stale event_hash must break the chain"
        assert result["first_broken_at_sequence"] == 3

    def test_T009_deleted_event_detected(self):
        """
        THREAT: Attacker deletes an audit event to remove evidence of their action.
        MITIGATION: previous_hash chain link broken at the event following the gap.
        """
        chain = build_valid_chain(10)

        # Attack: Delete event at sequence 5
        chain_with_gap = chain[:4] + chain[5:]  # Sequences: 1,2,3,4,6,7,8,9,10

        result = ChainVerifier.verify(chain_with_gap)

        assert result["is_valid"] is False, "Deleted event must break the chain"
        assert result["first_broken_at_sequence"] == 6  # Event 6's prev_hash points to event 5

    def test_T009_multiple_events_deleted_detected(self):
        """
        THREAT: Attacker deletes a range of events.
        MITIGATION: Same — chain link broken at first event after the gap.
        """
        chain = build_valid_chain(15)

        # Delete events 5-9 (sequences 5 through 9)
        chain_pruned = chain[:4] + chain[9:]  # Sequences: 1,2,3,4,10,11,12,13,14,15

        result = ChainVerifier.verify(chain_pruned)

        assert result["is_valid"] is False, "Mass deletion must break the chain"

    def test_T009_injected_foreign_event_detected(self):
        """
        THREAT: Attacker injects a fake event into the chain
        to fabricate a false audit record.
        MITIGATION: Fake event's event_hash is computed incorrectly or
        its previous_hash doesn't match the expected chain state.
        """
        chain = build_valid_chain(6)

        # Attack: Craft a fake event with valid-looking fields but wrong hash
        fake_payload = {"exam_id": "exam-1", "fabricated": True, "candidate_id": "victim"}
        fake_payload_hash = HashUtils.sha256_json(fake_payload)
        fake_event = {
            "id": "attacker-injected-event",
            "sequence": 99,  # Out of sequence
            "payload": fake_payload,
            "payload_hash": fake_payload_hash,
            "previous_hash": chain[2]["event_hash"],  # Links to event 3
            "event_hash": "deadbeef" * 8,  # Cannot compute correct hash without chain state
        }

        chain_with_injection = chain[:3] + [fake_event] + chain[3:]

        result = ChainVerifier.verify(chain_with_injection)
        assert result["is_valid"] is False, "Injected event must break the chain"

    def test_T009_reordered_events_detected(self):
        """
        THREAT: Attacker swaps two events to change the chronological order
        (e.g., making a failed auth appear after a successful one).
        MITIGATION: payload_hash mismatch after payload content is swapped
        between two sequence positions.

        Note: ChainVerifier sorts by sequence number, so swapping full event
        dicts (including sequence) gets re-sorted back. The realistic attack
        is swapping payloads while keeping sequence numbers, which IS detected.
        """
        chain = build_valid_chain(8)

        # Realistic attack: swap PAYLOAD content between sequences 3 and 4
        # keeping sequence numbers so the sort doesn't undo this
        chain[2]["payload"], chain[3]["payload"] = chain[3]["payload"], chain[2]["payload"]
        # payload_hash fields are now stale — mismatch detected

        result = ChainVerifier.verify(chain)
        assert result["is_valid"] is False, "Swapped payload content must break the chain"

    def test_T009_full_chain_replacement_requires_knowing_genesis(self):
        """
        THREAT: Attacker replaces the ENTIRE chain with a fabricated one.
        MITIGATION: If the original genesis hash is known (from an external copy),
        the fabricated chain's genesis will differ.
        NOTE: This test verifies the attacker's fabricated chain is internally
        consistent (is_valid=True), but the genesis hash can be compared externally.
        """
        # Attacker builds a completely fresh fabricated chain
        fabricated = build_valid_chain(5, exam_id="exam-fake")

        # Fabricated chain is internally consistent
        result = ChainVerifier.verify(fabricated)
        assert result["is_valid"] is True  # Internally consistent, attacker succeeded

        # HOWEVER: The genesis event's previous_hash must be "0"*64
        # If the original chain's first event hash is known externally,
        # the fabricated chain's genesis differs.
        # External comparison is the production control (chain replication).
        assert fabricated[0]["previous_hash"] == "0" * 64


# ---------------------------------------------------------------------------
# T-008: Answer Tampering Detection
# ---------------------------------------------------------------------------

class TestT008AnswerTamperingDetection:
    """
    T-008: Center insider modifies answers in SQLite after exam.
    Mitigation: Every answer submission logged in hash chain.
    Residual Risk: LOW
    """

    def test_T008_answer_event_binds_to_answer_content(self):
        """
        Answer events must include a hash of the answer content.
        Changing the answer in the DB without updating the audit chain
        creates a detectable inconsistency.
        """
        # Simulate what AuditService does when an answer is submitted
        answer_payload = {
            "session_id": "session-42",
            "question_id": "q-001",
            "selected_option": 2,
            "answer_hash": HashUtils.sha256_json({"question_id": "q-001", "option": 2}),
        }

        payload_hash = HashUtils.sha256_json(answer_payload)

        # Build a 1-event chain for this answer submission
        data = f"1{payload_hash}{GENESIS_HASH}"
        event_hash = hashlib.sha256(data.encode("utf-8")).hexdigest()

        chain = [{
            "id": "answer-event-1",
            "sequence": 1,
            "payload": answer_payload,
            "payload_hash": payload_hash,
            "previous_hash": GENESIS_HASH,
            "event_hash": event_hash,
        }]

        # Chain verifies with original answer
        result = ChainVerifier.verify(chain)
        assert result["is_valid"] is True

        # Attack: Insider changes the answer in SQLite and
        # tries to update the audit payload to match
        tampered_payload = dict(answer_payload)
        tampered_payload["selected_option"] = 0  # Changed answer!
        chain[0]["payload"] = tampered_payload
        # payload_hash still has old value — mismatch!

        result_after_tamper = ChainVerifier.verify(chain)
        assert result_after_tamper["is_valid"] is False
        assert result_after_tamper["failure_reason"] == "payload_hash_mismatch"

    def test_T008_answer_hash_verification(self):
        """
        The answer_hash field in the payload acts as a secondary binding.
        If the answer content changes, the answer_hash embedded in the payload changes,
        which changes the payload_hash, which breaks the chain.
        """
        # Original answer
        original_answer = {"question_id": "q-5", "option": 3}
        original_hash = HashUtils.sha256_json(original_answer)

        payload = {
            "session_id": "s-1",
            "question_id": "q-5",
            "selected_option": 3,
            "answer_hash": original_hash,
        }
        payload_hash = HashUtils.sha256_json(payload)

        # Tampered answer (option changed from 3 to 1)
        tampered_answer = {"question_id": "q-5", "option": 1}
        tampered_hash = HashUtils.sha256_json(tampered_answer)

        assert original_hash != tampered_hash, (
            "Answer hash must differ for different options"
        )
        assert payload_hash != HashUtils.sha256_json({
            "session_id": "s-1",
            "question_id": "q-5",
            "selected_option": 1,  # Changed
            "answer_hash": tampered_hash,  # Would also change
        }), "Payload hash must change when answer changes"


# ---------------------------------------------------------------------------
# T-004: Key Isolation (AES key wrapped with RSA)
# ---------------------------------------------------------------------------

class TestT004KeyIsolation:
    """
    T-004: Key interception prevention.
    Mitigation: AES key encrypted with center's RSA public key.
    Tests use real RSA operations to verify the wrapping protocol.
    """

    def test_T004_aes_key_encrypted_with_center_rsa(self):
        """
        AES key must be wrapped (RSA-OAEP encrypted) before storage/transmission.
        The wrapped key should be different from the original key.
        """
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.asymmetric import padding, rsa

        # Generate a center RSA key pair
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
        )
        public_key = private_key.public_key()

        # AES key to protect
        import os
        aes_key = os.urandom(32)  # 256-bit

        # Wrap AES key with center's RSA public key
        encrypted_key = public_key.encrypt(
            aes_key,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None,
            ),
        )

        # Wrapped key is different from original
        assert encrypted_key != aes_key
        # Wrapped key is RSA-2048 size (256 bytes)
        assert len(encrypted_key) == 256

        # Unwrap with private key
        decrypted_key = private_key.decrypt(
            encrypted_key,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None,
            ),
        )
        assert decrypted_key == aes_key

    def test_T004_wrong_rsa_key_cannot_unwrap_aes_key(self):
        """
        THREAT: Attacker intercepts encrypted AES key and tries to decrypt
        with a different (wrong) RSA private key.
        MITIGATION: Decryption with wrong key raises an exception.
        """
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.asymmetric import padding, rsa

        import os

        # Legitimate center key pair
        legit_private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        legit_public = legit_private.public_key()

        # Attacker's key pair
        attacker_private = rsa.generate_private_key(public_exponent=65537, key_size=2048)

        aes_key = os.urandom(32)

        # Encrypt with legitimate center's public key
        encrypted_key = legit_public.encrypt(
            aes_key,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None,
            ),
        )

        # Attacker tries to decrypt with their own key — must fail
        with pytest.raises(Exception):  # ValueError or cryptography-specific exception
            attacker_private.decrypt(
                encrypted_key,
                padding.OAEP(
                    mgf=padding.MGF1(algorithm=hashes.SHA256()),
                    algorithm=hashes.SHA256(),
                    label=None,
                ),
            )


# ---------------------------------------------------------------------------
# Hash determinism security properties
# ---------------------------------------------------------------------------

class TestHashDeterminism:
    """
    Verify that the hash functions used in the audit chain have the
    security properties required for tamper detection.
    """

    def test_sha256_collision_resistance_different_inputs(self):
        """Different payloads must produce different hashes."""
        payload_a = {"event": "auth", "candidate": "alice", "score": 0.95}
        payload_b = {"event": "auth", "candidate": "alice", "score": 0.94}  # Different score

        hash_a = HashUtils.sha256_json(payload_a)
        hash_b = HashUtils.sha256_json(payload_b)

        assert hash_a != hash_b

    def test_sha256_canonical_json_deterministic(self):
        """Same data with different key ordering must produce same hash."""
        payload_1 = {"b": 2, "a": 1, "c": 3}
        payload_2 = {"c": 3, "a": 1, "b": 2}

        assert HashUtils.sha256_json(payload_1) == HashUtils.sha256_json(payload_2)

    def test_sha256_output_length_always_64_hex_chars(self):
        """SHA-256 output is always exactly 64 hex characters."""
        test_cases = [
            {},
            {"key": "value"},
            {"nested": {"deep": [1, 2, 3]}},
            {f"key_{i}": f"value_{i}" for i in range(100)},
        ]
        for payload in test_cases:
            h = HashUtils.sha256_json(payload)
            assert len(h) == 64, f"Hash should be 64 chars, got {len(h)} for {payload}"
            assert all(c in "0123456789abcdef" for c in h)

    def test_genesis_hash_is_64_zeros(self):
        """The genesis (initial) hash for the chain must be 64 zero characters."""
        assert GENESIS_HASH == "0" * 64
        assert len(GENESIS_HASH) == 64
