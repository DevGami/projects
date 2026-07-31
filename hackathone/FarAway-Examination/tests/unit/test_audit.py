"""
Unit Tests — Module 07: Cryptographic Audit Ledger

Tests for:
  - shared/audit/chain_verifier.py (ChainVerifier)
  - shared/audit/hash_chain.py (HashChain)
  - shared/audit/event_logger.py (EventLogger)
  - server/app/schemas/audit.py (EventType enum, schema validation)

All tests are pure Python — no database, no FastAPI, no async required.

Coverage targets:
  - ChainVerifier.verify(): all branches (empty, valid, each failure mode)
  - HashChain.append(): chain progression
  - EventLogger.create_event(): payload hashing
  - EventType enum: all 14+ types defined
"""

import hashlib
import json
import time

import pytest

from shared.audit.chain_verifier import GENESIS_HASH, ChainVerifier
from shared.audit.event_logger import EventLogger
from shared.audit.hash_chain import HashChain
from shared.crypto.hashing import HashUtils


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_chain(num_events: int) -> list[dict]:
    """
    Build a valid hash-chained list of event dicts.

    Mirrors the exact formula used by HashChain.append() and AuditService.log_event().
    """
    chain = HashChain()
    events = []
    for i in range(1, num_events + 1):
        payload = {"index": i, "data": f"event-{i}"}
        payload_hash = HashUtils.sha256_json(payload)
        event_hash = chain.append(sequence=i, payload_hash=payload_hash)

        events.append({
            "id": f"event-id-{i}",
            "sequence": i,
            "payload": payload,
            "payload_hash": payload_hash,
            "previous_hash": GENESIS_HASH if i == 1 else events[-1]["event_hash"],
            "event_hash": event_hash,
        })

    # Rebuild correctly: ChainVerifier needs previous_hash = prior event_hash
    # The above has a bug for i>1 since chain.previous_hash advances.
    # Rebuild cleanly:
    return _build_clean_chain(num_events)


def _build_clean_chain(num_events: int) -> list[dict]:
    """Build a clean, correctly-linked hash chain."""
    events = []
    prev_hash = GENESIS_HASH

    for i in range(1, num_events + 1):
        payload = {"index": i, "data": f"event-{i}"}
        payload_hash = HashUtils.sha256_json(payload)

        data = f"{i}{payload_hash}{prev_hash}"
        event_hash = hashlib.sha256(data.encode("utf-8")).hexdigest()

        events.append({
            "id": f"event-id-{i}",
            "sequence": i,
            "payload": payload,
            "payload_hash": payload_hash,
            "previous_hash": prev_hash,
            "event_hash": event_hash,
        })

        prev_hash = event_hash

    return events


# ---------------------------------------------------------------------------
# ChainVerifier — Core Verification Tests
# ---------------------------------------------------------------------------

class TestChainVerifierEmpty:
    """Edge case: empty chain."""

    def test_empty_chain_is_valid(self):
        """An empty event list should report is_valid=True."""
        result = ChainVerifier.verify([])
        assert result["is_valid"] is True
        assert result["total_events"] == 0
        assert result["verified_events"] == 0
        assert result["first_broken_at_sequence"] is None
        assert "empty" in result["message"].lower()

    def test_empty_chain_has_no_broken_link(self):
        """Empty chain should have no broken event info."""
        result = ChainVerifier.verify([])
        assert result["broken_event_id"] is None
        assert result["failure_reason"] is None


class TestChainVerifierValidChains:
    """Valid chain verification."""

    def test_single_event_chain_is_valid(self):
        """A chain with one event (genesis) should verify correctly."""
        events = _build_clean_chain(1)
        result = ChainVerifier.verify(events)
        assert result["is_valid"] is True
        assert result["total_events"] == 1
        assert result["verified_events"] == 1

    def test_chain_of_3_is_valid(self):
        """3-event chain should pass all three checks per event."""
        events = _build_clean_chain(3)
        result = ChainVerifier.verify(events)
        assert result["is_valid"] is True
        assert result["total_events"] == 3
        assert result["verified_events"] == 3

    def test_chain_of_100_is_valid(self):
        """100-event chain verifies correctly."""
        events = _build_clean_chain(100)
        result = ChainVerifier.verify(events)
        assert result["is_valid"] is True
        assert result["total_events"] == 100

    def test_valid_chain_message_mentions_count(self):
        """Verification message should mention the number of events verified."""
        events = _build_clean_chain(5)
        result = ChainVerifier.verify(events)
        assert "5" in result["message"]

    def test_genesis_event_has_zero_previous_hash(self):
        """First event's previous_hash must be 64 zero characters."""
        events = _build_clean_chain(1)
        assert events[0]["previous_hash"] == "0" * 64
        result = ChainVerifier.verify(events)
        assert result["is_valid"] is True


