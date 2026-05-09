from __future__ import annotations

import asyncio
from uuid import uuid4

from sqlalchemy import select

from app.config import get_settings
from app.db import SessionLocal
from app.models import StaffUser
from app.security import hash_password


SEED_USERS = [
    {"email": "cajero@frittes.cl", "password": "cajero123", "name": "Cajero Demo", "role": "cashier"},
    {"email": "admin@frittes.cl", "password": "admin123", "name": "Administrador", "role": "manager"},
]


async def main() -> None:
    settings = get_settings()
    async with SessionLocal() as session:
        for u in SEED_USERS:
            stmt = select(StaffUser).where(
                StaffUser.restaurant_id == settings.restaurant_id,
                StaffUser.email == u["email"],
            )
            existing = (await session.execute(stmt)).scalar_one_or_none()
            if existing:
                print(f"Seed already exists: {u['email']}")
                continue
            user = StaffUser(
                id=f"stf_{uuid4().hex[:12]}",
                restaurant_id=settings.restaurant_id,
                email=u["email"],
                password_hash=hash_password(u["password"]),
                name=u["name"],
                role=u["role"],
                is_active=True,
            )
            session.add(user)
            print(f"Seed created: {u['email']} / {u['password']}")
        await session.commit()


if __name__ == "__main__":
    asyncio.run(main())
