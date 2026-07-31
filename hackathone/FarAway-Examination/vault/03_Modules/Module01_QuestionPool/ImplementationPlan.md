# Module 01 — Question Pool Implementation Plan

This document outlines the approach for implementing Module 01: Question Pool System. It provides secure storage and management of examination questions with automatic AES-256-GCM encryption at rest.

## Scope
- Initialize Alembic for PostgreSQL database migrations and create the initial schema migration based on existing SQLAlchemy models.
- Implement the `QuestionService` in `server/app/services/question_service.py` to handle Question CRUD operations, including auto-encryption using the existing `AESCipher`.
- Implement the Cloud API endpoints in `server/app/api/cloud/questions.py`.
- Secure the API endpoints using the existing Clerk auth middleware (`verify_clerk_jwt`).
- Log audit events (e.g., `QUESTION_CREATED`, `QUESTION_UPDATED`, `QUESTION_DELETED`) using the `AuditService`.
- Write comprehensive tests including unit tests, integration tests, and security tests to achieve >80% coverage.

## Goals
- Guarantee that no question content is stored in plaintext in the database.
- Provide a robust API for experts/admins to author and manage questions.
- Establish the PostgreSQL schema via Alembic migrations.
- Validate that the Cloud mode server is fully operational with these endpoints.

## APIs
The following endpoints will be implemented in `server/app/api/cloud/questions.py` and mounted in the main cloud application router:

| Method | Path | Description | Authentication |
|---|---|---|---|
| POST | `/api/v1/questions/` | Create a new question (auto-encrypts content) | Clerk JWT (Admin/Expert) |
| GET | `/api/v1/questions/` | List questions (paginated, metadata only, content remains encrypted) | Clerk JWT (Admin/Expert) |
| GET | `/api/v1/questions/{id}` | Get question details (returns decrypted content for authoring tools) | Clerk JWT (Admin/Expert) |
| PUT | `/api/v1/questions/{id}` | Update question (re-encrypts content) | Clerk JWT (Admin/Expert) |
| DELETE | `/api/v1/questions/{id}` | Soft-delete a question | Clerk JWT (Admin/Expert) |

## Data Structures
The database schema will rely on the existing `Question` and `User` models defined in `server/app/models/`.

**Question Model** (`questions` table):
- `id` (UUID, PK)
- `subject` (String)
- `difficulty` (String: easy, medium, hard)
- `encrypted_content` (Text, Base64 AES ciphertext)
- `encryption_iv` (String, Base64 GCM nonce)
- `content_hash` (String, SHA-256 of plaintext)
- `created_by` (String, Clerk user ID)
- `is_deleted` (Boolean)
- `created_at` (DateTime)
- `updated_at` (DateTime)

## Dependencies
- `alembic`: For database migrations.
- `shared.crypto.aes.AESCipher`: For AES-256-GCM encryption/decryption.
- `server.app.services.audit_service.AuditService`: For logging lifecycle events.
- `server.app.middleware.clerk_auth.verify_clerk_jwt`: For protecting cloud routes.

## Risks
> [!WARNING]
> **Alembic Initialization**: Generating the initial migration needs all SQLAlchemy models to be properly imported. If a model is missed, the database schema will be incomplete.
> **Security**: If the `AESCipher` is used incorrectly (e.g., reusing IVs or failing to store the auth tag properly), the question confidentiality or integrity could be broken.

## Test Strategy
### Automated Tests
- **Unit Tests (`tests/unit/test_question_service.py`)**:
  - Verify encryption/decryption roundtrip during `create` and `get`.
  - Verify pagination and metadata listing without content exposure.
  - Verify update re-encrypts content with a new IV.
  - Verify soft-delete behavior.
- **Integration Tests (`tests/integration/test_questions_api.py`)**:
  - Test `POST`, `GET`, `PUT`, `DELETE` endpoints via FastAPI `TestClient` (using mocked `verify_clerk_jwt`).
- **Security Tests (`tests/security/test_question_security.py`)**:
  - Verify that attempting to decrypt with tampered ciphertext or tampered IV raises an error.
  - Verify that the database query for the question returns ONLY encrypted data, proving plaintext is not leaked.

### Manual Verification
- A `ManualTestingChecklist.md` will be created detailing:
  - Startup of PostgreSQL and Cloud API via Docker Compose.
  - Making cURL requests with a dummy token to test the routes.
  - Inspecting the raw database to confirm encryption.

## User Review Required
> [!IMPORTANT]
> The `Question` model currently does NOT store `encrypted_key` (wrapped RSA key) per the TRD's ideal structure. It directly uses a master AES key for all questions at rest (the AES key is presumably derived or managed by the service). I will proceed using the existing model structure (`encrypted_content`, `encryption_iv`, `content_hash`) instead of creating per-question RSA-wrapped keys, as it aligns with the existing DB definitions. Please confirm if this simplification is acceptable for the Hackathon scope.