class TestChainVerifierTamperingDetection:
    """Tamper detection — the core security guarantee (T-009)."""

    def test_modified_payload_breaks_chain(self):
        """Changing payload content should fail payload_hash check."""
        events = _build_clean_chain(5)
        # Tamper event at sequence 3
        events[2]["payload"] = {"index": 3, "data": "TAMPERED_DATA"}
        # payload_hash is now wrong for modified payload

        result = ChainVerifier.verify(events)
        assert result["is_valid"] is False
        assert result["first_broken_at_sequence"] == 3
        assert result["failure_reason"] == "payload_hash_mismatch"

    def test_modified_payload_hash_breaks_chain(self):
        """Directly changing the stored payload_hash should fail event_hash check."""
        events = _build_clean_chain(5)
        events[2]["payload_hash"] = "a" * 64  # Corrupt the stored hash

        result = ChainVerifier.verify(events)
        assert result["is_valid"] is False
        assert result["first_broken_at_sequence"] == 3

    def test_modified_event_hash_breaks_chain(self):
        """Directly changing the stored event_hash should break the next event's prev link."""
        events = _build_clean_chain(5)
        events[2]["event_hash"] = "deadbeef" * 8  # Corrupt event 3's hash

        result = ChainVerifier.verify(events)
        assert result["is_valid"] is False
        # Event 4's previous_hash won't match the tampered event 3 hash
        # OR event 3's own recomputed hash won't match stored
        assert result["first_broken_at_sequence"] in [3, 4]

    def test_modified_previous_hash_breaks_chain(self):
        """Changing a previous_hash field breaks the chain link."""
        events = _build_clean_chain(5)
        events[3]["previous_hash"] = "b" * 64  # Corrupt chain link at event 4

        result = ChainVerifier.verify(events)
        assert result["is_valid"] is False
        assert result["first_broken_at_sequence"] == 4
        assert result["failure_reason"] in ["previous_hash_mismatch", "event_hash_mismatch"]

    def test_deleted_event_breaks_chain(self):
        """Removing an event from the middle should break previous_hash continuity."""
        events = _build_clean_chain(5)
        # Remove event at sequence 3 (index 2)
        events_with_gap = events[:2] + events[3:]  # Sequences: 1,2,4,5

        result = ChainVerifier.verify(events_with_gap)
        assert result["is_valid"] is False
        # Event 4's previous_hash expects event 3's hash, not event 2's
        assert result["first_broken_at_sequence"] == 4

    def test_reordered_events_break_chain(self):
        """
        Swapping payload content between two events should break the chain.

        Note: ChainVerifier sorts events by sequence number before verifying.
        So swapping the entire dict (including sequence) gets re-sorted back.
        Instead, we test the realistic attack: an attacker swaps the PAYLOAD
        of two events (to change what's recorded) while keeping sequence numbers
        intact. This is detectable because the payload_hash won't match.
        """
        events = _build_clean_chain(5)
        # Realistic attack: swap the PAYLOAD content between events 2 and 3
        # (keeping sequence numbers, so sort won't undo this)
        events[1]["payload"], events[2]["payload"] = events[2]["payload"], events[1]["payload"]
        # payload_hash fields are now wrong for the swapped payloads

        result = ChainVerifier.verify(events)
        assert result["is_valid"] is False

    def test_tamper_first_event_breaks_everything(self):
        """Tampering with the genesis event should break the entire chain."""
        events = _build_clean_chain(10)
        events[0]["payload"] = {"injected": "by attacker"}

        result = ChainVerifier.verify(events)
        assert result["is_valid"] is False
        assert result["first_broken_at_sequence"] == 1

    def test_verify_reports_exact_broken_sequence(self):
        """Verifier must return the exact sequence where the break occurred."""
        events = _build_clean_chain(10)
        events[6]["payload_hash"] = "f" * 64  # Tamper event 7 (0-indexed: 6)

        result = ChainVerifier.verify(events)
        assert result["first_broken_at_sequence"] == 7

    def test_verify_reports_broken_event_id(self):
        """Verifier must include the event ID in the result."""
        events = _build_clean_chain(5)
        events[2]["payload_hash"] = "0" * 64

        result = ChainVerifier.verify(events)
        assert result["broken_event_id"] == "event-id-3"

    def test_injected_event_breaks_chain(self):
        """Inserting a fake event into the chain should break hash links."""
        events = _build_clean_chain(5)
        # Inject a foreign event between sequence 2 and 3
        fake_event = {
            "id": "fake-event",
            "sequence": 99,  # Out-of-sequence
            "payload": {"injected": True},
            "payload_hash": HashUtils.sha256_json({"injected": True}),
            "previous_hash": events[1]["event_hash"],  # Links to event 2
            "event_hash": "fake" * 16,  # Wrong hash
        }
        events_with_injection = events[:2] + [fake_event] + events[2:]

        result = ChainVerifier.verify(events_with_injection)
        assert result["is_valid"] is False


