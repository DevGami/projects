"""
FortisExam — Comprehensive Seed Data

Called from main.py lifespan(). Seeds:
  - EDGE mode:  30 AES-encrypted questions, 1 exam, 1 candidate
  - CLOUD mode: 30 AES-encrypted questions, 3 exams, 5 centers, 10 candidates, 1 user
"""

import base64
import json
import uuid as _uuid

from shared.crypto.aes import AESCipher
from shared.crypto.hashing import HashUtils

AES_KEY = b"12345678901234567890123456789012"  # same key used in exam.py


# ─── 30 Demo Questions ────────────────────────────────────────────────────────

DEMO_QUESTIONS = [
    # Physics (10)
    {"subject": "Physics", "difficulty": "Easy",
     "content": "A ball is thrown vertically upward. At the highest point, its velocity is:",
     "options": ["Maximum", "Zero", "Equal to initial", "Negative"], "correct_option": 1},
    {"subject": "Physics", "difficulty": "Easy",
     "content": "The SI unit of force is:",
     "options": ["Joule", "Watt", "Newton", "Pascal"], "correct_option": 2},
    {"subject": "Physics", "difficulty": "Medium",
     "content": "The SI unit of electric current is:",
     "options": ["Volt", "Ohm", "Ampere", "Watt"], "correct_option": 2},
    {"subject": "Physics", "difficulty": "Medium",
     "content": "Which of the following is a vector quantity?",
     "options": ["Speed", "Distance", "Mass", "Displacement"], "correct_option": 3},
    {"subject": "Physics", "difficulty": "Medium",
     "content": "The phenomenon of splitting white light into its component colors is called:",
     "options": ["Reflection", "Refraction", "Dispersion", "Diffraction"], "correct_option": 2},
    {"subject": "Physics", "difficulty": "Hard",
     "content": "According to Heisenberg's uncertainty principle, we cannot simultaneously determine:",
     "options": ["Mass and velocity", "Position and momentum", "Charge and mass", "Energy and charge"], "correct_option": 1},
    {"subject": "Physics", "difficulty": "Hard",
     "content": "In photoelectric effect, the maximum kinetic energy of emitted electrons depends on:",
     "options": ["Intensity of light", "Frequency of light", "Speed of light", "Wavelength only"], "correct_option": 1},
    {"subject": "Physics", "difficulty": "Easy",
     "content": "Sound cannot travel through:",
     "options": ["Air", "Water", "Steel", "Vacuum"], "correct_option": 3},
    {"subject": "Physics", "difficulty": "Medium",
     "content": "The resistance of a conductor increases with:",
     "options": ["Decrease in length", "Increase in area", "Increase in temperature", "Decrease in temperature"], "correct_option": 2},
    {"subject": "Physics", "difficulty": "Hard",
     "content": "The de Broglie wavelength of a particle is inversely proportional to its:",
     "options": ["Energy", "Momentum", "Mass", "Charge"], "correct_option": 1},

    # Chemistry (10)
    {"subject": "Chemistry", "difficulty": "Easy",
     "content": "The chemical formula for water is:",
     "options": ["H2O2", "H2O", "HO", "OH2"], "correct_option": 1},
    {"subject": "Chemistry", "difficulty": "Easy",
     "content": "Which gas is most abundant in Earth's atmosphere?",
     "options": ["Oxygen", "Carbon dioxide", "Nitrogen", "Argon"], "correct_option": 2},
    {"subject": "Chemistry", "difficulty": "Medium",
     "content": "The pH of a neutral solution at 25°C is:",
     "options": ["0", "7", "14", "1"], "correct_option": 1},
    {"subject": "Chemistry", "difficulty": "Medium",
     "content": "Which of the following is a noble gas?",
     "options": ["Nitrogen", "Hydrogen", "Neon", "Chlorine"], "correct_option": 2},
    {"subject": "Chemistry", "difficulty": "Medium",
     "content": "The process of converting a solid directly to gas is called:",
     "options": ["Evaporation", "Condensation", "Sublimation", "Deposition"], "correct_option": 2},
    {"subject": "Chemistry", "difficulty": "Hard",
     "content": "In the periodic table, elements are arranged in order of increasing:",
     "options": ["Mass number", "Atomic number", "Neutron number", "Electron affinity"], "correct_option": 1},
    {"subject": "Chemistry", "difficulty": "Hard",
     "content": "Which type of bond is formed between sodium and chlorine in NaCl?",
     "options": ["Covalent", "Ionic", "Metallic", "Hydrogen"], "correct_option": 1},
    {"subject": "Chemistry", "difficulty": "Easy",
     "content": "Rusting of iron is an example of:",
     "options": ["Physical change", "Chemical change", "Nuclear change", "No change"], "correct_option": 1},
    {"subject": "Chemistry", "difficulty": "Medium",
     "content": "The number of moles of a substance is calculated by:",
     "options": ["Mass × Molar mass", "Mass / Molar mass", "Molar mass / Mass", "Volume × Density"], "correct_option": 1},
    {"subject": "Chemistry", "difficulty": "Hard",
     "content": "Avogadro's number is approximately:",
     "options": ["6.022 × 10²³", "3.14 × 10⁸", "1.6 × 10⁻¹⁹", "9.8 × 10²"], "correct_option": 0},

    # Biology (5)
    {"subject": "Biology", "difficulty": "Easy",
     "content": "The powerhouse of the cell is:",
     "options": ["Nucleus", "Ribosome", "Mitochondria", "Golgi body"], "correct_option": 2},
    {"subject": "Biology", "difficulty": "Easy",
     "content": "DNA stands for:",
     "options": ["Deoxyribonucleic Acid", "Dinitrogen Acid", "Deoxyribose Nucleic Atom", "Dynamic Nuclear Acid"], "correct_option": 0},
    {"subject": "Biology", "difficulty": "Medium",
     "content": "Which organ is responsible for filtering blood in the human body?",
     "options": ["Heart", "Liver", "Kidney", "Lungs"], "correct_option": 2},
    {"subject": "Biology", "difficulty": "Medium",
     "content": "Photosynthesis takes place in:",
     "options": ["Mitochondria", "Chloroplast", "Nucleus", "Ribosome"], "correct_option": 1},
    {"subject": "Biology", "difficulty": "Hard",
     "content": "Which of the following is NOT a function of the liver?",
     "options": ["Bile production", "Blood filtration", "Pumping blood", "Detoxification"], "correct_option": 2},

    # Mathematics (5)
    {"subject": "Mathematics", "difficulty": "Easy",
     "content": "What is the value of π (pi) approximately?",
     "options": ["2.14", "3.14", "4.14", "1.14"], "correct_option": 1},
    {"subject": "Mathematics", "difficulty": "Medium",
     "content": "What is the derivative of x²?",
     "options": ["x", "2x", "2", "x³"], "correct_option": 1},
    {"subject": "Mathematics", "difficulty": "Medium",
     "content": "The integral of 2x dx is:",
     "options": ["x²", "x² + C", "2x²", "x + C"], "correct_option": 1},
    {"subject": "Mathematics", "difficulty": "Hard",
     "content": "The determinant of a 2×2 identity matrix is:",
     "options": ["0", "1", "2", "Undefined"], "correct_option": 1},
    {"subject": "Mathematics", "difficulty": "Hard",
     "content": "lim(x→0) sin(x)/x equals:",
     "options": ["0", "1", "∞", "Undefined"], "correct_option": 1},
]


