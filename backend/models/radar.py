from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum


class RadarStatus(str, Enum):
    UNREVIEWED = "unreviewed"
    SAVED = "saved"
    DISMISSED = "dismissed"
    APPLIED = "applied"


class OpportunityRadarResponse(BaseModel):
    id: str
    platform: Optional[str] = None
    job_title: Optional[str] = None
    company: Optional[str] = None
    apply_link: Optional[str] = None
    description_snippet: Optional[str] = None
    email_date: Optional[datetime] = None
    status: RadarStatus = RadarStatus.UNREVIEWED
    created_at: datetime


class RadarStatusUpdate(BaseModel):
    status: RadarStatus