class TestChainVerifierEdgeCases:
    """Edge cases and boundary conditions."""

    def test_verify_with_string_payload(self):
        """ChainVerifier should handle payload stored as JSON string."""
        payload = {"key": "value"}
        payload_hash = HashUtils.sha256_json(payload)

        events = [{
            "id": "evt-1",
            "sequence": 1,
            "payload": json.dumps(payload, sort_keys=True, separators=(",", ":")),  # String!
            "payload_hash": payload_hash,
            "previous_hash": GENESIS_HASH,
            "event_hash": hashlib.sha256(
                f"1{payload_hash}{GENESIS_HASH}".encode("utf-8")
            ).hexdigest(),
        }]

        result = ChainVerifier.verify(events)
        assert result["is_valid"] is True

    def test_verify_with_dict_payload(self):
        """ChainVerifier should handle payload as Python dict."""
        events = _build_clean_chain(2)
        result = ChainVerifier.verify(events)
        assert result["is_valid"] is True

    def test_unsorted_events_are_sorted_by_sequence(self):
        """ChainVerifier should sort events by sequence before verifying."""
        events = _build_clean_chain(5)
        # Shuffle the list
        shuffled = events[4:] + events[:4]  # Put last event first

        result = ChainVerifier.verify(shuffled)
        # Should still be valid after internal sort
        assert result["is_valid"] is True


# ---------------------------------------------------------------------------
# HashChain — Low-level chain mechanics
# ---------------------------------------------------------------------------

class TestHashChain:
    """Tests for shared/audit/hash_chain.py."""

    def test_initial_previous_hash_is_genesis(self):
        """New chain should start with 64 zeros as genesis hash."""
        chain = HashChain()
        assert chain.previous_hash == "0" * 64

    def test_append_returns_hex_hash(self):
        """append() should return a 64-character hex string."""
        chain = HashChain()
        result = chain.append(sequence=1, payload_hash="a" * 64)
        assert isinstance(result, str)
        assert len(result) == 64
        assert all(c in "0123456789abcdef" for c in result)

    def test_chain_advances_previous_hash(self):
        """After append(), previous_hash should equal the returned event_hash."""
        chain = HashChain()
        hash1 = chain.append(sequence=1, payload_hash="a" * 64)
        assert chain.previous_hash == hash1

        hash2 = chain.append(sequence=2, payload_hash="b" * 64)
        assert chain.previous_hash == hash2

    def test_chain_length_increments(self):
        """Length property should track appended events."""
        chain = HashChain()
        assert chain.length == 0
        chain.append(1, "a" * 64)
        assert chain.length == 1
        chain.append(2, "b" * 64)
        assert chain.length == 2

    def test_chain_is_deterministic(self):
        """Same inputs always produce same hash."""
        chain1 = HashChain()
        chain2 = HashChain()
        h1 = chain1.append(1, "a" * 64)
        h2 = chain2.append(1, "a" * 64)
        assert h1 == h2

    def test_different_payload_produces_different_hash(self):
        """Different payload_hash inputs produce different event hashes."""
        chain1 = HashChain()
        chain2 = HashChain()
        h1 = chain1.append(1, "a" * 64)
        h2 = chain2.append(1, "b" * 64)
        assert h1 != h2

    def test_custom_genesis_hash(self):
        """HashChain should accept custom genesis hash."""
        custom_genesis = "f" * 64
        chain = HashChain(genesis_hash=custom_genesis)
        assert chain.previous_hash == custom_genesis


# ---------------------------------------------------------------------------
# EventLogger — Structured event creation
# ---------------------------------------------------------------------------

