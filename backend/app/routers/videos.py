from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app import s3, schemas
from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models import User, Video

import logging
logger = logging.getLogger("uvicorn.error")

router = APIRouter(tags=["Videos"])

THUMB_TYPES = {"image/jpeg": "jpg", "image/png": "png"}


def file_size(upload: UploadFile) -> int:
    f = upload.file
    f.seek(0, 2)
    size = f.tell()
    f.seek(0)
    return size


def get_video_or_404(db: Session, video_id: int) -> Video:
    video = db.query(Video).options(joinedload(Video.user)).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Video no encontrado")
    return video


@router.post("/videos", response_model=schemas.VideoOut, status_code=status.HTTP_201_CREATED)
def create_video(
    title: str = Form(..., min_length=1, max_length=200),
    description: str = Form(""),
    video: UploadFile = File(...),
    thumbnail: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    
    if video.content_type != "video/mp4":
        raise HTTPException(400, "El video debe ser MP4")
    if thumbnail.content_type not in THUMB_TYPES:
        raise HTTPException(400, "La miniatura debe ser JPG, JPEG o PNG")
    if file_size(video) > settings.max_video_bytes:
        raise HTTPException(413, "El video supera el máximo de 100 MB")
    if file_size(thumbnail) > settings.max_thumb_bytes:
        raise HTTPException(413, "La miniatura supera el máximo de 5 MB")

    video_url = thumb_url = None
    try:
        video_url = s3.upload_file(video.file, settings.videos_bucket, "videos", "video/mp4", "mp4")
        thumb_url = s3.upload_file(
            thumbnail.file, settings.thumbs_bucket, "thumbs",
            thumbnail.content_type, THUMB_TYPES[thumbnail.content_type],
        )
        new_video = Video(
            title=title.strip(), description=description,
            video_url=video_url, thumbnail_url=thumb_url, user_id=current_user.id,
        )
        db.add(new_video)
        db.commit()
    except Exception:
        logger.exception("Error al publicar video")
        db.rollback()
        # limpieza para no dejar archivos huérfanos en S3
        for bucket, url in ((settings.videos_bucket, video_url), (settings.thumbs_bucket, thumb_url)):
            if url:
                try:
                    s3.delete_by_url(bucket, url)
                except Exception:
                    pass
        raise HTTPException(500, "No se pudo publicar el video")
    return get_video_or_404(db, new_video.id)


@router.get("/videos", response_model=List[schemas.VideoOut])
def list_videos(
    user_id: Optional[int] = None,
    exclude: Optional[int] = None,
    random: bool = False,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    q = db.query(Video).options(joinedload(Video.user))
    if user_id is not None:
        q = q.filter(Video.user_id == user_id)
    if exclude is not None:
        q = q.filter(Video.id != exclude)
    q = q.order_by(func.random() if random else Video.created_at.desc())
    return q.offset(offset).limit(limit).all()


@router.get("/videos/{video_id}", response_model=schemas.VideoOut)
def get_video(video_id: int, db: Session = Depends(get_db)):
    get_video_or_404(db, video_id)
    # incremento atómico de vistas
    db.query(Video).filter(Video.id == video_id).update({Video.views: Video.views + 1})
    db.commit()
    return get_video_or_404(db, video_id)


@router.put("/videos/{video_id}", response_model=schemas.VideoOut)
def update_video(
    video_id: int,
    data: schemas.VideoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    video = get_video_or_404(db, video_id)
    if video.user_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No eres el dueño de este video")
    if data.title is not None:
        video.title = data.title.strip()
    if data.description is not None:
        video.description = data.description
    db.commit()
    return get_video_or_404(db, video_id)


@router.delete("/videos/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_video(
    video_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    video = get_video_or_404(db, video_id)
    if video.user_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No eres el dueño de este video")
    video_url, thumb_url = video.video_url, video.thumbnail_url
    db.delete(video)
    db.commit()
    # se borra en S3 después de confirmar la BD; si falla no se rompe la respuesta
    for bucket, url in ((settings.videos_bucket, video_url), (settings.thumbs_bucket, thumb_url)):
        try:
            s3.delete_by_url(bucket, url)
        except Exception:
            pass
