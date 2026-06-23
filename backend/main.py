"""
CareerNode Backend — FastAPI Application Entry Point
"""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from db.mongo import connect_db, close_db
from routers.jobs import router as jobs_router
from routers.gmail import router as gmail_router
from routers.ai import router as ai_router
from routers.resumes import router as resumes_router, projects_router
from routers.analytics import router as analytics_router
from routers.radar import router as radar_router
from services.scheduler import start_scheduler, stop_scheduler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("🚀 CareerNode Backend starting...")
    await connect_db()
    start_scheduler()
    yield
    logger.info("🔌 CareerNode Backend shutting down...")
    stop_scheduler()
    await close_db()


app = FastAPI(
    title="CareerNode API",
    description="Local AI-Powered Job Application Tracker",
    version="1.0.0",
    lifespan=lifespan,
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(jobs_router, prefix="/api/v1")
app.include_router(gmail_router, prefix="/api/v1")
app.include_router(ai_router, prefix="/api/v1")
app.include_router(resumes_router, prefix="/api/v1")
app.include_router(projects_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")
app.include_router(radar_router, prefix="/api/v1")


@app.get("/")
async def root():
    return {
        "app": "CareerNode API",
        "version": "1.0.0",
        "docs": "/docs",
        "status": "running",
    }


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("BACKEND_PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
