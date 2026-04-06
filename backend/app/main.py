import structlog
import firebase_admin
from firebase_admin import credentials
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.middleware.error_handler import register_error_handlers
from app.routers import meetings, transcribe, summarize, chat, tts, models, storage

log = structlog.get_logger()


def init_firebase(settings) -> None:
    if firebase_admin._DEFAULT_APP_NAME in firebase_admin._apps:
        return
    import json, os

    key = settings.firebase_service_account_key
    if key:
        # Could be a file path or inline JSON
        if os.path.isfile(key):
            cred = credentials.Certificate(key)
        else:
            cred = credentials.Certificate(json.loads(key))
    else:
        # Use Application Default Credentials (GCP environment)
        cred = credentials.ApplicationDefault()

    firebase_admin.initialize_app(cred, {
        "storageBucket": settings.firebase_storage_bucket or f"{settings.firebase_project_id}.appspot.com"
    })
    log.info("Firebase Admin SDK initialized")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    init_firebase(settings)
    log.info("Application started", env=settings.environment)
    yield
    log.info("Application shutting down")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version="1.0.0",
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_error_handlers(app)

    app.include_router(meetings.router, prefix="/api/meetings", tags=["meetings"])
    app.include_router(transcribe.router, prefix="/api/meetings", tags=["transcription"])
    app.include_router(summarize.router, prefix="/api/meetings", tags=["summarization"])
    app.include_router(chat.router, prefix="/api/meetings", tags=["chat"])
    app.include_router(tts.router, prefix="/api/meetings", tags=["tts"])
    app.include_router(models.router, prefix="/api/models", tags=["models"])
    app.include_router(storage.router, prefix="/api/storage", tags=["storage"])

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    return app


app = create_app()
