from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.routers import comments, users, videos
from pathlib import Path
from fastapi.staticfiles import StaticFiles

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Video Platform API", version="1.0.0")

if settings.storage == "local":
    Path("uploads").mkdir(exist_ok=True)
    app.mount("/media", StaticFiles(directory="uploads"), name="media")

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,  # usamos Bearer token, no cookies
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(videos.router)
app.include_router(comments.router)


@app.get("/health", tags=["Sistema"])
def health():
    return {"status": "ok"}
