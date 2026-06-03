import uuid
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, EmailStr


# ── Auth ──────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ── Baseline ──────────────────────────────────────────────────────────────────

class BaselineOut(BaseModel):
    id: uuid.UUID
    rmssd_value: float
    method: Literal["sleep", "resting"]
    recorded_at: datetime
    is_active: bool

    model_config = {"from_attributes": True}


class BaselineListOut(BaseModel):
    baselines: List[BaselineOut]
    active: Optional[BaselineOut]


class BaselineSelectRequest(BaseModel):
    baseline_id: uuid.UUID


class BaselineUploadPreview(BaseModel):
    interval_count: int
    duration_minutes: float
    rmssd_value: float


# ── Session ───────────────────────────────────────────────────────────────────

class SessionOut(BaseModel):
    id: uuid.UUID
    started_at: datetime
    ended_at: Optional[datetime]
    max_fatigue_level: int
    alert_count: int

    model_config = {"from_attributes": True}


class AlertLogRequest(BaseModel):
    session_id: uuid.UUID
    fatigue_level: int
    gps_confirmed: bool

