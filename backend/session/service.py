import uuid
from datetime import datetime, timezone

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models import Alert, Session


async def create_session(user_id: uuid.UUID, db: AsyncSession) -> Session:
    session = Session(user_id=user_id)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def close_session(session_id: uuid.UUID, db: AsyncSession) -> None:
    await db.execute(
        update(Session)
        .where(Session.id == session_id)
        .values(ended_at=datetime.now(timezone.utc))
    )
    await db.commit()


async def update_session_stats(
    session_id: uuid.UUID,
    max_fatigue_level: int,
    alert_count: int,
    db: AsyncSession,
) -> None:
    await db.execute(
        update(Session)
        .where(Session.id == session_id)
        .values(max_fatigue_level=max_fatigue_level, alert_count=alert_count)
    )
    await db.commit()


async def log_alert(
    session_id: uuid.UUID,
    fatigue_level: int,
    gps_confirmed: bool,
    db: AsyncSession,
) -> Alert:
    alert = Alert(session_id=session_id, fatigue_level=fatigue_level, gps_confirmed=gps_confirmed)
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    return alert


async def get_session_history(user_id: uuid.UUID, db: AsyncSession, limit: int = 20) -> list[Session]:
    result = await db.execute(
        select(Session)
        .where(Session.user_id == user_id)
        .order_by(Session.started_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def clear_session_history(user_id: uuid.UUID, db: AsyncSession) -> None:
    await db.execute(delete(Session).where(Session.user_id == user_id))
    await db.commit()