class TestEventLogger:
    """Tests for shared/audit/event_logger.py."""

    def test_create_event_returns_required_fields(self):
        """create_event() must return all required fields."""
        logger = EventLogger()
        event = logger.create_event(
            event_type=EventLogger.CANDIDATE_AUTHENTICATED,
            actor_id="candidate-123",
            payload={"method": "qr", "score": 0.95},
        )
        assert "event_type" in event
        assert "actor_id" in event
        assert "payload" in event
        assert "payload_hash" in event
        assert "timestamp" in event

    def test_payload_hash_is_sha256_of_payload(self):
        """payload_hash in the event must match SHA-256 of canonical JSON."""
        logger = EventLogger()
        payload = {"question_id": "q-1", "content_hash": "abc123"}
        event = logger.create_event(
            event_type=EventLogger.QUESTION_CREATED,
            actor_id="admin-1",
            payload=payload,
        )
        expected_hash = HashUtils.sha256_json(payload)
        assert event["payload_hash"] == expected_hash

    def test_timestamp_is_iso_format(self):
        """Timestamp should be a valid ISO 8601 string with UTC timezone."""
        logger = EventLogger()
        event = logger.create_event(
            event_type=EventLogger.EXAM_SUBMITTED,
            actor_id="candidate-42",
            payload={},
        )
        ts = event["timestamp"]
        assert "T" in ts  # ISO format separator
        assert "+" in ts or "Z" in ts or ts.endswith("+00:00")

    def test_event_type_constants_defined(self):
        """All required event type constants should be defined on EventLogger."""
        required = [
            "QUESTION_CREATED", "QUESTION_MODIFIED", "PACKAGE_GENERATED",
            "PACKAGE_DISTRIBUTED", "KEY_RELEASED", "CANDIDATE_AUTHENTICATED",
            "ANSWER_SUBMITTED", "EXAM_SUBMITTED", "SESSION_RECOVERED",
            "ANOMALY_DETECTED",
        ]
        for event_type in required:
            assert hasattr(EventLogger, event_type), (
                f"EventLogger is missing constant: {event_type}"
            )

    def test_same_payload_produces_same_hash(self):
        """Payload hashing must be deterministic regardless of dict insertion order."""
        logger = EventLogger()
        payload_a = {"b": 2, "a": 1}
        payload_b = {"a": 1, "b": 2}  # Different order, same content

        event_a = logger.create_event("QUESTION_CREATED", "user-1", payload_a)
        event_b = logger.create_event("QUESTION_CREATED", "user-1", payload_b)

        assert event_a["payload_hash"] == event_b["payload_hash"]


# ---------------------------------------------------------------------------
# EventType Enum — Schema validation
# ---------------------------------------------------------------------------

class TestEventTypeEnum:
    """Tests for server/app/schemas/audit.py EventType enum."""

    def test_all_14_module_spec_event_types_defined(self):
        """All 14 event types specified in Module07_AuditLedger.md must exist."""
        from server.app.schemas.audit import EventType

        required = [
            "QUESTION_CREATED", "QUESTION_MODIFIED", "EXAM_COMPILED",
            "PACKAGE_GENERATED", "PACKAGE_DISTRIBUTED", "KEY_RELEASED",
            "CANDIDATE_AUTHENTICATED", "AUTH_FAILED", "EXAM_STARTED",
            "ANSWER_SUBMITTED", "EXAM_SUBMITTED", "ANOMALY_DETECTED",
            "SUPERVISOR_OVERRIDE", "RECOVERY_INITIATED",
        ]
        defined_values = {e.value for e in EventType}
        for event_type in required:
            assert event_type in defined_values, (
                f"EventType enum missing required type: {event_type}"
            )

    def test_event_type_is_string_enum(self):
        """EventType values should be strings (usable directly as API values)."""
        from server.app.schemas.audit import EventType
        assert EventType.CANDIDATE_AUTHENTICATED == "CANDIDATE_AUTHENTICATED"


# ---------------------------------------------------------------------------
# LogEventRequest — Pydantic schema validation
# ---------------------------------------------------------------------------

