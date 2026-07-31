# Module 02 — Crypto Delivery: Demo Act 1 Walkthrough

This checklist verifies the end-to-end functionality of Cryptographic Package Delivery, matching **Demo Act 1**.

## Prerequisites
1. Start the server in cloud mode:
   ```bash
   SERVER_MODE=cloud uvicorn server.main:app --reload
   ```
2. Ensure you have the test center's public key (generated via `scripts/generate_keys.py`). You can copy it from `keys/center_public.pem`.

## Step 1: Package Generation
- **Action**: Create an encrypted exam package.
- **Request**:
  ```bash
  curl -X POST http://localhost:8000/api/v1/packages/generate \
  -H "Content-Type: application/json" \
  -d '{"exam_id": "550e8400-e29b-41d4-a716-446655440000", "center_public_key_pem": "-----BEGIN PUBLIC KEY-----\n..."}'
  ```
- **Expectation**: 
  - Returns `201 Created`.
  - Response contains `id`, `exam_id`, `package_hash`, and `status: "generated"`.
  - **Save the `id` as `PACKAGE_ID`**.

## Step 2: Download Package (Opacity Check)
- **Action**: Download the package payload.
- **Request**:
  ```bash
  curl http://localhost:8000/api/v1/packages/${PACKAGE_ID}/download
  ```
- **Expectation**: 
  - Returns `200 OK`.
  - Response contains `encrypted_payload_b64`, `iv_b64`, `tag_b64`, and `package_hash`.
  - **Observe**: The payload is base64 encoded and completely opaque. It cannot be parsed as JSON.

## Step 3: Verify Signature
- **Action**: Verify the server's RSA signature on the package.
- **Request**:
  ```bash
  curl -X POST http://localhost:8000/api/v1/packages/${PACKAGE_ID}/verify
  ```
- **Expectation**:
  - Returns `200 OK`.
  - Response contains `"valid": true` and matches the `package_hash`.

## Step 4: Admin Key Release (D-012)
- **Action**: Admin triggers key release to the edge node.
- **Request**:
  ```bash
  curl -X POST http://localhost:8000/api/v1/exams/550e8400-e29b-41d4-a716-446655440000/release-key \
  -H "Content-Type: application/json" \
  -d '{"center_public_key_pem": "-----BEGIN PUBLIC KEY-----\n..."}'
  ```
- **Expectation**:
  - Returns `200 OK`.
  - Response contains `wrapped_key_b64`. This is the AES package key, encrypted so only the center can read it.
  
## Step 5: Distribution Status
- **Action**: Check the package status after key release.
- **Request**:
  ```bash
  curl http://localhost:8000/api/v1/distribution/status/${PACKAGE_ID}
  ```
- **Expectation**:
  - Returns `200 OK`.
  - Status is now `"activated"`.
