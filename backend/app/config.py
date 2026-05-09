from __future__ import annotations

import secrets
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: Literal["dev", "prod"] = "dev"
    database_url: str = "sqlite+aiosqlite:///./data/app.db"

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_db_url(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        # Railway entrega postgresql:// o postgres://, SQLAlchemy async necesita postgresql+asyncpg://
        if value.startswith("postgres://"):
            return "postgresql+asyncpg://" + value[len("postgres://"):]
        if value.startswith("postgresql://"):
            return "postgresql+asyncpg://" + value[len("postgresql://"):]
        return value
    jwt_secret: str | None = None
    jwt_alg: str = "HS256"
    session_ttl_minutes: int = 602430
    qr_ttl_seconds: int = 90
    restaurant_id: str = "frittes-maison"
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:3001", "http://localhost:3002"]
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [part.strip() for part in value.split(",") if part.strip()]
        return value

    @field_validator("jwt_secret")
    @classmethod
    def validate_secret_len(cls, value: str | None) -> str | None:
        if value is not None and len(value) < 32:
            raise ValueError("JWT_SECRET must be at least 32 characters")
        return value

    @property
    def staff_session_ttl_minutes(self) -> int:
        return 8 * 60

    @property
    def session_cookie_secure(self) -> bool:
        return self.app_env == "prod"


def _persist_dev_secret(secret: str) -> None:
    env_local = Path(".env.local")
    line = f"JWT_SECRET={secret}\n"
    if env_local.exists():
        current = env_local.read_text(encoding="utf-8")
        if "JWT_SECRET=" in current:
            return
        env_local.write_text(current + ("\n" if not current.endswith("\n") else "") + line, encoding="utf-8")
    else:
        env_local.write_text(line, encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if settings.jwt_secret:
        return settings
    if settings.app_env != "dev":
        raise ValueError("JWT_SECRET is required in prod")
    secret = secrets.token_urlsafe(48)
    _persist_dev_secret(secret)
    return settings.model_copy(update={"jwt_secret": secret})
