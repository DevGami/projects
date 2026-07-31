# FortisExam — Database Design

> **Last Updated:** 2026-06-08

---

## Cloud Database (PostgreSQL)

### Tables

#### users (synced from Clerk)
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK, DEFAULT uuid_generate_v4() |
| clerk_user_id | VARCHAR(255) | UNIQUE, NOT NULL (Clerk's user ID) |
| role | ENUM('admin', 'expert', 'center_admin', 'invigilator', 'auditor') | NOT NULL |
| name | VARCHAR(255) | NOT NULL |
| created_at | TIMESTAMP | DEFAULT NOW() |

#### questions
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| subject | VARCHAR(100) | NOT NULL, INDEXED |
| difficulty | ENUM('easy', 'medium', 'hard') | NOT NULL |
| encrypted_content | BYTEA | NOT NULL |
| encrypted_key | BYTEA | NOT NULL |
| iv | BYTEA | NOT NULL |
| auth_tag | BYTEA | NOT NULL |
| metadata | JSONB | DEFAULT '{}' |
| version | INTEGER | DEFAULT 1 |
| created_by | UUID | FK → users.id |
| created_at | TIMESTAMP | DEFAULT NOW() |
| updated_at | TIMESTAMP | DEFAULT NOW() |
| is_deleted | BOOLEAN | DEFAULT FALSE |

#### exams
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| name | VARCHAR(255) | NOT NULL |
| blueprint | JSONB | NOT NULL |
| slot | TIMESTAMP | NOT NULL |
| status | ENUM('draft', 'compiled', 'distributed', 'active', 'completed') | NOT NULL |
| package_id | UUID | FK → packages.id, NULLABLE |
| created_by | UUID | FK → users.id |
| created_at | TIMESTAMP | DEFAULT NOW() |

#### packages
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| exam_id | UUID | FK → exams.id |
| encrypted_data | BYTEA | NOT NULL |
| manifest_hash | VARCHAR(64) | NOT NULL |
| signature | BYTEA | NOT NULL |
| created_at | TIMESTAMP | DEFAULT NOW() |

#### centers
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| name | VARCHAR(255) | NOT NULL |
| location | VARCHAR(255) | |
| layout_rows | INTEGER | NOT NULL |
| layout_columns | INTEGER | NOT NULL |
| status | ENUM('active', 'inactive') | DEFAULT 'active' |
| public_key | TEXT | Center's RSA public key |

#### candidates
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| name | VARCHAR(255) | NOT NULL |
| center_id | UUID | FK → centers.id |
| exam_id | UUID | FK → exams.id |
| photo_embedding | BYTEA | Face embedding vector |
| qr_token | TEXT | Signed QR token |
| seat_id | VARCHAR(10) | Seat assignment (e.g., "A1") |
| status | ENUM('registered', 'authenticated', 'in_exam', 'submitted') | DEFAULT 'registered' |

#### audit_events (cloud)
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| event_type | VARCHAR(50) | NOT NULL, INDEXED |
| timestamp | TIMESTAMP | NOT NULL |
| actor_id | UUID | |
| target_id | UUID | |
| payload | JSONB | |
| payload_hash | VARCHAR(64) | NOT NULL |
| previous_hash | VARCHAR(64) | NOT NULL |
| current_hash | VARCHAR(64) | NOT NULL |

---

## Edge Database (SQLite)

### Tables

#### sessions
| Column | Type |
|---|---|
| id | TEXT (UUID) PK |
| candidate_id | TEXT (UUID) |
| exam_id | TEXT (UUID) |
| variant_id | INTEGER |
| start_time | TEXT (ISO datetime) |
| end_time | TEXT (ISO datetime, nullable) |
| status | TEXT ('active', 'submitted', 'recovered') |
| jwt_token | TEXT |

#### answers
| Column | Type |
|---|---|
| id | TEXT (UUID) PK |
| session_id | TEXT FK → sessions.id |
| question_id | TEXT (UUID) |
| selected_option | TEXT |
| timestamp | TEXT (ISO datetime) |

#### recovery_snapshots
| Column | Type |
|---|---|
| id | TEXT (UUID) PK |
| session_id | TEXT FK → sessions.id |
| answers_json | TEXT (JSON) |
| timer_remaining | INTEGER (seconds) |
| current_question_index | INTEGER |
| snapshot_hash | TEXT (SHA-256) |
| created_at | TEXT (ISO datetime) |

#### audit_events (edge)
| Column | Type |
|---|---|
| id | TEXT (UUID) PK |
| event_type | TEXT |
| timestamp | TEXT |
| actor_id | TEXT |
| payload | TEXT (JSON) |
| payload_hash | TEXT |
| previous_hash | TEXT |
| current_hash | TEXT |
| synced | INTEGER (0/1) |

---

## Related Documents

- [[BackendDesign]] — Service layer that uses these schemas
- [[APIContracts]] — API endpoints that map to these tables
- [[Module05_StateRecovery]] — Recovery snapshot design
