import asyncio
import httpx

EDGE_URL = "http://127.0.0.1:8001/api/v1"
EXAM_ID = "21e87336-b68c-45c6-8f2b-3de2d8696ec3"
CANDIDATE_ID = "4a4224cb-d420-4107-bc62-d778f416dc99"

async def run_simulation():
    print("🚀 Starting Kiosk Simulation against Edge Server...")

    async with httpx.AsyncClient() as client:
        print(f"✅ Hardcoded Exam: {EXAM_ID}")
        print(f"✅ Hardcoded Candidate: {CANDIDATE_ID}")

        # 1. Supervisor Override (Auth)
        print("\n--- 1. Authenticating via Supervisor Override ---")
        auth_req = {
            "candidate_id": CANDIDATE_ID,
            "exam_id": EXAM_ID,
            "invigilator_id": "test_invigilator",
            "reason": "automated_testing"
        }
        res = await client.post(f"{EDGE_URL}/auth/supervisor-override", json=auth_req)
        if res.status_code != 200:
            print(f"❌ Auth Failed: {res.status_code} {res.text}")
            return
        auth_data = res.json()
        session_id = auth_data["session_id"]
        token = auth_data["token"]
        print(f"✅ Auth Success! Session ID: {session_id}")

        headers = {"Authorization": f"Bearer {token}"}

        # 2. Load Session
        print("\n--- 2. Loading Exam Session ---")
        res = await client.get(f"{EDGE_URL}/exam/session/{session_id}", headers=headers)
        if res.status_code != 200:
            print(f"❌ Load Session Failed: {res.status_code} {res.text}")
            return
        session_data = res.json()
        print(f"✅ Loaded Session! Exam Title: {session_data.get('exam_title')}")
        print(f"   Questions loaded: {session_data.get('total_questions')}")

        if not session_data.get('questions'):
            print("❌ ERROR: No questions returned in session!")
            return

        question_id = session_data["questions"][0]["id"]

        # 3. Submit Answer
        print("\n--- 3. Submitting Answer ---")
        ans_req = {
            "session_id": session_id,
            "question_id": question_id,
            "selected_option": "B",
            "current_question_index": 0,
            "remaining_seconds": 10000
        }
        res = await client.post(f"{EDGE_URL}/exam/answer", json=ans_req, headers=headers)
        if res.status_code != 200:
            print(f"❌ Submit Answer Failed: {res.status_code} {res.text}")
            return
        print(f"✅ Answer Submitted! Hash: {res.json()['answer_hash']}")

        # 4. Final Submit Exam
        print("\n--- 4. Submitting Final Exam ---")
        sub_req = {"session_id": session_id}
        res = await client.post(f"{EDGE_URL}/exam/submit", json=sub_req, headers=headers)
        if res.status_code != 200:
            print(f"❌ Submit Exam Failed: {res.status_code} {res.text}")
            return
        print(f"✅ Exam Submitted! Submission Hash: {res.json()['submission_hash']}")

        print("\n🎉 SIMULATION COMPLETE AND SUCCESSFUL")

if __name__ == "__main__":
    asyncio.run(run_simulation())
