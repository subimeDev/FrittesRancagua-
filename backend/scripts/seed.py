from __future__ import annotations

import asyncio
from uuid import uuid4

from sqlalchemy import select

from app.config import get_settings
from app.db import SessionLocal
from app.models import StaffUser
from app.security import hash_password


async def main() -> None:
    settings = get_settings()
    async with SessionLocal() as session:
        stmt = select(StaffUser).where(
            StaffUser.restaurant_id == settings.restaurant_id,
            StaffUser.email == "cajero@frittes.cl",
        )
        existing = (await session.execute(stmt)).scalar_one_or_none()
        if existing:
            print("Seed already exists: cajero@frittes.cl")
            return
        user = StaffUser(
            id=f"stf_{uuid4().hex[:12]}",
            restaurant_id=settings.restaurant_id,
            email="cajero@frittes.cl",
            password_hash=hash_password("cajero123"),
            name="Cajero Demo",
            role="cashier",
            is_active=True,
        )
        session.add(user)
        await session.commit()
        print("Seed created: cajero@frittes.cl / cajero123 (dev only)")


if __name__ == "__main__":
    asyncio.run(main())
