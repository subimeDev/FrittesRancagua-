from __future__ import annotations

from collections.abc import AsyncGenerator

from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import SessionLocal
from app.models import Customer, StaffUser
from app.security import decode_token


def api_error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"code": code, "message": message})


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


def get_restaurant_id(x_restaurant_id: str | None = Header(default=None, alias="X-Restaurant-Id")) -> str:
    settings = get_settings()
    return x_restaurant_id or settings.restaurant_id


def _extract_bearer(request: Request) -> str | None:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.lower().startswith("bearer "):
        return auth_header[7:].strip()
    cookie_token = request.cookies.get("loyalty_session")
    if cookie_token:
        return cookie_token
    return None


async def get_current_customer(
    request: Request,
    db: AsyncSession = Depends(get_db),
    restaurant_id: str = Depends(get_restaurant_id),
) -> Customer:
    token = _extract_bearer(request)
    if not token:
        raise api_error(status.HTTP_401_UNAUTHORIZED, "unauthenticated", "missing token")
    try:
        payload = decode_token(token, expected_scope="session")
    except ValueError:
        raise api_error(status.HTTP_401_UNAUTHORIZED, "unauthenticated", "invalid token")
    customer_id = str(payload.get("sub", ""))
    stmt = select(Customer).where(Customer.id == customer_id, Customer.restaurant_id == restaurant_id)
    customer = (await db.execute(stmt)).scalar_one_or_none()
    if not customer:
        raise api_error(status.HTTP_404_NOT_FOUND, "not_found", "customer not found")
    return customer


async def get_current_staff(
    request: Request,
    db: AsyncSession = Depends(get_db),
    restaurant_id: str = Depends(get_restaurant_id),
) -> StaffUser:
    token = _extract_bearer(request)
    if not token:
        raise api_error(status.HTTP_401_UNAUTHORIZED, "unauthenticated", "missing token")
    try:
        payload = decode_token(token, expected_scope="staff")
    except ValueError:
        raise api_error(status.HTTP_401_UNAUTHORIZED, "unauthenticated", "invalid token")
    staff_id = str(payload.get("sub", ""))
    stmt = select(StaffUser).where(
        StaffUser.id == staff_id, StaffUser.restaurant_id == restaurant_id, StaffUser.is_active.is_(True)
    )
    staff = (await db.execute(stmt)).scalar_one_or_none()
    if not staff:
        raise api_error(status.HTTP_401_UNAUTHORIZED, "unauthenticated", "staff not found")
    return staff
