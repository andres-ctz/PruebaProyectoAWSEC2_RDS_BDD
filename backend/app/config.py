from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    jwt_secret: str
    jwt_expire_minutes: int = 60 * 24  # 24 horas
    aws_region: str = "us-east-1"
    videos_bucket: str
    thumbs_bucket: str
    storage: str = "s3"  # "s3" (producción) o "local" (pruebas)
    public_base_url: str = "http://localhost:8000"  # solo para modo local
    cors_origins: str = "*"

    max_video_bytes: int = 100 * 1024 * 1024  # 100 MB
    max_thumb_bytes: int = 5 * 1024 * 1024  # 5 MB




settings = Settings()
