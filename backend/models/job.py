from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class ApplicationStatus(str, Enum):
    APPLIED = "Applied"
    ASSESSMENT_PENDING = "Assessment_Pending"
    ASSESSMENT_DONE = "Assessment_Done"
    INTERVIEW_PENDING = "Interview_Pending"
    INTERVIEW_DONE = "Interview_Done"
    OFFER = "Offer"
    REJECTED = "Rejected"
    WITHDRAWN = "Withdrawn"
    GHOSTED = "Ghosted"
    
    # Deprecated statuses (kept so existing DB documents don't crash validation)
    ASSESSMENT = "Assessment"
    INTERVIEW = "Interview"
    INTERVIEW_ONLINE = "Interview_Online"
    INTERVIEW_ONSITE = "Interview_Onsite"



class WorkModel(str, Enum):
    REMOTE = "Remote"
    HYBRID = "Hybrid"
    ON_SITE = "On-Site"
    UNKNOWN = "Unknown"


class CompanyOrigin(str, Enum):
    DOMESTIC = "Domestic"
    INTERNATIONAL = "International"
    UNKNOWN = "Unknown"


class StatusHistoryItem(BaseModel):
    status: ApplicationStatus
    date: datetime
    source: str = "manual"  # "email" | "manual"
    notes: Optional[str] = None


class JobApplicationCreate(BaseModel):
    company: str
    role: str
    date_applied: Optional[datetime] = None
    status: ApplicationStatus = ApplicationStatus.APPLIED
    job_description: Optional[str] = None
    tech_tags: List[str] = []
    location: Optional[str] = None
    work_model: WorkModel = WorkModel.UNKNOWN
    company_origin: CompanyOrigin = CompanyOrigin.UNKNOWN
    platform: Optional[str] = None
    apply_link: Optional[str] = None
    notes: Optional[str] = None
    source_email_id: Optional[str] = None


class JobApplicationUpdate(BaseModel):
    company: Optional[str] = None
    role: Optional[str] = None
    date_applied: Optional[datetime] = None
    status: Optional[ApplicationStatus] = None
    job_description: Optional[str] = None
    tech_tags: Optional[List[str]] = None
    location: Optional[str] = None
    work_model: Optional[WorkModel] = None
    company_origin: Optional[CompanyOrigin] = None
    platform: Optional[str] = None
    apply_link: Optional[str] = None
    notes: Optional[str] = None


class JobApplicationResponse(BaseModel):
    id: str
    company: str
    role: str
    date_applied: Optional[datetime] = None
    status: ApplicationStatus
    status_history: List[StatusHistoryItem] = []
    job_description: Optional[str] = None
    tech_tags: List[str] = []
    location: Optional[str] = None
    work_model: WorkModel
    company_origin: CompanyOrigin
    platform: Optional[str] = None
    apply_link: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
