"""Unit tests for shared/recovery/snapshot_manager.py."""

import json
from datetime import datetime, timezone, timedelta

import pytest

from shared.recovery.snapshot_manager import SnapshotManager


class TestSnapshotBuild:
    """Tests for SnapshotManager.build_snapshot()."""

    def test_build_snapshot_basic(self):
        """Build a snapshot with valid inputs."""
        answers = [
            {"question_id": "q1", "selected_option": "A", "answered_at": "2026-06-09T12:00:00Z"},
            {"question_id": "q2", "selected_option": "B", "answered_at": "2026-06-09T12:01:00Z"},
        ]
        snap = SnapshotManager.build_snapshot(
            session_id="s1",
            candidate_id="c1",
            answers=answers,
            current_question_index=1,
            remaining_seconds=1800,
        )
        assert snap["session_id"] == "s1"
        assert snap["candidate_id"] == "c1"
        assert snap["current_question_index"] == 1
        assert snap["remaining_seconds"] == 1800
        assert len(snap["snapshot_hash"]) == 64  # SHA-256 hex
        assert snap["answers_json"]  # non-empty
        assert snap["created_at"]
        assert snap["updated_at"]

    def test_build_snapshot_empty_answers(self):
        """Snapshot with no answers is valid (exam just started)."""
        snap = SnapshotManager.build_snapshot(
            session_id="s1", candidate_id="c1",
            answers=[], current_question_index=0, remaining_seconds=3600,
        )
        assert json.loads(snap["answers_json"]) == []
        assert snap["snapshot_hash"]

    def test_build_snapshot_zero_remaining(self):
        """Snapshot with 0 seconds remaining (time's up)."""
        snap = SnapshotManager.build_snapshot(
            session_id="s1", candidate_id="c1",
            answers=[], current_question_index=0, remaining_seconds=0,
        )
        assert snap["remaining_seconds"] == 0

    def test_build_snapshot_empty_session_id_raises(self):
        """Empty session_id raises ValueError."""
        with pytest.raises(ValueError, match="session_id"):
            SnapshotManager.build_snapshot(
                session_id="", candidate_id="c1",
                answers=[], current_question_index=0, remaining_seconds=100,
            )

    def test_build_snapshot_empty_candidate_id_raises(self):
        """Empty candidate_id raises ValueError."""
        with pytest.raises(ValueError, match="candidate_id"):
            SnapshotManager.build_snapshot(
                session_id="s1", candidate_id="",
                answers=[], current_question_index=0, remaining_seconds=100,
            )

    def test_build_snapshot_negative_remaining_raises(self):
        """Negative remaining_seconds raises ValueError."""
        with pytest.raises(ValueError, match="negative"):
            SnapshotManager.build_snapshot(
                session_id="s1", candidate_id="c1",
                answers=[], current_question_index=0, remaining_seconds=-1,
            )

    def test_build_snapshot_negative_question_index_raises(self):
        """Negative current_question_index raises ValueError."""
        with pytest.raises(ValueError, match="negative"):
            SnapshotManager.build_snapshot(
                session_id="s1", candidate_id="c1",
                answers=[], current_question_index=-1, remaining_seconds=100,
            )


