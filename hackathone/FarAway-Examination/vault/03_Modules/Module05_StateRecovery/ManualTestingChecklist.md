# Module 05: State Recovery — Manual Testing Checklist

Follow this guide to manually verify the State Recovery subsystem in an edge server deployment.

## Prerequisites

1. Edge server running locally: `uvicorn server.app.main:app --reload`
2. Valid exam session created (via Module 03 mock or direct DB insert).
3. SQLite database initialized (WAL mode is auto-enabled by SQLAlchemy).

---

## Scenario 1: Normal Answer Submission (Happy Path)

- [ ] Send `POST /api/v1/edge/exam/answer` with a valid `session_id`, `question_id`, and `selected_option: "A"`.
- [ ] Verify HTTP 200 OK. Response should show `saved: true` and `snapshot_saved: true`.
- [ ] Open the SQLite database (`sqlite3 app.db`) and run `SELECT * FROM answers;`. Verify the answer is recorded.
- [ ] Run `SELECT * FROM recovery_snapshots;`. Verify exactly one row exists for your `session_id`.
- [ ] Send another `POST /api/v1/edge/exam/answer` for a **different** question.
- [ ] Verify `recovery_snapshots` still only has one row, but `answers_json` now contains both answers.

## Scenario 2: Answer Overwrite

- [ ] Send `POST /api/v1/edge/exam/answer` for an **already answered** question, but change `selected_option` to `"C"`.
- [ ] Verify HTTP 200 OK.
- [ ] Check DB: The `answers` table should still have the same number of rows. The specific row should now show `"C"`.
- [ ] Check `recovery_snapshots` DB row: Verify the JSON blob reflects the updated answer.

## Scenario 3: Crash and Restore

- [ ] Note the current answers and `remaining_seconds` in your snapshot.
- [ ] **Simulate a crash**: Force-kill the edge server process (`Ctrl+C` or `kill -9`).
- [ ] Restart the server.
- [ ] Send `GET /api/v1/edge/recovery/{candidate_id}`.
- [ ] Verify HTTP 200 OK. Ensure `integrity_verified: true` and the JSON reflects the exact state right before the crash.
- [ ] Send `POST /api/v1/edge/recovery/restore/{session_id}`.
- [ ] Verify HTTP 200 OK. Response should contain the full session state.
- [ ] Check DB: `SELECT status FROM exam_sessions WHERE id = '...';` should now be `"recovered"`.

## Scenario 4: Snapshot Tampering Detection

- [ ] Open the SQLite database directly.
- [ ] Run an UPDATE command to cheat: `UPDATE recovery_snapshots SET remaining_seconds = 9999 WHERE session_id = '...';`
- [ ] Send `POST /api/v1/edge/recovery/restore/{session_id}`.
- [ ] Verify HTTP 400 Bad Request. The response MUST say `Snapshot integrity check failed` and block the restore.

## Scenario 5: Final Submission

- [ ] Send `POST /api/v1/edge/exam/submit` with your `session_id`.
- [ ] Verify HTTP 200 OK. Note the `submission_hash`.
- [ ] Check DB: `SELECT status FROM exam_sessions WHERE id = '...';` should now be `"submitted"`.
- [ ] Send `POST /api/v1/edge/exam/answer` to try and answer another question.
- [ ] Verify HTTP 400 Bad Request. The session is frozen.
- [ ] Send `POST /api/v1/edge/recovery/restore/{session_id}`.
- [ ] Verify HTTP 400 Bad Request. Submitted exams cannot be restored.
