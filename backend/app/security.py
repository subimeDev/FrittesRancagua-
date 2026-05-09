from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, cast
from uuid import uuid4

from jose import ExpiredSignatureError, JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.loyalty.exceptions import QrTokenExpiredError, QrTokenInvalidError
from app.models import RevokedJti

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def hash_password(password: str) -> str:
    return cast(str, pwd_context.hash(password))


def verify_password(password: str, password_hash: str) -> bool:
    return cast(bool, pwd_context.verify(password, password_hash))


def create_token(
    *,
    subject: str,
    scope: str,
    audience: str,
    ttl_seconds: int,
    extra_claims: dict[str, Any] | None = None,
) -> tuple[str, datetime]:
    settings = get_settings()
    iat = utcnow()
    exp = iat + timedelta(seconds=ttl_seconds)
    payload: dict[str, Any] = {
        "sub": subject,
        "aud": audience,
        "scope": scope,
        "jti": str(uuid4()),
        "iat": int(iat.timestamp()),
        "exp": int(exp.timestamp()),
    }
    if extra_claims:
        payload.update(extra_claims)
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_alg)
    return token, exp


def decode_token(token: str, *, expected_scope: str | None = None) -> dict[str, Any]:
    settings = get_settings()
    try:
        payload = cast(
            dict[str, Any],
            jwt.decode(
                token,
                settings.jwt_secret,
                algorithms=[settings.jwt_alg],
                audience=settings.restaurant_id,
                options={"verify_aud": True},
            ),
        )
    except JWTError as exc:
        raise ValueError("invalid token") from exc
    if expected_scope and payload.get("scope") != expected_scope:
        raise ValueError("invalid scope")
    return payload


def decode_qr_claims(token: str) -> dict[str, Any]:
    """Validate a QR JWT and return its claims. Pure — no DB access.

    Raises QrTokenExpiredError or QrTokenInvalidError; never ValueError.
    """
    settings = get_settings()
    try:
        payload = cast(
            dict[str, Any],
            jwt.decode(
                token,
                settings.jwt_secret,
                algorithms=[settings.jwt_alg],
                audience=settings.restaurant_id,
                options={"verify_aud": True},
            ),
        )
    except ExpiredSignatureError as exc:
        raise QrTokenExpiredError("qr token expired") from exc
    except JWTError as exc:
        raise QrTokenInvalidError("invalid qr token") from exc
    if payload.get("scope") != "qr":
        raise QrTokenInvalidError("invalid qr token scope")
    if not payload.get("jti"):
        raise QrTokenInvalidError("missing jti")
    return payload


async def revoke_jti(session: AsyncSession, *, jti: str, expires_at: datetime) -> None:
    await session.execute(
        delete(RevokedJti).where(RevokedJti.expires_at < utcnow())
    )
    session.add(RevokedJti(jti=jti, expires_at=expires_at))


async def is_jti_revoked(session: AsyncSession, jti: str) -> bool:
    await session.execute(delete(RevokedJti).where(RevokedJti.expires_at < utcnow()))
    result = await session.execute(select(RevokedJti).where(RevokedJti.jti == jti))
    return result.scalar_one_or_none() is not None
