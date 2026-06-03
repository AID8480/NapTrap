from contextlib import asynccontextmanager
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.auth.router import router as auth_router
from backend.database import create_all_tables
from backend.session.router import router as session_router
from backend.user.router import router as user_router
from backend.ws.router import router as ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await create_all_tables()
    except Exception as e:
        print(f"[startup] DB init skipped: {e}")
    yield


app = FastAPI(title="NapTrap API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth")
app.include_router(user_router, prefix="/user")
app.include_router(session_router, prefix="/session")
app.include_router(ws_router)


@app.get("/health")
async def health():
    return {"status": "ok"}


# Serve React frontend static assets
_frontend_dist = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "dist")
app.mount("/assets", StaticFiles(directory=os.path.join(_frontend_dist, "assets")), name="assets")


# SPA catch-all — must be after all API routes
@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    if full_path.startswith("ws/"):
        raise HTTPException(status_code=404)
    return FileResponse(Path(_frontend_dist) / "index.html")
