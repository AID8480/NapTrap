from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user
from backend.database import get_db
from backend.models import User
from backend.schemas import AlertLogRequest, SessionOut
from backend.session import service

router = APIRouter(tags=["session"])


@router.get("/history", response_model=list[SessionOut])
async def get_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sessions = await service.get_session_history(current_user.id, db)
    return [SessionOut.model_validate(s) for s in sessions]


@router.delete("/history", status_code=204)
async def clear_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await service.clear_session_history(current_user.id, db)



async def post_alert_log(
    body: AlertLogRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    alert = await service.log_alert(body.session_id, body.fatigue_level, body.gps_confirmed, db)
    return {"id": str(alert.id)}
