"""
Unit Tests — Module 06: Anomaly Detection Rule Engine

Tests for shared/monitoring/rule_engine.py:
  - All 5 detection rules (Module 06 spec)
  - Debounce cooldown logic
  - Edge cases (boundary values, None gaze, zero faces)
  - Evidence hash determinism
"""

import time
from unittest.mock import patch

import pytest

from shared.monitoring.rule_engine import (
    AlertSeverity,
    AlertType,
    DetectionFrame,
    RuleConfig,
    RuleEngine,
    SecurityAlert,
    compute_evidence_hash,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def engine():
    """Default rule engine."""
    return RuleEngine()


@pytest.fixture
def fast_engine():
    """Rule engine with very short cooldowns for testing debounce."""
    config = RuleConfig(
        multi_face_cooldown_s=0.2,
        no_face_cooldown_s=0.2,
        gaze_cooldown_s=0.2,
        camera_blocked_cooldown_s=0.2,
        rapid_changes_cooldown_s=0.2,
    )
    return RuleEngine(config)


def _frame(**overrides) -> DetectionFrame:
    """Build a DetectionFrame with defaults + overrides."""
    defaults = {
        "session_id": "session-1",
        "candidate_id": "candidate-1",
        "face_count": 1,
        "gaze_yaw": 0.0,
        "gaze_pitch": 0.0,
        "camera_active": True,
        "answer_changes_last_30s": 0,
        "timestamp": "2026-06-11T12:00:00Z",
    }
    defaults.update(overrides)
    return DetectionFrame(**defaults)


# ---------------------------------------------------------------------------
# Rule 1: Multiple Faces (HIGH)
# ---------------------------------------------------------------------------

class TestMultipleFaces:
    """Multiple faces detection — face_count >= 2."""

    def test_two_faces_triggers_alert(self, engine):
        alerts = engine.evaluate(_frame(face_count=2))
        assert len(alerts) == 1
        assert alerts[0].alert_type == AlertType.MULTIPLE_FACES
        assert alerts[0].severity == AlertSeverity.HIGH

    def test_three_faces_triggers_alert(self, engine):
        alerts = engine.evaluate(_frame(face_count=3))
        assert len(alerts) == 1
        assert alerts[0].details["face_count"] == 3

    def test_one_face_no_alert(self, engine):
        alerts = engine.evaluate(_frame(face_count=1))
        multi_alerts = [a for a in alerts if a.alert_type == AlertType.MULTIPLE_FACES]
        assert len(multi_alerts) == 0

    def test_evidence_hash_included(self, engine):
        alerts = engine.evaluate(_frame(face_count=2))
        assert len(alerts[0].evidence_hash) == 64  # SHA-256 hex


# ---------------------------------------------------------------------------
# Rule 2: No Face (HIGH)
# ---------------------------------------------------------------------------

class TestNoFace:
    """No face detection — face_count == 0."""

    def test_zero_faces_triggers_alert(self, engine):
        alerts = engine.evaluate(_frame(face_count=0))
        assert len(alerts) == 1
        assert alerts[0].alert_type == AlertType.NO_FACE
        assert alerts[0].severity == AlertSeverity.HIGH

    def test_one_face_no_no_face_alert(self, engine):
        alerts = engine.evaluate(_frame(face_count=1))
        no_face_alerts = [a for a in alerts if a.alert_type == AlertType.NO_FACE]
        assert len(no_face_alerts) == 0


# ---------------------------------------------------------------------------
# Rule 3: Gaze Deviation (MEDIUM)
# ---------------------------------------------------------------------------

class TestGazeDeviation:
    """Gaze tracking — deviation > 30° from center."""

    def test_gaze_yaw_over_threshold_triggers(self, engine):
        alerts = engine.evaluate(_frame(face_count=1, gaze_yaw=35.0, gaze_pitch=0.0))
        gaze_alerts = [a for a in alerts if a.alert_type == AlertType.GAZE_DEVIATION]
        assert len(gaze_alerts) == 1
        assert gaze_alerts[0].severity == AlertSeverity.MEDIUM

    def test_gaze_pitch_over_threshold_triggers(self, engine):
        alerts = engine.evaluate(_frame(face_count=1, gaze_yaw=0.0, gaze_pitch=-35.0))
        gaze_alerts = [a for a in alerts if a.alert_type == AlertType.GAZE_DEVIATION]
        assert len(gaze_alerts) == 1

    def test_gaze_at_threshold_no_alert(self, engine):
        """Exactly 30° should NOT trigger (> 30, not >=)."""
        alerts = engine.evaluate(_frame(face_count=1, gaze_yaw=30.0, gaze_pitch=0.0))
        gaze_alerts = [a for a in alerts if a.alert_type == AlertType.GAZE_DEVIATION]
        assert len(gaze_alerts) == 0

    def test_gaze_below_threshold_no_alert(self, engine):
        alerts = engine.evaluate(_frame(face_count=1, gaze_yaw=10.0, gaze_pitch=5.0))
        gaze_alerts = [a for a in alerts if a.alert_type == AlertType.GAZE_DEVIATION]
        assert len(gaze_alerts) == 0

    def test_no_gaze_data_no_alert(self, engine):
        """None gaze values (no face mesh) should not trigger gaze rule."""
        alerts = engine.evaluate(_frame(face_count=1, gaze_yaw=None, gaze_pitch=None))
        gaze_alerts = [a for a in alerts if a.alert_type == AlertType.GAZE_DEVIATION]
        assert len(gaze_alerts) == 0

    def test_gaze_only_triggers_with_single_face(self, engine):
        """Gaze deviation should NOT trigger if face_count != 1."""
        alerts = engine.evaluate(_frame(face_count=2, gaze_yaw=45.0, gaze_pitch=0.0))
        gaze_alerts = [a for a in alerts if a.alert_type == AlertType.GAZE_DEVIATION]
        assert len(gaze_alerts) == 0

    def test_gaze_details_include_deviation_info(self, engine):
        alerts = engine.evaluate(_frame(face_count=1, gaze_yaw=40.0, gaze_pitch=-20.0))
        gaze_alerts = [a for a in alerts if a.alert_type == AlertType.GAZE_DEVIATION]
        assert gaze_alerts[0].details["max_deviation"] == 40.0
        assert gaze_alerts[0].details["threshold"] == 30.0


# ---------------------------------------------------------------------------
# Rule 4: Camera Blocked (HIGH)
# ---------------------------------------------------------------------------

class TestCameraBlocked:
    """Camera blocked detection — camera_active == False."""

    def test_camera_blocked_triggers_alert(self, engine):
        alerts = engine.evaluate(_frame(camera_active=False))
        cam_alerts = [a for a in alerts if a.alert_type == AlertType.CAMERA_BLOCKED]
        assert len(cam_alerts) == 1
        assert cam_alerts[0].severity == AlertSeverity.HIGH

    def test_camera_active_no_alert(self, engine):
        alerts = engine.evaluate(_frame(camera_active=True))
        cam_alerts = [a for a in alerts if a.alert_type == AlertType.CAMERA_BLOCKED]
        assert len(cam_alerts) == 0


# ---------------------------------------------------------------------------
# Rule 5: Rapid Answer Changes (LOW)
# ---------------------------------------------------------------------------

class TestRapidAnswerChanges:
    """Rapid answer changes — > 10 changes in 30 seconds."""

    def test_11_changes_triggers(self, engine):
        alerts = engine.evaluate(_frame(answer_changes_last_30s=11))
        rapid = [a for a in alerts if a.alert_type == AlertType.RAPID_ANSWER_CHANGES]
        assert len(rapid) == 1
        assert rapid[0].severity == AlertSeverity.LOW

    def test_10_changes_no_alert(self, engine):
        """Exactly 10 should NOT trigger (> 10, not >=)."""
        alerts = engine.evaluate(_frame(answer_changes_last_30s=10))
        rapid = [a for a in alerts if a.alert_type == AlertType.RAPID_ANSWER_CHANGES]
        assert len(rapid) == 0

    def test_0_changes_no_alert(self, engine):
        alerts = engine.evaluate(_frame(answer_changes_last_30s=0))
        rapid = [a for a in alerts if a.alert_type == AlertType.RAPID_ANSWER_CHANGES]
        assert len(rapid) == 0


# ---------------------------------------------------------------------------
# Debounce / Cooldown
# ---------------------------------------------------------------------------

class TestDebounce:
    """Cooldown logic — suppress duplicate alerts within window."""

    def test_same_session_same_rule_suppressed(self, engine):
        """Second identical alert within cooldown should be suppressed."""
        alerts1 = engine.evaluate(_frame(face_count=2))
        assert len(alerts1) == 1

        alerts2 = engine.evaluate(_frame(face_count=2))
        assert len(alerts2) == 0  # Suppressed by cooldown

    def test_different_sessions_not_suppressed(self, engine):
        """Alerts for different sessions should fire independently."""
        alerts1 = engine.evaluate(_frame(session_id="s1", face_count=2))
        alerts2 = engine.evaluate(_frame(session_id="s2", face_count=2))
        assert len(alerts1) == 1
        assert len(alerts2) == 1

    def test_different_rules_not_suppressed(self, engine):
        """Different rule types for same session fire independently."""
        alerts = engine.evaluate(_frame(face_count=0, camera_active=False))
        types = {a.alert_type for a in alerts}
        assert AlertType.NO_FACE in types
        assert AlertType.CAMERA_BLOCKED in types

    def test_cooldown_expires(self, fast_engine):
        """After cooldown period, alert should fire again."""
        alerts1 = fast_engine.evaluate(_frame(face_count=2))
        assert len(alerts1) == 1

        time.sleep(0.3)  # Wait for cooldown to expire

        alerts2 = fast_engine.evaluate(_frame(face_count=2))
        assert len(alerts2) == 1

    def test_reset_cooldowns_for_session(self, engine):
        """Reset clears cooldown for specific session."""
        engine.evaluate(_frame(session_id="s1", face_count=2))
        engine.reset_cooldowns(session_id="s1")

        alerts = engine.evaluate(_frame(session_id="s1", face_count=2))
        assert len(alerts) == 1

    def test_reset_all_cooldowns(self, engine):
        """Reset without session_id clears all."""
        engine.evaluate(_frame(session_id="s1", face_count=2))
        engine.evaluate(_frame(session_id="s2", face_count=0))
        engine.reset_cooldowns()

        a1 = engine.evaluate(_frame(session_id="s1", face_count=2))
        a2 = engine.evaluate(_frame(session_id="s2", face_count=0))
        assert len(a1) == 1
        assert len(a2) == 1


# ---------------------------------------------------------------------------
# Multiple Rules Simultaneously
# ---------------------------------------------------------------------------

class TestMultipleRules:
    """Test that multiple rules can fire from a single frame."""

    def test_camera_blocked_and_no_face(self, engine):
        """Camera blocked + face_count=0 should fire 2 rules."""
        alerts = engine.evaluate(_frame(face_count=0, camera_active=False))
        types = {a.alert_type for a in alerts}
        assert AlertType.NO_FACE in types
        assert AlertType.CAMERA_BLOCKED in types
        assert len(alerts) == 2

    def test_normal_frame_no_alerts(self, engine):
        """Normal frame should generate no alerts."""
        alerts = engine.evaluate(_frame())
        assert len(alerts) == 0


# ---------------------------------------------------------------------------
# Evidence Hash
# ---------------------------------------------------------------------------

class TestEvidenceHash:
    """Evidence hash computation."""

    def test_hash_is_64_hex_chars(self):
        h = compute_evidence_hash({"test": "data"})
        assert len(h) == 64
        assert all(c in "0123456789abcdef" for c in h)

    def test_hash_deterministic(self):
        h1 = compute_evidence_hash({"a": 1, "b": 2})
        h2 = compute_evidence_hash({"b": 2, "a": 1})  # different order
        assert h1 == h2

    def test_different_data_different_hash(self):
        h1 = compute_evidence_hash({"a": 1})
        h2 = compute_evidence_hash({"a": 2})
        assert h1 != h2


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

class TestConfig:
    """Rule configuration access."""

    def test_default_config(self):
        engine = RuleEngine()
        assert engine.config.gaze_angle_threshold == 30.0
        assert engine.config.rapid_changes_threshold == 10

    def test_custom_config(self):
        config = RuleConfig(gaze_angle_threshold=45.0, rapid_changes_threshold=5)
        engine = RuleEngine(config)
        assert engine.config.gaze_angle_threshold == 45.0

    def test_custom_threshold_affects_detection(self):
        """Custom gaze threshold changes when alerts fire."""
        strict_config = RuleConfig(gaze_angle_threshold=15.0)
        engine = RuleEngine(strict_config)

        alerts = engine.evaluate(_frame(face_count=1, gaze_yaw=20.0, gaze_pitch=0.0))
        gaze_alerts = [a for a in alerts if a.alert_type == AlertType.GAZE_DEVIATION]
        assert len(gaze_alerts) == 1  # 20 > 15

    def test_custom_rapid_changes_threshold(self):
        config = RuleConfig(rapid_changes_threshold=5)
        engine = RuleEngine(config)

        alerts = engine.evaluate(_frame(answer_changes_last_30s=6))
        rapid = [a for a in alerts if a.alert_type == AlertType.RAPID_ANSWER_CHANGES]
        assert len(rapid) == 1
