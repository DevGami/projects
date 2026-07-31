"""
Security Tests — Module 06: Anomaly Detection

Tests for:
  - Evidence hash tamper detection
  - Alert integrity
  - Rule engine cannot be bypassed with malformed input
"""

import pytest

from shared.monitoring.rule_engine import (
    AlertType,
    DetectionFrame,
    RuleEngine,
    compute_evidence_hash,
)


class TestEvidenceTamperDetection:
    """Verify that evidence hashes detect data tampering."""

    def test_tampered_evidence_detected(self):
        """Changing any field in evidence should produce a different hash."""
        original = {"face_count": 2, "candidate_id": "c-1", "timestamp": "2026-06-11T12:00:00Z"}
        tampered = {"face_count": 1, "candidate_id": "c-1", "timestamp": "2026-06-11T12:00:00Z"}

        h_orig = compute_evidence_hash(original)
        h_tampered = compute_evidence_hash(tampered)
        assert h_orig != h_tampered

    def test_tampered_candidate_id_detected(self):
        """Changing candidate_id in evidence should change hash."""
        original = {"face_count": 2, "candidate_id": "c-1"}
        tampered = {"face_count": 2, "candidate_id": "c-IMPERSONATOR"}

        assert compute_evidence_hash(original) != compute_evidence_hash(tampered)

    def test_tampered_timestamp_detected(self):
        """Changing timestamp should change hash."""
        original = {"face_count": 0, "timestamp": "2026-06-11T12:00:00Z"}
        tampered = {"face_count": 0, "timestamp": "2026-06-11T13:00:00Z"}

        assert compute_evidence_hash(original) != compute_evidence_hash(tampered)

    def test_alert_evidence_hash_matches_recomputation(self):
        """The hash stored in the alert must match re-computation from details."""
        engine = RuleEngine()
        frame = DetectionFrame(
            session_id="s-1",
            candidate_id="c-1",
            face_count=3,
            timestamp="2026-06-11T12:00:00Z",
        )
        alerts = engine.evaluate(frame)
        assert len(alerts) == 1

        alert = alerts[0]
        recomputed = compute_evidence_hash(alert.details)
        assert alert.evidence_hash == recomputed


class TestMalformedInputSafety:
    """Ensure the rule engine handles malformed/adversarial input safely."""

    def test_empty_session_id_still_evaluates(self):
        """Empty session_id shouldn't crash the engine."""
        engine = RuleEngine()
        frame = DetectionFrame(session_id="", candidate_id="c-1", face_count=2)
        alerts = engine.evaluate(frame)
        assert len(alerts) == 1

    def test_very_large_face_count(self):
        """Extremely large face_count should still trigger MULTIPLE_FACES."""
        engine = RuleEngine()
        frame = DetectionFrame(session_id="s-1", candidate_id="c-1", face_count=999)
        alerts = engine.evaluate(frame)
        multi = [a for a in alerts if a.alert_type == AlertType.MULTIPLE_FACES]
        assert len(multi) == 1

    def test_extreme_gaze_angle(self):
        """Extreme gaze angle should trigger deviation."""
        engine = RuleEngine()
        frame = DetectionFrame(
            session_id="s-1", candidate_id="c-1",
            face_count=1, gaze_yaw=180.0, gaze_pitch=0.0,
        )
        alerts = engine.evaluate(frame)
        gaze = [a for a in alerts if a.alert_type == AlertType.GAZE_DEVIATION]
        assert len(gaze) == 1

    def test_negative_gaze_angle(self):
        """Negative gaze angle (looking left) should trigger if abs > threshold."""
        engine = RuleEngine()
        frame = DetectionFrame(
            session_id="s-1", candidate_id="c-1",
            face_count=1, gaze_yaw=-45.0, gaze_pitch=0.0,
        )
        alerts = engine.evaluate(frame)
        gaze = [a for a in alerts if a.alert_type == AlertType.GAZE_DEVIATION]
        assert len(gaze) == 1

    def test_very_large_answer_changes(self):
        """Extreme answer changes should trigger."""
        engine = RuleEngine()
        frame = DetectionFrame(
            session_id="s-1", candidate_id="c-1",
            answer_changes_last_30s=10000,
        )
        alerts = engine.evaluate(frame)
        rapid = [a for a in alerts if a.alert_type == AlertType.RAPID_ANSWER_CHANGES]
        assert len(rapid) == 1