def _encrypt_question(data: dict) -> tuple[str, str, str]:
    """Encrypt a question dict and return (encrypted_content, iv, hash)."""
    plaintext = json.dumps({
        "content": data["content"],
        "options": data["options"],
        "correct_option": data["correct_option"],
    }).encode("utf-8")
    ct, nonce, tag = AESCipher.encrypt(plaintext, AES_KEY)
    enc_content = f"{base64.b64encode(ct).decode()}:{base64.b64encode(tag).decode()}"
    enc_iv = base64.b64encode(nonce).decode()
    content_hash = HashUtils.sha256(plaintext)
    return enc_content, enc_iv, content_hash


# ─── Fixed UUIDs for deterministic seeding ─────────────────────────────────

EXAM_IDS = [
    "21e87336-b68c-45c6-8f2b-3de2d8696ec3",
    "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "b2c3d4e5-f6a7-8901-bcde-f12345678901",
]

CENTER_IDS = [
    "c0000001-0000-0000-0000-000000000001",
    "c0000002-0000-0000-0000-000000000002",
    "c0000003-0000-0000-0000-000000000003",
    "c0000004-0000-0000-0000-000000000004",
    "c0000005-0000-0000-0000-000000000005",
]

CANDIDATE_ID = "4a4224cb-d420-4107-bc62-d778f416dc99"


