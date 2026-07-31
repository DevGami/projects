"""Integration tests — end-to-end API flows."""


class TestQuestionFlow:
    """Question creation → encryption → retrieval flow."""

    async def test_create_question_stores_ciphertext(self):
        """Creating a question should store only encrypted content in DB."""
        # TODO: Implement
        ...

    async def test_list_questions_returns_metadata_only(self):
        """Listing questions should not expose encrypted content."""
        # TODO: Implement
        ...


class TestExamCompilationFlow:
    """Exam creation → compilation → package generation flow."""

    async def test_compile_exam_generates_signed_package(self):
        """Compiling an exam should produce an RSA-signed encrypted package."""
        # TODO: Implement
        ...

    async def test_release_key_delivers_wrapped_key(self):
        """Key release should encrypt AES key with center RSA public key."""
        # TODO: Implement
        ...


class TestAuthFlow:
    """QR token → face verification → session creation flow."""

    async def test_valid_qr_creates_session(self):
        """Valid QR token with face match should create a JWT session."""
        # TODO: Implement
        ...

    async def test_replayed_nonce_rejected(self):
        """Reusing a QR nonce should fail authentication."""
        # TODO: Implement
        ...


class TestRecoveryFlow:
    """Answer save → crash → recovery flow."""

    async def test_snapshot_saved_on_answer(self):
        """Each answer submission should save a recovery snapshot."""
        # TODO: Implement
        ...

    async def test_session_restored_from_snapshot(self):
        """Restored session should have all previously saved answers."""
        # TODO: Implement
        ...
