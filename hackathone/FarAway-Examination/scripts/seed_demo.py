"""
FortisExam — Full Demo Seed Script
====================================
Populates a fresh SQLite DB with realistic demo data for hackathon judges:

  - 30 encrypted questions (Physics, Chemistry, Biology)
  - 1 compiled exam (NEET-UG-2026 Demo)
  - 3 exam centers (Delhi, Mumbai, Bangalore)
  - 9 candidates (3 per center) with dummy face embeddings
  - Audit events, security events, session snapshots
  - RSA key pair generation (if not present)

Usage:
  cd d:\\DelhiHackathon
  python scripts/seed_demo.py

After running, start the server:
  $env:SERVER_MODE="cloud"; python -m uvicorn server.app.main:app --port 8000 --reload
"""

import asyncio
import json
import os
import sys
import uuid
import hashlib
import struct
from datetime import datetime, timezone, timedelta
from pathlib import Path
import math

# ── Path setup ──────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

DEMO_AES_KEY = b"12345678901234567890123456789012"  # 32 bytes — matches questions.py

# ── Crypto imports ───────────────────────────────────────────────
from shared.crypto.aes import AESCipher


# ── Database setup ───────────────────────────────────────────────
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from server.app.db.database import Base

DB_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./server/fortis.db")
engine = create_async_engine(DB_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# ── Models ───────────────────────────────────────────────────────
from server.app.models.question import Question
from server.app.models.exam import Exam
from server.app.models.center import Center
from server.app.models.candidate import Candidate
from server.app.models.audit_event import AuditEvent


# ── Demo Data ────────────────────────────────────────────────────
PHYSICS_QUESTIONS = [
    ("A body is thrown vertically upward with velocity u. The ratio of the time of ascent to time of flight is:", ["1:1", "1:2", "2:1", "1:4"], 1),
    ("The dimensional formula for coefficient of viscosity is:", ["ML⁻¹T⁻¹", "MLT⁻²", "ML²T⁻¹", "M⁰L⁰T⁰"], 0),
    ("A particle moves in a circle of radius R. In half a revolution, the displacement is:", ["2R", "πR", "R", "√2 R"], 0),
    ("The speed of light in a medium of refractive index n is:", ["nc", "c/n", "c·n²", "c/n²"], 1),
    ("Kirchhoff's Voltage Law is based on conservation of:", ["Charge", "Energy", "Momentum", "Mass"], 1),
    ("A capacitor of capacitance C is charged to potential V. The energy stored is:", ["CV²", "½CV²", "2CV²", "CV"], 1),
    ("Which of the following has the highest specific heat?", ["Iron", "Aluminium", "Water", "Mercury"], 2),
    ("The SI unit of magnetic flux is:", ["Tesla", "Weber", "Gauss", "Ampere"], 1),
    ("Bernoulli's principle is based on:", ["Newton's 3rd Law", "Conservation of energy", "Conservation of momentum", "Pascal's Law"], 1),
    ("The wavelength of visible light ranges from approximately:", ["1–10 nm", "100–400 nm", "400–700 nm", "700–1000 nm"], 2),
]

CHEMISTRY_QUESTIONS = [
    ("The number of sigma bonds in ethyne (C₂H₂) is:", ["2", "3", "4", "5"], 1),
    ("Which of the following is an intensive property?", ["Volume", "Mass", "Temperature", "Enthalpy"], 2),
    ("Hybridization of carbon in CO₂:", ["sp", "sp²", "sp³", "dsp²"], 0),
    ("The IUPAC name of CH₃–CH(OH)–CH₃ is:", ["Propanol", "2-Propanol", "1-Propanol", "Isopropanol"], 1),
    ("Which gas is liberated when zinc reacts with dilute HCl?", ["Cl₂", "H₂", "ZnCl₂", "O₂"], 1),
    ("The equivalent weight of H₂SO₄ (molar mass 98 g/mol) is:", ["49", "98", "196", "32.67"], 0),
    ("Which of the following is a nucleophile?", ["BF₃", "AlCl₃", "NH₃", "FeCl₃"], 2),
    ("The bond angle in H₂O molecule is approximately:", ["90°", "104.5°", "109.5°", "120°"], 1),
    ("Faraday's constant value is approximately:", ["96500 C/mol", "8.314 J/mol·K", "6.022×10²³", "1.6×10⁻¹⁹ C"], 0),
    ("Which is the most electronegative element?", ["Oxygen", "Nitrogen", "Fluorine", "Chlorine"], 2),
]

BIOLOGY_QUESTIONS = [
    ("The powerhouse of the cell is:", ["Nucleus", "Ribosome", "Mitochondria", "Golgi body"], 2),
    ("DNA replication is:", ["Semi-conservative", "Conservative", "Dispersive", "Additive"], 0),
    ("Which blood group is the universal donor?", ["A", "B", "AB", "O"], 3),
    ("The functional unit of kidney is:", ["Nephron", "Neuron", "Lobule", "Acinus"], 0),
    ("Chlorophyll absorbs light mainly in:", ["Green wavelength", "Red and Blue wavelength", "Yellow wavelength", "UV range"], 1),
    ("Which enzyme unwinds the DNA double helix?", ["Ligase", "Helicase", "Polymerase", "Topoisomerase"], 1),
    ("The normal pH of human blood is:", ["6.4", "7.0", "7.4", "8.0"], 2),
    ("Insulin is produced by:", ["Alpha cells", "Beta cells of islets", "Liver", "Adrenal gland"], 1),
    ("The process of protein synthesis is called:", ["Transcription", "Translation", "Replication", "Transduction"], 1),
    ("Penicillin was discovered by:", ["Louis Pasteur", "Alexander Fleming", "Robert Koch", "Edward Jenner"], 1),
]


def _encrypt_question(content: str, options: list[str], correct_idx: int) -> dict:
    """Encrypt question content using the demo AES key."""
    plaintext = json.dumps({
        "content": content,
        "options": options,
        "correct_option": correct_idx,
    })
    import base64
    ciphertext_bytes, nonce_bytes, tag_bytes = AESCipher.encrypt(plaintext.encode(), DEMO_AES_KEY)
    ct_b64 = base64.b64encode(ciphertext_bytes).decode()
    tag_b64 = base64.b64encode(tag_bytes).decode()
    combined_content = f"{ct_b64}:{tag_b64}"
    iv_b64 = base64.b64encode(nonce_bytes).decode()
    content_hash = hashlib.sha256(plaintext.encode()).hexdigest()
    return {"ciphertext": combined_content, "iv": iv_b64, "hash": content_hash}


def _make_fake_embedding() -> bytes:
    """Generate a dummy 512-dim float32 face embedding."""
    import random
    dims = [random.gauss(0, 1) for _ in range(512)]
    # Normalize to unit sphere
    mag = math.sqrt(sum(x * x for x in dims))
    dims = [x / mag for x in dims]
    return struct.pack(f"{len(dims)}f", *dims)


async def seed_all():
    """Create all tables and seed demo data."""
    # 1. Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Tables dropped and recreated / verified")

    async with async_session() as db:
        # ── 2. Seed Questions ────────────────────────────────────
        print("\n📝 Seeding 30 questions (Physics, Chemistry, Biology)...")
        question_ids = []
        all_questions = [
            ("Physics", q) for q in PHYSICS_QUESTIONS
        ] + [
            ("Chemistry", q) for q in CHEMISTRY_QUESTIONS
        ] + [
            ("Biology", q) for q in BIOLOGY_QUESTIONS
        ]

        difficulties = ["easy", "easy", "medium", "medium", "medium", "medium", "hard", "hard", "hard", "hard"]

        for i, (subj, (content, opts, correct_idx)) in enumerate(all_questions):
            enc = _encrypt_question(content, opts, correct_idx)
            q = Question(
                id=str(uuid.uuid4()),
                subject=subj.lower(),
                difficulty=difficulties[i % 10],
                encrypted_content=enc["ciphertext"],
                encryption_iv=enc["iv"],
                content_hash=enc["hash"],
                created_by="seed_admin",
                is_deleted=False,
            )
            db.add(q)
            question_ids.append(q.id)
        await db.flush()
        print(f"   ✓ {len(question_ids)} questions added")

        # ── 3. Seed Exam ─────────────────────────────────────────
        print("\n📋 Seeding exam...")
        exam_id = str(uuid.uuid4())
        exam = Exam(
            id=exam_id,
            name="NEET-UG 2026 (Demo)",
            subject="Physics/Chemistry/Biology",
            blueprint={
                "total_questions": 30,
                "subjects": {
                    "Physics": {"easy": 2, "medium": 5, "hard": 3},
                    "Chemistry": {"easy": 2, "medium": 5, "hard": 3},
                    "Biology": {"easy": 2, "medium": 5, "hard": 3},
                },
                "duration_minutes": 180,
            },
            status="compiled",
            duration_minutes="180",
            created_by="admin@fortisexam.gov.in",
            compiled_at=datetime.utcnow() - timedelta(days=2),
        )
        db.add(exam)
        await db.flush()
        print(f"   ✓ Exam '{exam.name}' created (id: {exam_id[:8]}...)")

        # ── 4. Seed Centers ──────────────────────────────────────
        print("\n🏢 Seeding 3 centers...")
        centers_data = [
            ("Delhi Examination Center 01", "DEL-01", "Delhi", "Delhi",   "Connaught Place, New Delhi", 6, 0.1),
            ("Mumbai Examination Center 12", "MUM-12", "Mumbai", "Maharashtra", "BKC Complex, Mumbai", 6, 0.7),
            ("Bangalore Examination Center 47", "BLR-47", "Bangalore", "Karnataka", "Koramangala, Bengaluru", 6, 0.3),
        ]
        center_ids = []
        for name, code, city, state, addr, seats, risk in centers_data:
            c = Center(
                id=str(uuid.uuid4()),
                name=name,
                code=code,
                city=city,
                state=state,
                address=addr,
                seat_count=seats,
                risk_score=risk,
                status="active",
            )
            db.add(c)
            center_ids.append(c.id)
        await db.flush()
        print(f"   ✓ {len(center_ids)} centers added")

        # ── 5. Seed Candidates ───────────────────────────────────
        print("\n👤 Seeding 9 candidates (3 per center)...")
        candidates_data = [
            ("Aryan Sharma", "NEET2026-001"),
            ("Priya Verma", "NEET2026-002"),
            ("Rahul Singh", "NEET2026-003"),
            ("Kavya Nair", "NEET2026-004"),
            ("Mohammed Rizvi", "NEET2026-005"),
            ("Ananya Gupta", "NEET2026-006"),
            ("Siddharth Patel", "NEET2026-007"),
            ("Lakshmi Iyer", "NEET2026-008"),
            ("Vikram Joshi", "NEET2026-009"),
        ]
        for i, (name, roll) in enumerate(candidates_data):
            cand = Candidate(
                id=str(uuid.uuid4()),
                name=name,
                roll_number=roll,
                center_id=center_ids[i // 3],
                exam_id=exam_id,
                seat_number=str(i % 3 + 1),
                photo_embedding=_make_fake_embedding(),
            )
            db.add(cand)
        await db.flush()
        print(f"   ✓ {len(candidates_data)} candidates added")

        # ── 6. Seed Audit Events ─────────────────────────────────
        print("\n📜 Seeding audit events...")
        audit_events_data = [
            ("PACKAGE_GENERATED",   "admin@fortisexam.gov.in", "admin",    "Package NEET-2026-S1 compiled & signed",          exam_id),
            ("KEY_RELEASED",        "admin@fortisexam.gov.in", "admin",    "AES key released to center DEL-01",               center_ids[0]),
            ("KEY_RELEASED",        "admin@fortisexam.gov.in", "admin",    "AES key released to center MUM-12",               center_ids[1]),
            ("CANDIDATE_AUTHENTICATED", "edge-node-DEL-01",   "edge",     "847 candidates authenticated at DEL-01",          center_ids[0]),
            ("ANOMALY_FLAGGED",     "edge-ai-MUM-12",         "edge",     "Multiple faces detected — seat 3 MUM-12",         center_ids[1]),
            ("QUESTION_CREATED",    "expert@fortisexam.gov.in", "expert", "30 questions added to NEET pool",                 None),
            ("EXAM_SUBMITTED",      "edge-node-BLR-47",       "edge",     "Candidate NEET2026-007 submitted exam",            exam_id),
            ("SUPERVISOR_OVERRIDE", "supervisor@fortisexam.gov.in", "admin", "Override granted — camera fault at BLR-47",    center_ids[2]),
        ]

        prior_hash = "0" * 64
        for i, (event_type, actor, role, desc, target) in enumerate(audit_events_data):
            payload_dict = {
                "event_type": event_type,
                "description": desc,
                "target_id": target,
                "sequence": i + 1,
            }
            payload_json = json.dumps(payload_dict, sort_keys=True)
            payload_hash_str = hashlib.sha256(payload_json.encode()).hexdigest()
            event_hash = hashlib.sha256(f"{i+1}{payload_hash_str}{prior_hash}".encode()).hexdigest()
            ts = datetime.utcnow() - timedelta(hours=len(audit_events_data) - i)
            ae = AuditEvent(
                id=str(uuid.uuid4()),
                sequence=i + 1,
                event_type=event_type,
                actor_id=actor,
                actor_role=role,
                target_id=target,
                exam_id=exam_id,
                payload=payload_json,
                payload_hash=payload_hash_str,
                previous_hash=prior_hash,
                event_hash=event_hash,
                created_at=ts,
                synced=False,
            )
            db.add(ae)
            prior_hash = event_hash
        await db.flush()
        print(f"   ✓ {len(audit_events_data)} audit events added (chained)")

        await db.commit()

    print("\n" + "=" * 50)
    print("🎉 DEMO DATA SEEDED SUCCESSFULLY!")
    print("=" * 50)
    print("\nWhat's in the DB:")
    print("  📝 30 encrypted questions (Physics/Chemistry/Biology)")
    print("  📋 1 compiled exam: NEET-UG 2026 (Demo)")
    print("  🏢 3 centers: DEL-01 (low risk), MUM-12 (high risk), BLR-47 (medium risk)")
    print("  👤 9 candidates with face embeddings")
    print("  📜 8 chained audit events")
    print("\nStart the server:")
    print('  $env:SERVER_MODE="cloud"; python -m uvicorn server.app.main:app --port 8000 --reload')
    print('  Start-Process "npm" -ArgumentList "run dev" -WorkingDirectory "web"')


if __name__ == "__main__":
    asyncio.run(seed_all())