async def seed_edge(session):
    """Seed edge-mode SQLite with 30 questions + 1 exam + 1 candidate."""
    from sqlalchemy import select, func
    from server.app.models.question import Question
    from server.app.models.exam import Exam
    from server.app.models.candidate import Candidate

    q_count = (await session.execute(select(func.count(Question.id)))).scalar() or 0
    if q_count >= 30:
        print(f"[seed] Edge already has {q_count} questions — skipping")
        return

    # Seed all 30 questions
    for d in DEMO_QUESTIONS:
        enc_content, enc_iv, content_hash = _encrypt_question(d)
        session.add(Question(
            id=str(_uuid.uuid4()), subject=d["subject"], difficulty=d["difficulty"],
            encrypted_content=enc_content, encryption_iv=enc_iv,
            content_hash=content_hash, created_by="system",
        ))

    # Exam
    exam_exists = (await session.execute(select(Exam).where(Exam.id == EXAM_IDS[0]))).scalar_one_or_none()
    if not exam_exists:
        session.add(Exam(
            id=EXAM_IDS[0], name="Hackathon Demo Exam", subject="General Science",
            blueprint={"physics": 10, "chemistry": 10, "biology": 5, "math": 5},
            duration_minutes="60", created_by="system", status="active",
        ))

    # Candidate
    cand_exists = (await session.execute(select(Candidate).where(Candidate.id == CANDIDATE_ID))).scalar_one_or_none()
    if not cand_exists:
        session.add(Candidate(
            id=CANDIDATE_ID, name="Test Candidate", roll_number="TEST001",
            center_id=CENTER_IDS[0], exam_id=EXAM_IDS[0], seat_number="1A",
        ))

    await session.commit()
    final_count = (await session.execute(select(func.count(Question.id)))).scalar() or 0
    print(f"[seed] Edge seed complete — {final_count} questions, 1 exam, 1 candidate")


