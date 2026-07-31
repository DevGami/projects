import base64
import json
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.app.models.question import Question
from shared.crypto.aes import AESCipher
from shared.crypto.hashing import HashUtils
from server.app.services.audit_service import AuditService


class QuestionService:
    """Manages encrypted question lifecycle."""

    def __init__(self, db: AsyncSession, aes_key: bytes):
        """
        Args:
            db: SQLAlchemy async session
            aes_key: Master AES key (32 bytes) for encrypting all questions in this demo.
        """
        self.db = db
        self.aes_key = aes_key
        self.audit_service = AuditService(db)

    async def create(self, subject: str, difficulty: str, content: str, options: list, correct_option: int, author_id: str) -> Question:
        """Create a question: encrypt content with AES-256-GCM, store ciphertext, log audit."""
        # Prepare plaintext content
        plaintext_dict = {
            "content": content,
            "options": options,
            "correct_option": correct_option,
        }
        plaintext_bytes = json.dumps(plaintext_dict).encode("utf-8")
        
        # Calculate hash for integrity/audit
        content_hash = HashUtils.sha256(plaintext_bytes)
        
        # Encrypt content
        ciphertext, nonce, tag = AESCipher.encrypt(plaintext_bytes, self.aes_key)
        
        # We need to store tag as well to decrypt. In the model we have `encrypted_content` and `encryption_iv`.
        # We can store tag appended to ciphertext or encoded together.
        # Let's store ciphertext + tag (AESCipher.decrypt expects them separate, so we'll encode both in encrypted_content or use IV field).
        # Actually, standard way is to append tag to ciphertext: ciphertext_with_tag = ciphertext + tag
        # wait, AESCipher.encrypt returns ciphertext, nonce, tag. AESCipher.decrypt takes ciphertext, key, nonce, tag.
        # Let's store ciphertext as base64 and tag as base64. Wait, the model doesn't have an auth_tag field.
        # Oh, the DatabaseDesign.md says `auth_tag` exists, but `question.py` model didn't have it.
        # Let's pack tag into the ciphertext string: f"{b64_ciphertext}:{b64_tag}"
        b64_ciphertext = base64.b64encode(ciphertext).decode("utf-8")
        b64_tag = base64.b64encode(tag).decode("utf-8")
        combined_content = f"{b64_ciphertext}:{b64_tag}"
        
        b64_nonce = base64.b64encode(nonce).decode("utf-8")

        q = Question(
            subject=subject,
            difficulty=difficulty,
            encrypted_content=combined_content,
            encryption_iv=b64_nonce,
            content_hash=content_hash,
            created_by=author_id,
        )
        self.db.add(q)
        await self.db.flush()  # To get q.id

        await self.audit_service.log_event(
            event_type="QUESTION_CREATED",
            actor_id=author_id,
            target_id=str(q.id),
            payload={"subject": subject, "difficulty": difficulty, "content_hash": content_hash}
        )
        
        return q

    async def get(self, question_id: str) -> dict:
        """Get question metadata and decrypt content."""
        q = await self.db.scalar(select(Question).where(Question.id == question_id, Question.is_deleted == False))
        if not q:
            raise ValueError("Question not found")
            
        # Unpack ciphertext and tag
        parts = q.encrypted_content.split(":")
        if len(parts) != 2:
            raise ValueError("Corrupted encrypted_content format")
        ciphertext = base64.b64decode(parts[0])
        tag = base64.b64decode(parts[1])
        nonce = base64.b64decode(q.encryption_iv)
        
        # Decrypt
        plaintext = AESCipher.decrypt(ciphertext, self.aes_key, nonce, tag)
        content_data = json.loads(plaintext.decode("utf-8"))
        
        return {
            "id": str(q.id),
            "subject": q.subject,
            "difficulty": q.difficulty,
            "content": content_data["content"],
            "options": content_data["options"],
            "correct_option": content_data["correct_option"],
            "content_hash": q.content_hash,
            "created_by": q.created_by,
        }

    async def list_all(self, page: int = 1, page_size: int = 20) -> list[dict]:
        """List questions with pagination (metadata only)."""
        offset = (page - 1) * page_size
        stmt = select(Question).where(Question.is_deleted == False).offset(offset).limit(page_size)
        result = await self.db.scalars(stmt)
        questions = []
        for q in result.all():
            questions.append({
                "id": str(q.id),
                "subject": q.subject,
                "difficulty": q.difficulty,
                "created_by": q.created_by,
                "content_hash": q.content_hash,
            })
        return questions

    async def update(self, question_id: str, subject: str, difficulty: str, content: str, options: list, correct_option: int, editor_id: str) -> dict:
        """Update and re-encrypt question content."""
        q = await self.db.scalar(select(Question).where(Question.id == question_id, Question.is_deleted == False))
        if not q:
            raise ValueError("Question not found")
            
        plaintext_dict = {
            "content": content,
            "options": options,
            "correct_option": correct_option,
        }
        plaintext_bytes = json.dumps(plaintext_dict).encode("utf-8")
        content_hash = HashUtils.sha256(plaintext_bytes)
        
        ciphertext, nonce, tag = AESCipher.encrypt(plaintext_bytes, self.aes_key)
        
        b64_ciphertext = base64.b64encode(ciphertext).decode("utf-8")
        b64_tag = base64.b64encode(tag).decode("utf-8")
        combined_content = f"{b64_ciphertext}:{b64_tag}"
        b64_nonce = base64.b64encode(nonce).decode("utf-8")
        
        q.subject = subject
        q.difficulty = difficulty
        q.encrypted_content = combined_content
        q.encryption_iv = b64_nonce
        q.content_hash = content_hash
        
        await self.db.flush()
        
        await self.audit_service.log_event(
            event_type="QUESTION_UPDATED",
            actor_id=editor_id,
            target_id=str(q.id),
            payload={"subject": subject, "content_hash": content_hash}
        )
        
        return {"id": str(q.id), "status": "updated"}

    async def delete(self, question_id: str, deleter_id: str) -> bool:
        """Soft-delete a question."""
        q = await self.db.scalar(select(Question).where(Question.id == question_id, Question.is_deleted == False))
        if not q:
            raise ValueError("Question not found")
            
        q.is_deleted = True
        await self.db.flush()
        
        await self.audit_service.log_event(
            event_type="QUESTION_DELETED",
            actor_id=deleter_id,
            target_id=str(q.id),
            payload={}
        )
        
        return True
