from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import api_error, get_current_staff, get_db, get_restaurant_id
from app.models import Customer, StaffRole, StaffUser, Transaction
from app.security import hash_password

router = APIRouter(prefix="/loyalty/admin", tags=["admin"])


def require_manager(staff: StaffUser = Depends(get_current_staff)) -> StaffUser:
    if staff.role != StaffRole.MANAGER.value:
        raise api_error(403, "forbidden", "manager role required")
    return staff


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

@router.get("/stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    restaurant_id: str = Depends(get_restaurant_id),
    _: StaffUser = Depends(get_current_staff),
) -> dict[str, int]:
    total_customers = (await db.execute(
        select(func.count()).select_from(Customer)
        .where(Customer.restaurant_id == restaurant_id)
    )).scalar_one()
    total_stamps = (await db.execute(
        select(func.coalesce(func.sum(Customer.lifetime_stamps), 0))
        .where(Customer.restaurant_id == restaurant_id)
    )).scalar_one()
    total_redemptions = (await db.execute(
        select(func.coalesce(func.sum(Customer.redemptions), 0))
        .where(Customer.restaurant_id == restaurant_id)
    )).scalar_one()
    return {
        "total_customers": total_customers,
        "total_stamps_given": total_stamps,
        "total_redemptions": total_redemptions,
    }


# ---------------------------------------------------------------------------
# Customers
# ---------------------------------------------------------------------------

@router.get("/customers")
async def list_customers(
    db: AsyncSession = Depends(get_db),
    restaurant_id: str = Depends(get_restaurant_id),
    _: StaffUser = Depends(get_current_staff),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    with_coupon: bool = Query(default=False, description="Solo clientes con sellos >= threshold"),
    search: str | None = Query(default=None, description="Buscar por nombre o email"),
) -> dict[str, object]:
    base_filter = [Customer.restaurant_id == restaurant_id]
    if with_coupon:
        base_filter.append(Customer.stamps >= Customer.threshold)
    if search:
        like = f"%{search.strip().lower()}%"
        base_filter.append(
            (func.lower(Customer.name).like(like)) | (func.lower(Customer.phone).like(like))
        )

    total = (await db.execute(
        select(func.count()).select_from(Customer).where(*base_filter)
    )).scalar_one()
    rows = (await db.execute(
        select(Customer)
        .where(*base_filter)
        .order_by(Customer.stamps.desc(), Customer.created_at.desc())
        .offset(offset).limit(limit)
    )).scalars().all()
    return {
        "total": total,
        "items": [
            {
                "id": c.id,
                "name": c.name,
                "phone": c.phone,
                "stamps": c.stamps,
                "threshold": c.threshold,
                "lifetime_stamps": c.lifetime_stamps,
                "redemptions": c.redemptions,
                "has_coupon": c.stamps >= c.threshold,
                "member_since": c.member_since.isoformat(),
            }
            for c in rows
        ],
    }


# ---------------------------------------------------------------------------
# Transactions
# ---------------------------------------------------------------------------

@router.get("/transactions")
async def list_transactions(
    db: AsyncSession = Depends(get_db),
    restaurant_id: str = Depends(get_restaurant_id),
    _: StaffUser = Depends(get_current_staff),
    limit: int = Query(default=60, ge=1, le=200),
) -> list[dict[str, object]]:
    rows = (await db.execute(
        select(Transaction, Customer, StaffUser)
        .join(Customer, Transaction.customer_id == Customer.id)
        .outerjoin(StaffUser, Transaction.staff_user_id == StaffUser.id)
        .where(Customer.restaurant_id == restaurant_id)
        .order_by(Transaction.created_at.desc())
        .limit(limit)
    )).all()
    return [
        {
            "id": tx.id,
            "kind": tx.kind,
            "stamps_delta": tx.stamps_delta,
            "customer_name": customer.name,
            "staff_name": staff.name if staff else None,
            "created_at": tx.created_at.isoformat(),
        }
        for tx, customer, staff in rows
    ]


# ---------------------------------------------------------------------------
# Staff management
# ---------------------------------------------------------------------------

class CreateStaffRequest(BaseModel):
    email: str
    name: str
    password: str
    role: str = StaffRole.CASHIER.value


class UpdateStaffRequest(BaseModel):
    name: str | None = None
    password: str | None = None
    is_active: bool | None = None


@router.get("/staff")
async def list_staff(
    db: AsyncSession = Depends(get_db),
    restaurant_id: str = Depends(get_restaurant_id),
    _: StaffUser = Depends(require_manager),
) -> list[dict[str, object]]:
    rows = (await db.execute(
        select(StaffUser)
        .where(StaffUser.restaurant_id == restaurant_id)
        .order_by(StaffUser.created_at)
    )).scalars().all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "email": s.email,
            "role": s.role,
            "is_active": s.is_active,
            "created_at": s.created_at.isoformat(),
        }
        for s in rows
    ]


@router.post("/staff", status_code=201)
async def create_staff_user(
    payload: CreateStaffRequest,
    db: AsyncSession = Depends(get_db),
    restaurant_id: str = Depends(get_restaurant_id),
    _: StaffUser = Depends(require_manager),
) -> dict[str, object]:
    email = payload.email.strip().lower()
    if payload.role not in (StaffRole.CASHIER.value, StaffRole.MANAGER.value):
        raise api_error(400, "invalid_input", "role must be cashier or manager")
    existing = (await db.execute(
        select(StaffUser).where(StaffUser.restaurant_id == restaurant_id, StaffUser.email == email)
    )).scalar_one_or_none()
    if existing:
        raise api_error(409, "duplicate_email", "email already registered")
    new_user = StaffUser(
        id=f"stf_{uuid4().hex[:12]}",
        restaurant_id=restaurant_id,
        email=email,
        password_hash=hash_password(payload.password),
        name=payload.name.strip(),
        role=payload.role,
        is_active=True,
    )
    db.add(new_user)
    await db.commit()
    return {"id": new_user.id, "email": email, "name": new_user.name, "role": new_user.role, "is_active": True}


@router.patch("/staff/{staff_id}")
async def update_staff_user(
    staff_id: str,
    payload: UpdateStaffRequest,
    db: AsyncSession = Depends(get_db),
    restaurant_id: str = Depends(get_restaurant_id),
    manager: StaffUser = Depends(require_manager),
) -> dict[str, object]:
    target = (await db.execute(
        select(StaffUser).where(StaffUser.id == staff_id, StaffUser.restaurant_id == restaurant_id)
    )).scalar_one_or_none()
    if not target:
        raise api_error(404, "not_found", "staff not found")
    if target.id == manager.id:
        raise api_error(400, "self_edit", "cannot modify your own account here")
    if payload.is_active is not None:
        target.is_active = payload.is_active
    if payload.name:
        target.name = payload.name.strip()
    if payload.password:
        target.password_hash = hash_password(payload.password)
    await db.commit()
    return {"id": target.id, "email": target.email, "name": target.name, "role": target.role, "is_active": target.is_active}