async def seed_cloud(session):
    """Seed cloud-mode PostgreSQL with full admin panel test data."""
    from sqlalchemy import select, func
    from server.app.models.question import Question
    from server.app.models.exam import Exam
    from server.app.models.center import Center
    from server.app.models.candidate import Candidate
    from server.app.models.user import User

    q_count = (await session.execute(select(func.count(Question.id)))).scalar() or 0
    if q_count >= 30:
        print(f"[seed] Cloud already has {q_count} questions — skipping")
        return

    # ── 30 Questions ──
    for d in DEMO_QUESTIONS:
        enc_content, enc_iv, content_hash = _encrypt_question(d)
        session.add(Question(
            id=str(_uuid.uuid4()), subject=d["subject"], difficulty=d["difficulty"],
            encrypted_content=enc_content, encryption_iv=enc_iv,
            content_hash=content_hash, created_by="system",
        ))

    # ── 3 Exams ──
    exams_data = [
        {"id": EXAM_IDS[0], "name": "NEET Mock — General Science",   "subject": "General Science", "status": "active",    "duration": "180"},
        {"id": EXAM_IDS[1], "name": "JEE Main — Physics & Chemistry", "subject": "Physics",         "status": "compiled",  "duration": "180"},
        {"id": EXAM_IDS[2], "name": "Board Exam — Mathematics",       "subject": "Mathematics",     "status": "draft",     "duration": "120"},
    ]
    for e in exams_data:
        exists = (await session.execute(select(Exam).where(Exam.id == e["id"]))).scalar_one_or_none()
        if not exists:
            session.add(Exam(
                id=e["id"], name=e["name"], subject=e["subject"], status=e["status"],
                blueprint={"physics": 10, "chemistry": 10, "biology": 5, "math": 5},
                duration_minutes=e["duration"], created_by="system",
            ))

    # ── 5 Centers ──
    centers_data = [
        {"id": CENTER_IDS[0], "name": "Delhi Examination Hall A",    "code": "DEL-A", "city": "New Delhi",  "state": "Delhi",        "seats": 120},
        {"id": CENTER_IDS[1], "name": "Mumbai Testing Center",       "code": "MUM-1", "city": "Mumbai",     "state": "Maharashtra",  "seats": 200},
        {"id": CENTER_IDS[2], "name": "Bangalore Tech Park Center",  "code": "BLR-T", "city": "Bangalore",  "state": "Karnataka",    "seats": 150},
        {"id": CENTER_IDS[3], "name": "Chennai Central Hall",        "code": "CHN-C", "city": "Chennai",    "state": "Tamil Nadu",   "seats": 180},
        {"id": CENTER_IDS[4], "name": "Kolkata Science Academy",     "code": "KOL-S", "city": "Kolkata",    "state": "West Bengal",  "seats": 100},
    ]
    for c in centers_data:
        exists = (await session.execute(select(Center).where(Center.id == c["id"]))).scalar_one_or_none()
        if not exists:
            session.add(Center(
                id=c["id"], name=c["name"], code=c["code"], city=c["city"],
                state=c["state"], seat_count=c["seats"], status="active",
            ))

    # ── 10 Candidates ──
    candidate_data = [
        {"name": "Aarav Sharma",     "roll": "NEET2026001", "center": 0, "seat": "1A"},
        {"name": "Priya Patel",      "roll": "NEET2026002", "center": 0, "seat": "1B"},
        {"name": "Rahul Verma",      "roll": "NEET2026003", "center": 0, "seat": "2A"},
        {"name": "Sneha Gupta",      "roll": "NEET2026004", "center": 1, "seat": "1A"},
        {"name": "Arjun Singh",      "roll": "NEET2026005", "center": 1, "seat": "1B"},
        {"name": "Kavya Nair",       "roll": "NEET2026006", "center": 2, "seat": "1A"},
        {"name": "Vikram Reddy",     "roll": "NEET2026007", "center": 2, "seat": "2A"},
        {"name": "Ananya Iyer",      "roll": "NEET2026008", "center": 3, "seat": "1A"},
        {"name": "Rohan Joshi",      "roll": "NEET2026009", "center": 3, "seat": "1B"},
        {"name": "Meera Kapoor",     "roll": "NEET2026010", "center": 4, "seat": "1A"},
    ]
    # First candidate gets the fixed ID for kiosk testing
    for i, cd in enumerate(candidate_data):
        cid = CANDIDATE_ID if i == 0 else str(_uuid.uuid4())
        exists = None
        if i == 0:
            exists = (await session.execute(select(Candidate).where(Candidate.id == cid))).scalar_one_or_none()
        if not exists:
            session.add(Candidate(
                id=cid, name=cd["name"], roll_number=cd["roll"],
                center_id=CENTER_IDS[cd["center"]], exam_id=EXAM_IDS[0], seat_number=cd["seat"],
            ))

    # ── 1 Admin User (for dashboard) ──
    admin_exists = (await session.execute(select(User).where(User.clerk_user_id == "system_admin"))).scalar_one_or_none()
    if not admin_exists:
        session.add(User(
            id=str(_uuid.uuid4()), clerk_user_id="system_admin",
            role="admin", name="System Administrator",
        ))

    # ── 3 Packages (Distribution) ──
    from server.app.models.package import Package
    packages_data = [
        {"id": str(_uuid.uuid4()), "exam": EXAM_IDS[0], "status": "activated"},
        {"id": str(_uuid.uuid4()), "exam": EXAM_IDS[1], "status": "distributed"},
        {"id": str(_uuid.uuid4()), "exam": EXAM_IDS[2], "status": "generated"},
    ]
    for p in packages_data:
        exists = (await session.execute(select(Package).where(Package.id == p["id"]))).scalar_one_or_none()
        if not exists:
            session.add(Package(
                id=p["id"], exam_id=p["exam"], encrypted_payload="enc_demo",
                encryption_iv="iv_demo", package_hash="hash_demo",
                signature="sig_demo", status=p["status"]
            ))

    # ── Mock Audit Events ──
    from server.app.models.audit_event import AuditEvent
    import hashlib
    
    # We need to compute sequence and hashes properly to avoid unique constraint errors
    max_seq = (await session.execute(select(func.max(AuditEvent.sequence)))).scalar() or 0
    if max_seq == 0:
        events = [
            {"type": "SYSTEM_STARTUP", "actor": "system", "payload": '{"version": "0.1.0"}'},
            {"type": "QUESTION_CREATED", "actor": "system_admin", "payload": '{"subject": "Physics"}'},
            {"type": "PACKAGE_GENERATED", "actor": "system_admin", "payload": f'{{"exam_id": "{EXAM_IDS[0]}"}}'},
            {"type": "PACKAGE_DISTRIBUTED", "actor": "system", "payload": f'{{"center_id": "{CENTER_IDS[0]}"}}'},
            {"type": "KEY_RELEASE_AUTHORIZED", "actor": "system_admin", "payload": '{"authorized": true}'},
            {"type": "EXAM_STARTED", "actor": "system", "payload": f'{{"exam_id": "{EXAM_IDS[0]}"}}'},
        ]
        
        prev_hash = "0" * 64
        for i, ev in enumerate(events):
            seq = i + 1
            payload_hash = hashlib.sha256(ev["payload"].encode()).hexdigest()
            chain_str = f"{seq}{payload_hash}{prev_hash}"
            event_hash = hashlib.sha256(chain_str.encode()).hexdigest()
            
            session.add(AuditEvent(
                id=str(_uuid.uuid4()),
                sequence=seq,
                event_type=ev["type"],
                actor_id=ev["actor"],
                actor_role="admin" if "admin" in ev["actor"] else "system",
                payload=ev["payload"],
                payload_hash=payload_hash,
                previous_hash=prev_hash,
                event_hash=event_hash,
            ))
            prev_hash = event_hash

    await session.commit()
    final_count = (await session.execute(select(func.count(Question.id)))).scalar() or 0
    pkg_count = (await session.execute(select(func.count(Package.id)))).scalar() or 0
    aud_count = (await session.execute(select(func.count(AuditEvent.id)))).scalar() or 0
    print(f"[seed] Cloud seed complete — {final_count} questions, 3 exams, 5 centers, 10 candidates, {pkg_count} packages, {aud_count} audit events")
