"""Subida y borrado en S3. Sin llaves: boto3 toma las credenciales del IAM Role de la EC2."""
import uuid
from urllib.parse import unquote, urlparse

import boto3

from app.config import settings
import shutil
from pathlib import Path

_client = None


def client():
    global _client
    if _client is None:
        _client = boto3.client("s3", region_name=settings.aws_region)
    return _client


LOCAL_DIR = Path("uploads")

def upload_file(fileobj, bucket: str, folder: str, content_type: str, ext: str) -> str:
    name = f"{folder}/{uuid.uuid4()}.{ext}"
    if settings.storage == "local":
        dest = LOCAL_DIR / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        with open(dest, "wb") as out:
            shutil.copyfileobj(fileobj, out)
        return f"{settings.public_base_url}/media/{name}"
    client().upload_fileobj(fileobj, bucket, name, ExtraArgs={"ContentType": content_type})
    return f"https://{bucket}.s3.{settings.aws_region}.amazonaws.com/{name}"


def delete_by_url(bucket: str, url: str) -> None:
    if settings.storage == "local":
        (LOCAL_DIR / url.split("/media/", 1)[1]).unlink(missing_ok=True)
        return
    key = unquote(urlparse(url).path.lstrip("/"))
    if key:
        client().delete_object(Bucket=bucket, Key=key)
