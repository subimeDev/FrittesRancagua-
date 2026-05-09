from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal, cast

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.deps import api_error, get_current_customer, get_current_staff, get_db, get_restaurant_id
from app.models import Customer, StaffUser
from app.schemas import (
    AccrueRequest,
    CustomerResponse,
    DevLoginRequest,
    OtpRequest,
    OtpVerifyRequest,
    QrTokenResponse,
    RegisterRequest,
    SessionResponse,
    StaffLoginRequest,
    StaffSessionResponse,
    TransactionResponse,
)
from app.security import create_token, decode_qr_claims, decode_token, revoke_jti
from app.loyalty import service

router = APIRouter(prefix="/loyalty", tags=["loyalty"])


@router.post("/customers", response_model=SessionResponse)
async def register_customer(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    restaurant_id: str = Depends(get_restaurant_id),
) -> SessionResponse:
    token_phone = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.lower().startswith("bearer "):
        try:
            claims = decode_token(auth_header[7:].strip(), expected_scope="otp")
            token_phone = str(claims.get("phone", ""))
        except ValueError:
            token_phone = None

    name = (payload.customer_name or payload.name or "").strip()
    phone = (payload.phone or token_phone or "").strip()
    if len(name) < 2:
        raise api_error(400, "invalid_input", "name is required")
    if not phone:
        raise api_error(400, "invalid_input", "phone is required")

    async with db.begin():
        customer = await service.register_or_login_customer(
            db, restaurant_id=restaurant_id, name=name, phone=phone, email=payload.email
        )
    token, _ = service.create_customer_session(customer)
    settings = get_settings()
    response.set_cookie(
        "loyalty_session",
        token,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        max_age=settings.session_ttl_minutes * 60,
    )
    return SessionResponse(session_token=token, customer=service.customer_to_response(customer))


@router.post("/auth/dev-login", response_model=SessionResponse)
async def dev_login(
    payload: DevLoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    restaurant_id: str = Depends(get_restaurant_id),
) -> SessionResponse:
    settings = get_settings()
    if settings.app_env != "dev":
        raise api_error(404, "not_found", "endpoint disabled in prod")
    stmt = select(Customer).where(Customer.phone == payload.phone, Customer.restaurant_id == restaurant_id)
    customer = (await db.execute(stmt)).scalar_one_or_none()
    if not customer:
        raise api_error(400, "not_registered", "phone not registered, use POST /customers")
    token, _ = service.create_customer_session(customer)
    response.set_cookie(
        "loyalty_session",
        token,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        max_age=settings.session_ttl_minutes * 60,
    )
    return SessionResponse(session_token=token, customer=service.customer_to_response(customer))


@router.post("/auth/request-otp", status_code=204)
async def request_otp(
    payload: OtpRequest,
    db: AsyncSession = Depends(get_db),
) -> Response:
    await service.request_otp(db, payload.phone)
    return Response(status_code=204)


@router.post("/auth/verify-otp", response_model=SessionResponse)
async def verify_otp(
    payload: OtpVerifyRequest,
    db: AsyncSession = Depends(get_db),
    restaurant_id: str = Depends(get_restaurant_id),
) -> SessionResponse:
    valid = await service.verify_otp(db, payload.phone, payload.code)
    if not valid:
        raise api_error(401, "unauthenticated", "invalid code")
    stmt = select(Customer).where(Customer.phone == payload.phone, Customer.restaurant_id == restaurant_id)
    customer = (await db.execute(stmt)).scalar_one_or_none()
    otp_token, _ = service.create_customer_session(customer) if customer else ("", datetime.now(timezone.utc))
    if customer:
        return SessionResponse(session_token=otp_token, customer=service.customer_to_response(customer))
    # Temporary OTP session token for profile completion.
    token, _ = create_token(
        subject=f"otp:{payload.phone}",
        scope="otp",
        audience=restaurant_id,
        ttl_seconds=300,
        extra_claims={"phone": payload.phone},
    )
    return SessionResponse(session_token=token, customer=None)


@router.get("/customers/me", response_model=CustomerResponse)
async def me(customer: Customer = Depends(get_current_customer)) -> CustomerResponse:
    return service.customer_to_response(customer)


@router.post("/auth/sign-out", status_code=204)
async def sign_out(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> Response:
    auth_header = request.headers.get("Authorization", "")
    token = auth_header[7:].strip() if auth_header.lower().startswith("bearer ") else request.cookies.get("loyalty_session", "")
    if token:
        try:
            payload = decode_token(token)
            jti = str(payload.get("jti", ""))
            exp = datetime.fromtimestamp(int(payload.get("exp", 0)), tz=timezone.utc)
            if jti:
                async with db.begin():
                    await revoke_jti(db, jti=jti, expires_at=exp)
        except ValueError:
            pass
    response.delete_cookie("loyalty_session")
    return Response(status_code=204)


@router.get("/qr-tokens", response_model=QrTokenResponse)
async def get_qr(customer: Customer = Depends(get_current_customer)) -> QrTokenResponse:
    token, exp = service.create_qr_token(customer)
    return QrTokenResponse(token=token, exp_at=exp)


@router.post("/staff/auth/login", response_model=StaffSessionResponse)
async def staff_login(
    payload: StaffLoginRequest,
    db: AsyncSession = Depends(get_db),
    restaurant_id: str = Depends(get_restaurant_id),
) -> StaffSessionResponse:
    staff = await service.staff_login(db, restaurant_id=restaurant_id, email=payload.email, password=payload.password)
    if not staff:
        raise api_error(401, "unauthenticated", "invalid credentials")
    token, _ = service.create_staff_session(staff)
    return StaffSessionResponse(session_token=token, staff=service.staff_to_public(staff))


@router.post("/transactions/accrue", response_model=TransactionResponse)
async def accrue(
    payload: AccrueRequest,
    db: AsyncSession = Depends(get_db),
    staff: StaffUser = Depends(get_current_staff),
    restaurant_id: str = Depends(get_restaurant_id),
) -> TransactionResponse:
    # Validate JWT first — no DB open yet. Raises QrTokenExpiredError / QrTokenInvalidError.
    claims = decode_qr_claims(payload.qr_token)
    customer, kind = await service.accrue_transaction(
        db, staff_user=staff, claims=claims, restaurant_id=restaurant_id
    )
    await db.commit()
    return TransactionResponse(
        kind=cast(Literal["accrual", "redeem"], kind),
        new_balance=customer.stamps,
        customer_name=customer.name,
    )


@router.post("/transactions/redeem", response_model=TransactionResponse)
async def redeem(
    payload: AccrueRequest,
    db: AsyncSession = Depends(get_db),
    staff: StaffUser = Depends(get_current_staff),
    restaurant_id: str = Depends(get_restaurant_id),
) -> TransactionResponse:
    # Validate JWT first — no DB open yet. Raises QrTokenExpiredError / QrTokenInvalidError.
    claims = decode_qr_claims(payload.qr_token)
    customer, kind = await service.redeem_transaction(
        db, staff_user=staff, claims=claims, restaurant_id=restaurant_id
    )
    await db.commit()
    return TransactionResponse(
        kind=cast(Literal["accrual", "redeem"], kind),
        new_balance=customer.stamps,
        customer_name=customer.name,
    )
