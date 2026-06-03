import sys
import os
import uuid
from typing import List, Optional

import numpy as np
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

# hrv_pipeline.py lives at the repo root — add it to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from hrv_pipeline import filter_rr, build_windows, batch_java_rmssd  # noqa: E402

from backend.models import Baseline
from backend.schemas import BaselineUploadPreview


async def get_baselines_for_user(user_id: uuid.UUID, db: AsyncSession) -> List[Baseline]:
    result = await db.execute(
        select(Baseline)
        .where(Baseline.user_id == user_id)
        .order_by(Baseline.recorded_at.desc())
    )
    return list(result.scalars().all())


async def get_active_baseline(user_id: uuid.UUID, db: AsyncSession) -> Optional[Baseline]:
    result = await db.execute(
        select(Baseline).where(Baseline.user_id == user_id, Baseline.is_active == True)  # noqa: E712
    )
    return result.scalar_one_or_none()


def preview_rr_file(contents: bytes) -> BaselineUploadPreview:
    """Parse uploaded .txt, compute RMSSD, return preview stats (synchronous)."""
    lines = contents.decode("utf-8").splitlines()
    rr_raw = []
    for line in lines:
        line = line.strip()
        if line and not line.startswith("#"):
            try:
                rr_raw.append(float(line))
            except ValueError:
                pass

    if len(rr_raw) < 2:
        raise ValueError("File must contain at least 2 RR intervals.")

    rr = filter_rr(np.array(rr_raw, dtype=float))
    duration_min = float(rr.sum() / 1000.0 / 60.0)

    windows = build_windows(rr, 60, 5)
    if not windows:
        raise ValueError("Recording too short to compute RMSSD (need at least 60 s).")

    rmssds = batch_java_rmssd(windows)
    rmssd_value = float(np.nanmean(rmssds))

    return BaselineUploadPreview(
        interval_count=len(rr),
        duration_minutes=round(duration_min, 1),
        rmssd_value=round(rmssd_value, 2),
    )


async def save_baseline(
    user_id: uuid.UUID,
    rmssd_value: float,
    method: str,
    db: AsyncSession,
    set_active: bool = True,
) -> Baseline:
    if set_active:
        # Deactivate all existing baselines of the same method
        await db.execute(
            update(Baseline)
            .where(Baseline.user_id == user_id, Baseline.method == method)
            .values(is_active=False)
        )

    baseline = Baseline(
        user_id=user_id,
        rmssd_value=rmssd_value,
        method=method,
        is_active=set_active,
    )
    db.add(baseline)
    await db.commit()
    await db.refresh(baseline)
    return baseline


async def delete_baseline(baseline_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> None:
    result = await db.execute(
        select(Baseline).where(Baseline.id == baseline_id, Baseline.user_id == user_id)
    )
    baseline = result.scalar_one_or_none()
    if baseline is None:
        raise ValueError("Baseline not found")
    await db.delete(baseline)
    await db.commit()


async def set_active_baseline(baseline_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> Baseline:
    # Deactivate all
    await db.execute(
        update(Baseline).where(Baseline.user_id == user_id).values(is_active=False)
    )
    # Activate chosen
    await db.execute(
        update(Baseline)
        .where(Baseline.id == baseline_id, Baseline.user_id == user_id)
        .values(is_active=True)
    )
    await db.commit()

    result = await db.execute(select(Baseline).where(Baseline.id == baseline_id))
    baseline = result.scalar_one_or_none()
    if baseline is None:
        raise ValueError("Baseline not found")
    return baseline
