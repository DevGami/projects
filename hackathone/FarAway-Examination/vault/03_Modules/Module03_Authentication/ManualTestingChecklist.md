# Module 03 — Authentication: Manual Testing Checklist

> **Created:** 2026-06-10
> **Module:** 03 — Authentication
> **Status:** Ready for QA

---

## Setup

### Prerequisites
- Edge server running: `SERVER_MODE=edge python -m uvicorn server.app.main:app`
- Cloud server running: `SERVER_MODE=cloud python -m uvicorn server.app.main:app`
- RSA key pair generated: `python scripts/generate_keys.py`
- SQLite DB initialized (edge tables: `used_nonces`, `sessions`, `candidates`)
- A test candidate inserted with `roll_number`, `center_id`, `exam_id`

### Environment Variables (Edge)
```env
SERVER_MODE=edge
DATABASE_URL=sqlite+aiosqlite:///./fortisexam_edge.db
RSA_PRIVATE_KEY_PATH=./keys/private.pem
RSA_PUBLIC_KEY_PATH=./keys/public.pem
FACE_SIMILARITY_THRESHOLD=0.6
```

### Environment Variables (Cloud)
```env
SERVER_MODE=cloud
DATABASE_URL=postgresql+asyncpg://...
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
RSA_PRIVATE_KEY_PATH=./keys/private.pem
RSA_PUBLIC_KEY_PATH=./keys/public.pem
```

### Generate a Test QR Token
```python
from server.app.services.qr_token_service import QRTokenGenerator
from shared.crypto.rsa import RSASigner
from datetime import datetime, timezone, timedelta
import uuid, json

private_key = RSASigner.load_private_key("./keys/private.pem")
gen = QRTokenGenerator(private_key)
qr_json = gen.generate(
    candidate_id="<candidate_uuid>",
    exam_id="<exam_uuid>",
    center_id="<center_uuid>",
    nonce=uuid.uuid4().hex,
    issued_at=datetime.now(tz=timezone.utc),
    expires_at=datetime.now(tz=timezone.utc) + timedelta(hours=2),
)
print(qr_json)
```

---

## Test Cases

### TC-01: Valid QR-Only Authentication

**Steps:**
1. Generate a valid QR token (script above)
2. `POST /api/v1/auth/authenticate` with `{ "qr_data": "<qr_json>", "face_image_base64": null }`

**Expected:**
```json
{
  "session_id": "uuid",
  "token": "eyJ...",
  "variant_id": 0,
  "expires_at": "2026-06-10T...",
  "face_score": 0.0,
  "method": "qr_only"
}
```

**Failure Conditions:**
- `401` if key file missing
- `401` if signature invalid
- `401` if token expired

---

### TC-02: Valid QR + Face Authentication

**Steps:**
1. Insert candidate with `photo_embedding` (pre-computed float32 bytes)
2. Capture face image → extract 512-dim embedding → base64 encode
3. `POST /api/v1/auth/authenticate` with `{ "qr_data": "...", "face_image_base64": "..." }`

**Expected:**
```json
{
  "method": "qr_face",
  "face_score": 0.87
}
```

**Failure Conditions:**
- `401` if face_score < threshold (default 0.6)

---

### TC-03: Replay Attack Prevention

**Steps:**
1. Use the same QR token (same nonce) for a second `POST /api/v1/auth/authenticate`

**Expected:**
- `401 Unauthorized` with `"replay attack detected"`

---

### TC-04: Tampered QR Token

**Steps:**
1. Take a valid QR token JSON
2. Change `candidate_id` to another value
3. `POST /api/v1/auth/authenticate`

**Expected:**
- `401 Unauthorized` with `"signature verification failed"`

---

### TC-05: Expired QR Token

**Steps:**
1. Generate token with `expires_at = now - 1 minute`
2. `POST /api/v1/auth/authenticate`

**Expected:**
- `401 Unauthorized` with `"expired"`

---

### TC-06: Supervisor Override

**Steps:**
1. `POST /api/v1/auth/supervisor-override` with:
   ```json
   {
     "candidate_id": "<uuid>",
     "exam_id": "<uuid>",
     "invigilator_id": "INV-001",
     "reason": "QR scanner not available at gate"
   }
   ```

**Expected:**
```json
{
  "method": "supervisor_override",
  "session_id": "uuid",
  "token": "eyJ..."
}
```

**Verify:**
- Audit log contains `SUPERVISOR_OVERRIDE` event

---

### TC-07: Cloud Admin — GET /users/me (Dev Mode)

**Steps:**
1. Cloud server with no `CLERK_SECRET_KEY` set
2. `GET /api/v1/users/me` with any `Authorization: Bearer <token>`

**Expected:**
```json
{
  "clerk_user_id": "dev_user",
  "role": "admin",
  "email": "dev@fortisexam.local"
}
```

---

### TC-08: Cloud Admin — POST /users/sync

**Steps:**
1. `POST /api/v1/users/sync` with:
   ```json
   {
     "clerk_user_id": "user_abc123",
     "name": "Dr. Expert",
     "role": "expert"
   }
   ```

**Expected:**
```json
{
  "clerk_user_id": "user_abc123",
  "name": "Dr. Expert",
  "role": "expert",
  "created": true
}
```

**Second call (update):**
- Same request → `"created": false`

---

### TC-09: RBAC — Wrong Role Blocked

**Steps:**
1. Cloud server with `CLERK_SECRET_KEY` set
2. JWT with role `"expert"` attempts `POST /users/sync` (requires `"admin"`)

**Expected:**
- `403 Forbidden` — `"Access denied"`

---

### TC-10: Edge JWT Session Protected Routes

**Steps:**
1. Authenticate → receive JWT token
2. `GET /api/v1/exam/session/<session_id>` with `Authorization: Bearer <token>`

**Expected:**
- `200 OK` with session details

**Without JWT:**
- `403 Forbidden`

---

## Regression Checks

After any change to auth flow, re-verify:

| Check | Command |
|---|---|
| All auth tests pass | `pytest tests/unit/test_auth.py tests/integration/test_auth_integration.py tests/security/test_auth_security.py` |
| No new lint errors | `ruff check server/app/middleware/ server/app/services/auth_service.py` |
| Server imports cleanly | `python -c "from server.app.main import create_app; create_app()"` |
| QR token roundtrip | Run generate script → verify_and_consume manually |

---

## Known Limitations (Demo)

| Limitation | Production Fix |
|---|---|
| Face embedding: raw float32 bytes instead of image inference | Integrate InsightFace (Module 06) |
| No rate limiting on `/auth/authenticate` | Add rate limiter middleware |
| Clerk JWKS fetched synchronously per request | Cache JWKS with TTL |
| Variant assignment uses seat_number hash (not full package lookup) | Wire package decryption (Module 02) |
