from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from backend.auth.dependencies import get_current_user
from backend.database import get_db
from backend.models import User
from backend.schemas import BaselineListOut, BaselineOut, BaselineSelectRequest, BaselineUploadPreview
from backend.user import service

router = APIRouter(tags=["user"])


@router.get("/baseline", response_model=BaselineListOut)
async def get_baseline(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    baselines = await service.get_baselines_for_user(current_user.id, db)
    active = next((b for b in baselines if b.is_active), None)
    return BaselineListOut(
        baselines=[BaselineOut.model_validate(b) for b in baselines],
        active=BaselineOut.model_validate(active) if active else None,
    )


@router.post("/baseline/preview", response_model=BaselineUploadPreview)
async def preview_baseline(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    contents = await file.read()
    try:
        return service.preview_rr_file(contents)
    except Exception as e:
        print(f"[baseline/preview] parse error: {type(e).__name__}: {e}")
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/baseline/upload", response_model=BaselineOut, status_code=201)
async def upload_baseline(
    file: UploadFile = File(...),
    method: str = "sleep",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if method not in ("sleep", "resting"):
        raise HTTPException(status_code=422, detail="method must be 'sleep' or 'resting'")
    contents = await file.read()
    try:
        preview = service.preview_rr_file(contents)
    except Exception as e:
        print(f"[baseline/upload] parse error: {type(e).__name__}: {e}")
        raise HTTPException(status_code=422, detail=str(e))

    baseline = await service.save_baseline(current_user.id, preview.rmssd_value, method, db)
    return BaselineOut.model_validate(baseline)


@router.delete("/baseline/{baseline_id}", status_code=204)
async def delete_baseline(
    baseline_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        await service.delete_baseline(baseline_id, current_user.id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/baseline/select", response_model=BaselineOut)
async def select_baseline(
    body: BaselineSelectRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        baseline = await service.set_active_baseline(body.baseline_id, current_user.id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return BaselineOut.model_validate(baseline)
