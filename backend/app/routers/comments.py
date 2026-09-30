from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app import schemas
from app.auth import get_current_user
from app.database import get_db
from app.models import Comment, User, Video

router = APIRouter(tags=["Comentarios"])


@router.post(
    "/videos/{video_id}/comments",
    response_model=schemas.CommentOut,
    status_code=status.HTTP_201_CREATED,
)
def create_comment(
    video_id: int,
    data: schemas.CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not db.get(Video, video_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Video no encontrado")
    comment = Comment(content=data.content.strip(), user_id=current_user.id, video_id=video_id)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


@router.get("/videos/{video_id}/comments", response_model=List[schemas.CommentOut])
def list_comments(video_id: int, db: Session = Depends(get_db)):
    if not db.get(Video, video_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Video no encontrado")
    return (
        db.query(Comment)
        .options(joinedload(Comment.user))
        .filter(Comment.video_id == video_id)
        .order_by(Comment.created_at.desc())
        .all()
    )
