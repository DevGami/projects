"""
FortisExam — Test Configuration

Shared fixtures and configuration for all test types (unit, integration, security).
"""

import os

import pytest


# ---------------------------------------------------------------------------
# Crypto fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def aes_key():
    """Generate a test AES-256 key (random for each test)."""
    return os.urandom(32)


@pytest.fixture
def rsa_key_pair():
    """
    Generate an ephemeral RSA-2048 key pair for testing.
    Returns (private_key_pem: bytes, public_key_pem: bytes).
    """
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
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
    return (private_pem, public_pem)


# ---------------------------------------------------------------------------
# Sample data fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_question():
    """Sample question data for testing."""
    return {
        "subject": "Mathematics",
        "difficulty": "medium",
        "content": "What is 2 + 2?",
        "options": ["3", "4", "5", "6"],
        "correct_option": 1,
    }


@pytest.fixture
def sample_audit_events():
    """
    Sample audit events in the format expected by ChainVerifier.verify().

    These are NOT yet chained — use the helpers in test_audit.py to build
    a properly linked chain for verification tests.
    """
    return [
        {
            "event_type": "QUESTION_CREATED",
            "actor_id": "user-1",
            "payload": {"question_id": "q-1"},
        },
        {
            "event_type": "QUESTION_CREATED",
            "actor_id": "user-1",
            "payload": {"question_id": "q-2"},
        },
        {
            "event_type": "PACKAGE_GENERATED",
            "actor_id": "user-1",
            "payload": {"package_id": "p-1"},
        },
    ]


# ---------------------------------------------------------------------------
# pytest-asyncio configuration
# ---------------------------------------------------------------------------

# Set asyncio_mode to "auto" for all tests in this project
# This allows async test methods without @pytest.mark.asyncio on each one
# (still required on classes/methods in older versions)
def pytest_configure(config):
    """Register custom markers."""
    config.addinivalue_line(
        "markers", "asyncio: mark test as async"
    )