class TestSnapshotHash:
    """Tests for SnapshotManager.compute_hash() and verify_snapshot()."""

    def test_hash_deterministic(self):
        """Same inputs produce same hash."""
        h1 = SnapshotManager.compute_hash("[]", 0, 3600)
        h2 = SnapshotManager.compute_hash("[]", 0, 3600)
        assert h1 == h2

    def test_hash_changes_with_answers(self):
        """Different answers produce different hash."""
        h1 = SnapshotManager.compute_hash("[]", 0, 3600)
        h2 = SnapshotManager.compute_hash('[{"q": "1"}]', 0, 3600)
        assert h1 != h2

    def test_hash_changes_with_question_index(self):
        """Different question index produces different hash."""
        h1 = SnapshotManager.compute_hash("[]", 0, 3600)
        h2 = SnapshotManager.compute_hash("[]", 5, 3600)
        assert h1 != h2

    def test_hash_changes_with_remaining_seconds(self):
        """Different remaining seconds produces different hash."""
        h1 = SnapshotManager.compute_hash("[]", 0, 3600)
        h2 = SnapshotManager.compute_hash("[]", 0, 1800)
        assert h1 != h2

    def test_verify_valid_snapshot(self):
        """Valid snapshot passes verification."""
        snap = SnapshotManager.build_snapshot(
            session_id="s1", candidate_id="c1",
            answers=[{"q": "1", "a": "A"}],
            current_question_index=3, remaining_seconds=500,
        )
        result = SnapshotManager.verify_snapshot(snap)
        assert result["is_valid"] is True

    def test_verify_tampered_answers(self):
        """Tampered answers_json fails verification."""
        snap = SnapshotManager.build_snapshot(
            session_id="s1", candidate_id="c1",
            answers=[{"q": "1", "a": "A"}],
            current_question_index=3, remaining_seconds=500,
        )
        snap["answers_json"] = '[{"q":"1","a":"B"}]'  # tampered!
        result = SnapshotManager.verify_snapshot(snap)
        assert result["is_valid"] is False

    def test_verify_tampered_timer(self):
        """Tampered remaining_seconds fails verification."""
        snap = SnapshotManager.build_snapshot(
            session_id="s1", candidate_id="c1",
            answers=[], current_question_index=0, remaining_seconds=500,
        )
        snap["remaining_seconds"] = 9999  # tampered!
        result = SnapshotManager.verify_snapshot(snap)
        assert result["is_valid"] is False

    def test_verify_tampered_question_index(self):
        """Tampered current_question_index fails verification."""
        snap = SnapshotManager.build_snapshot(
            session_id="s1", candidate_id="c1",
            answers=[], current_question_index=3, remaining_seconds=500,
        )
        snap["current_question_index"] = 0  # tampered!
        result = SnapshotManager.verify_snapshot(snap)
        assert result["is_valid"] is False

    def test_verify_missing_hash(self):
        """Snapshot with missing hash fails verification."""
        snap = SnapshotManager.build_snapshot(
            session_id="s1", candidate_id="c1",
            answers=[], current_question_index=0, remaining_seconds=500,
        )
        del snap["snapshot_hash"]
        result = SnapshotManager.verify_snapshot(snap)
        assert result["is_valid"] is False


class TestParseAnswers:
    """Tests for SnapshotManager.parse_answers()."""

    def test_parse_valid_json(self):
        """Valid JSON array parses correctly."""
        answers = SnapshotManager.parse_answers('[{"q": "1"}]')
        assert len(answers) == 1
        assert answers[0]["q"] == "1"

    def test_parse_empty_array(self):
        """Empty JSON array parses to empty list."""
        answers = SnapshotManager.parse_answers("[]")
        assert answers == []

    def test_parse_invalid_json_raises(self):
        """Invalid JSON raises ValueError."""
        with pytest.raises(ValueError, match="Invalid"):
            SnapshotManager.parse_answers("not json")

    def test_parse_non_array_raises(self):
        """JSON object (not array) raises ValueError."""
        with pytest.raises(ValueError, match="list"):
            SnapshotManager.parse_answers('{"key": "value"}')


class TestCalculateRemainingTime:
    """Tests for SnapshotManager.calculate_remaining_time()."""

    def test_full_time_remaining(self):
        """Exam just started — full time remaining."""
        now = datetime(2026, 6, 9, 12, 0, 0, tzinfo=timezone.utc)
        remaining = SnapshotManager.calculate_remaining_time(
            exam_duration_seconds=3600,
            started_at=now,
            now=now,
        )
        assert remaining == 3600

    def test_half_time_elapsed(self):
        """Half of exam time elapsed."""
        started = datetime(2026, 6, 9, 12, 0, 0, tzinfo=timezone.utc)
        now = started + timedelta(minutes=30)
        remaining = SnapshotManager.calculate_remaining_time(
            exam_duration_seconds=3600,
            started_at=started,
            now=now,
        )
        assert remaining == 1800

    def test_time_expired_clamps_to_zero(self):
        """Expired timer clamps to 0, not negative."""
        started = datetime(2026, 6, 9, 12, 0, 0, tzinfo=timezone.utc)
        now = started + timedelta(hours=2)
        remaining = SnapshotManager.calculate_remaining_time(
            exam_duration_seconds=3600,
            started_at=started,
            now=now,
        )
        assert remaining == 0

    def test_exactly_at_expiry(self):
        """Timer at exactly the expiry boundary returns 0."""
        started = datetime(2026, 6, 9, 12, 0, 0, tzinfo=timezone.utc)
        now = started + timedelta(seconds=3600)
        remaining = SnapshotManager.calculate_remaining_time(
            exam_duration_seconds=3600,
            started_at=started,
            now=now,
        )
        assert remaining == 0
