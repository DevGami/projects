"""
FortisExam Server — Entry Point

Mode-switchable FastAPI application:
  - SERVER_MODE=cloud  → PostgreSQL, Clerk JWT auth, cloud routes
  - SERVER_MODE=edge   → SQLite (WAL), custom RSA JWT auth, edge routes

Usage:
  uvicorn server.app.main:app --host 0.0.0.0 --port 8000
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from server.app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan — startup and shutdown hooks."""
    import os
    from server.app.db.database import engine, Base
    from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession
    import server.app.models  # noqa: F401 — register all models before create_all

    # --- Auto-create tables (both modes) ---
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # --- RSA keys (edge mode needs them for JWT signing) ---
    if settings.server_mode == "edge":
        try:
            from shared.crypto.rsa import RSASigner
            os.makedirs("./keys", exist_ok=True)
            if not os.path.exists("./keys/private.pem"):
                priv, pub = RSASigner.generate_key_pair()
                with open("./keys/private.pem", "wb") as f:
                    f.write(priv)
                with open("./keys/public.pem", "wb") as f:
                    f.write(pub)
        except Exception as e:
            print(f"[lifespan] RSA key generation skipped: {e}")

    # --- Seed demo data ---
    try:
        from server.app.seed import seed_edge, seed_cloud
        SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        async with SessionLocal() as session:
            if settings.server_mode == "edge":
                await seed_edge(session)
            else:
                await seed_cloud(session)
    except Exception as e:
        print(f"[lifespan] Seed skipped: {e}")

    yield
    await engine.dispose()


def create_app() -> FastAPI:
    """Factory function to create the FastAPI application based on SERVER_MODE."""
    app = FastAPI(
        title="FortisExam API",
        description=f"Zero-Trust Examination Infrastructure — Mode: {settings.server_mode}",
        version="0.1.0",
        lifespan=lifespan,
    )

    # --- CORS Middleware ---
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # --- Common Routes (both modes) ---
    from server.app.api.common.health import router as health_router
    from server.app.api.common.audit import router as audit_router

    app.include_router(health_router, tags=["Health"])
    app.include_router(audit_router, prefix="/api/v1", tags=["Audit"])

    # --- Mode-specific Routes ---
    if settings.server_mode == "cloud":
        _mount_cloud_routes(app)
        # Also mount edge routes in cloud mode so the deployed kiosk
        # (Vercel) can hit auth/exam endpoints on the same Render backend
        _mount_edge_routes(app)
    elif settings.server_mode == "edge":
        _mount_edge_routes(app)

    return app


def _mount_cloud_routes(app: FastAPI) -> None:
    """Mount cloud-only API routes (questions, exams, packages, distribution, centers)."""
    from server.app.api.cloud.questions import router as questions_router
    from server.app.api.cloud.exams import router as exams_router
    from server.app.api.cloud.packages import router as packages_router
    from server.app.api.cloud.distribution import router as distribution_router
    from server.app.api.cloud.users import router as users_router
    from server.app.api.cloud.dashboard import router as dashboard_router
    from server.app.api.cloud.centers import router as centers_router

    app.include_router(questions_router, prefix="/api/v1", tags=["Questions"])
    app.include_router(exams_router, prefix="/api/v1", tags=["Exams"])
    app.include_router(packages_router, prefix="/api/v1", tags=["Packages"])
    app.include_router(distribution_router, prefix="/api/v1", tags=["Distribution"])
    app.include_router(users_router, prefix="/api/v1", tags=["Users"])
    app.include_router(dashboard_router, prefix="/api/v1", tags=["Dashboard"])
    app.include_router(centers_router, prefix="/api/v1", tags=["Centers"])



def _mount_edge_routes(app: FastAPI) -> None:
    """Mount edge-only API routes (auth, exam execution, recovery, monitoring)."""
    from server.app.api.edge.auth import router as auth_router
    from server.app.api.edge.exam import router as exam_router
    from server.app.api.edge.recovery import router as recovery_router
    from server.app.api.edge.monitoring import router as monitoring_router

    app.include_router(auth_router, prefix="/api/v1", tags=["Authentication"])
    app.include_router(exam_router, prefix="/api/v1", tags=["Exam"])
    app.include_router(recovery_router, prefix="/api/v1", tags=["Recovery"])
    app.include_router(monitoring_router, prefix="/api/v1", tags=["Monitoring"])


app = create_app()