class TestLogEventRequest:
    """Validate LogEventRequest schema."""

    def test_valid_request(self):
        """A well-formed request should pass validation."""
        from server.app.schemas.audit import LogEventRequest

        req = LogEventRequest(
            event_type="CANDIDATE_AUTHENTICATED",
            actor_id="user-uuid-123",
            payload={"candidate_id": "c-1", "method": "qr", "score": 0.95},
            exam_id="exam-uuid-456",
            actor_role="candidate",
            target_id="c-1",
        )
        assert req.event_type == "CANDIDATE_AUTHENTICATED"
        assert req.exam_id == "exam-uuid-456"

    def test_optional_fields_default_to_none(self):
        """exam_id, actor_role, target_id should default to None."""
        from server.app.schemas.audit import LogEventRequest

        req = LogEventRequest(
            event_type="EXAM_COMPILED",
            actor_id="admin-1",
            payload={"exam_id": "e-1"},
        )
        assert req.exam_id is None
        assert req.actor_role is None
        assert req.target_id is None

    def test_missing_required_fields_raises(self):
        """Missing event_type, actor_id, or payload should raise ValidationError."""
        from pydantic import ValidationError
        from server.app.schemas.audit import LogEventRequest

        with pytest.raises(ValidationError):
            LogEventRequest(actor_id="user-1", payload={})  # Missing event_type

    def test_payload_must_be_dict(self):
        """payload must be a dict."""
        from pydantic import ValidationError
        from server.app.schemas.audit import LogEventRequest

        with pytest.raises(ValidationError):
            LogEventRequest(
                event_type="QUESTION_CREATED",
                actor_id="user-1",
                payload="not a dict",  # type: ignore
            )


# ---------------------------------------------------------------------------
# Performance Test
# ---------------------------------------------------------------------------

class TestChainVerifierPerformance:
    """Performance — Module spec requires 10,000 events < 5 seconds."""

    def test_verify_10000_events_under_5_seconds(self):
        """Chain verification of 10,000 events must complete in under 5 seconds."""
        events = _build_clean_chain(10_000)

        start = time.monotonic()
        result = ChainVerifier.verify(events)
        elapsed = time.monotonic() - start

        assert result["is_valid"] is True
        assert result["total_events"] == 10_000
        assert elapsed < 5.0, (
            f"Chain verification of 10,000 events took {elapsed:.2f}s (limit: 5s)"
        )


# ---------------------------------------------------------------------------
# ChainVerifier — verify_single_event() helper
# ---------------------------------------------------------------------------

class TestChainVerifierSingleEvent:
    """Tests for verify_single_event() helper method."""

    def test_verify_single_valid_event(self):
        """A valid event should return (True, '')."""
        events = _build_clean_chain(1)
        event = events[0]
        is_valid, reason = ChainVerifier.verify_single_event(event, GENESIS_HASH)
        assert is_valid is True
        assert reason == ""

    def test_verify_single_wrong_previous_hash(self):
        """Wrong expected_previous_hash should return previous_hash_mismatch."""
        events = _build_clean_chain(1)
        event = events[0]
        is_valid, reason = ChainVerifier.verify_single_event(event, "wrong" * 12 + "xxxx")
        assert is_valid is False
        assert reason == "previous_hash_mismatch"

    def test_verify_single_tampered_payload(self):
        """Tampered payload should return payload_hash_mismatch."""
        events = _build_clean_chain(1)
        event = events[0].copy()
        event["payload"] = {"tampered": True}  # payload_hash still points to original

        is_valid, reason = ChainVerifier.verify_single_event(event, GENESIS_HASH)
        assert is_valid is False
        assert reason == "payload_hash_mismatch"

    def test_verify_single_tampered_event_hash(self):
        """Tampered event_hash (but valid payload+prev) should return event_hash_mismatch."""
        events = _build_clean_chain(1)
        event = events[0].copy()
        event["event_hash"] = "corrupted" * 7 + "corrupt"  # 63 chars padded — wrong hash

        is_valid, reason = ChainVerifier.verify_single_event(event, GENESIS_HASH)
        assert is_valid is False
        assert reason == "event_hash_mismatch"


# ---------------------------------------------------------------------------
# ChainVerifier — malformed payload string path
# ---------------------------------------------------------------------------

class TestChainVerifierMalformedPayload:
    """Tests for malformed payload handling."""

    def test_malformed_json_string_payload_hashed_directly(self):
        """Non-JSON string payloads should be hashed as raw strings (not crash)."""
        # Compute what the hash would be for a raw string
        raw_string = "not valid json {{{ garbage"
        expected_hash = hashlib.sha256(raw_string.encode("utf-8")).hexdigest()

        result = ChainVerifier._recompute_payload_hash(raw_string)
        assert result == expected_hash

    def test_malformed_event_structure_returns_error(self):
        """Events with completely missing sequence key should return is_valid=False."""
        # Missing 'sequence' key — will cause sort to fail
        bad_events = [{"id": "bad", "payload": {}, "payload_hash": "a" * 64}]
        result = ChainVerifier.verify(bad_events)
        assert result["is_valid"] is False
        assert result["failure_reason"] == "malformed_event_structure"

