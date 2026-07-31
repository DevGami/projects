import asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from server.app.models.question import Question
from server.app.config import settings

async def seed():
    engine = create_async_engine(settings.database_url, echo=False)
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    
    questions = [
        Question(subject="Physics", difficulty="Easy", encrypted_content="enc1", encryption_iv="iv1", content_hash="hash1", created_by="system"),
        Question(subject="Physics", difficulty="Hard", encrypted_content="enc2", encryption_iv="iv2", content_hash="hash2", created_by="system"),
        Question(subject="Chemistry", difficulty="Medium", encrypted_content="enc3", encryption_iv="iv3", content_hash="hash3", created_by="system"),
        Question(subject="Biology", difficulty="Easy", encrypted_content="enc4", encryption_iv="iv4", content_hash="hash4", created_by="system"),
        Question(subject="Biology", difficulty="Medium", encrypted_content="enc5", encryption_iv="iv5", content_hash="hash5", created_by="system"),
    ]
    
    async with async_session() as session:
        session.add_all(questions)
        await session.commit()
    print("Seeded 5 questions directly to DB!")

if __name__ == "__main__":
    asyncio.run(seed())
