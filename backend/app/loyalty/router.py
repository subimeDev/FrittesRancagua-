from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal, cast

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.deps import api_error, get_current_customer, get_current_staff, get_db, get_restaurant_id
from app.models import Customer, RestaurantConfig, StaffUser
from app.schemas import (
    AccrueRequest,
    CustomerResponse,
    DevLoginRequest,
    EmailLoginRequest,
    OtpRequest,
    OtpVerifyRequest,
    QrTokenResponse,
    RedeemRequest,
    RegisterRequest,
    SessionResponse,
    StaffLoginRequest,
    StaffSessionResponse,
    TransactionResponse,
)
from app.security import create_token, decode_qr_claims, decode_token, hash_password, revoke_jti
from app.loyalty import service
from app.loyalty.google_wallet import build_save_url, create_loyalty_class_if_needed

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
    return SessionResponse(
        session_token=token,
        customer=await service.build_customer_response(db, customer, restaurant_id),
    )


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
    return SessionResponse(
        session_token=token,
        customer=await service.build_customer_response(db, customer, restaurant_id),
    )


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
        return SessionResponse(
            session_token=otp_token,
            customer=await service.build_customer_response(db, customer, restaurant_id),
        )
    # Temporary OTP session token for profile completion.
    token, _ = create_token(
        subject=f"otp:{payload.phone}",
        scope="otp",
        audience=restaurant_id,
        ttl_seconds=300,
        extra_claims={"phone": payload.phone},
    )
    return SessionResponse(session_token=token, customer=None)


@router.post("/auth/email-login", response_model=SessionResponse)
async def email_login(
    payload: EmailLoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    restaurant_id: str = Depends(get_restaurant_id),
) -> SessionResponse:
    email = payload.email.strip().lower()
    if not email:
        raise api_error(400, "invalid_input", "email is required")
    stmt = select(Customer).where(Customer.phone == email, Customer.restaurant_id == restaurant_id)
    customer = (await db.execute(stmt)).scalar_one_or_none()
    if not customer:
        raise api_error(404, "not_found", "customer not found")
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
    return SessionResponse(
        session_token=token,
        customer=await service.build_customer_response(db, customer, restaurant_id),
    )


@router.get("/customers/check")
async def check_customer(
    email: str,
    db: AsyncSession = Depends(get_db),
    restaurant_id: str = Depends(get_restaurant_id),
) -> dict[str, object]:
    clean = email.strip().lower()
    stmt = select(Customer).where(
        Customer.phone == clean,
        Customer.restaurant_id == restaurant_id,
    )
    customer = (await db.execute(stmt)).scalar_one_or_none()
    if customer:
        first = customer.name.split()[0] if customer.name else customer.name
        return {"exists": True, "name": first}
    return {"exists": False}


@router.get("/customers/me", response_model=CustomerResponse)
async def me(
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
    restaurant_id: str = Depends(get_restaurant_id),
) -> CustomerResponse:
    return await service.build_customer_response(db, customer, restaurant_id)


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


@router.get("/passes/google/me")
async def google_wallet_pass(
    customer: Customer = Depends(get_current_customer),
) -> dict[str, str]:
    try:
        # We call this here to ensure the class exists before generating the link.
        # In a high-traffic app, this should be done once on startup or cached.
        create_loyalty_class_if_needed()
        url = build_save_url(customer)
        return {"url": url}
    except Exception as exc:
        import traceback
        print(f"DEBUG WALLET ERROR: {str(exc)}")
        traceback.print_exc()
        raise api_error(503, "wallet_not_configured", str(exc)) from exc


@router.get("/program-config")
async def program_config(
    db: AsyncSession = Depends(get_db),
    restaurant_id: str = Depends(get_restaurant_id),
) -> dict[str, object]:
    """Public endpoint — no auth required. Returns the current loyalty program settings."""
    tiers = await service.tiers_payload(db, restaurant_id)
    levels = await service.levels_payload(db, restaurant_id)
    config = await db.get(RestaurantConfig, restaurant_id)
    if not config:
        return {
            "threshold": tiers[-1]["stamps_required"],
            "reward_name": tiers[-1]["reward_name"],
            "tier_name": "Maisonero",
            "tiers": tiers,
            "levels": levels,
            "level_label": "Nivel",
        }
    return {
        "threshold": config.threshold,
        "reward_name": config.reward_name,
        "tier_name": config.tier_name,
        "tiers": tiers,
        "levels": levels,
        "level_label": config.level_label,
    }


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
    payload: RedeemRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    staff: StaffUser = Depends(get_current_staff),
    restaurant_id: str = Depends(get_restaurant_id),
) -> TransactionResponse:
    # Validate JWT first — no DB open yet. Raises QrTokenExpiredError / QrTokenInvalidError.
    claims = decode_qr_claims(payload.qr_token)
    customer, kind, reward_name = await service.redeem_transaction(
        db, staff_user=staff, claims=claims, restaurant_id=restaurant_id, tier_stamps=payload.tier_stamps
    )
    await db.commit()
    background_tasks.add_task(service.send_redemption_email, customer.name, customer.phone, reward_name)
    return TransactionResponse(
        kind=cast(Literal["accrual", "redeem"], kind),
        new_balance=customer.stamps,
        customer_name=customer.name,
        reward_name=reward_name,
    )


# ---------------------------------------------------------------------------
# Staff password reset
# ---------------------------------------------------------------------------

class PasswordResetRequestPayload(BaseModel):
    email: str


class PasswordResetConfirmPayload(BaseModel):
    token: str
    new_password: str


@router.post("/staff/auth/request-password-reset", status_code=204)
async def request_password_reset(
    payload: PasswordResetRequestPayload,
    db: AsyncSession = Depends(get_db),
    restaurant_id: str = Depends(get_restaurant_id),
) -> Response:
    email = payload.email.strip().lower()
    staff = (await db.execute(
        select(StaffUser).where(StaffUser.restaurant_id == restaurant_id, StaffUser.email == email, StaffUser.is_active.is_(True))
    )).scalar_one_or_none()
    if staff:
        settings = get_settings()
        token, _ = create_token(
            subject=staff.id,
            scope="password_reset",
            audience=restaurant_id,
            ttl_seconds=30 * 60,
        )
        reset_url = f"{settings.pos_app_url}/reset?token={token}"
        await service.send_password_reset_email(staff.email, staff.name, reset_url)
    return Response(status_code=204)


@router.post("/staff/auth/confirm-password-reset", status_code=204)
async def confirm_password_reset(
    payload: PasswordResetConfirmPayload,
    db: AsyncSession = Depends(get_db),
    restaurant_id: str = Depends(get_restaurant_id),
) -> Response:
    try:
        claims = decode_token(payload.token, expected_scope="password_reset")
    except ValueError:
        raise api_error(400, "invalid_token", "El enlace es inválido o ha expirado")
    if len(payload.new_password) < 8:
        raise api_error(400, "invalid_input", "La contraseña debe tener al menos 8 caracteres")
    staff_id = str(claims["sub"])
    staff = (await db.execute(
        select(StaffUser).where(StaffUser.id == staff_id, StaffUser.restaurant_id == restaurant_id, StaffUser.is_active.is_(True))
    )).scalar_one_or_none()
    if not staff:
        raise api_error(400, "invalid_token", "El enlace es inválido o ha expirado")
    staff.password_hash = hash_password(payload.new_password)
    await db.commit()
    return Response(status_code=204)
