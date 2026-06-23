from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ResumeCreate(BaseModel):
    name: str
    role_category: str  # e.g. "AI/ML", "Full-Stack", "Backend"
    content_markdown: str


class ResumeUpdate(BaseModel):
    name: Optional[str] = None
    role_category: Optional[str] = None
    content_markdown: Optional[str] = None


class ResumeResponse(BaseModel):
    id: str
    name: str
    role_category: str
    content_markdown: str
    created_at: datetime
    updated_at: datetime


class ProjectCreate(BaseModel):
    title: str
    tech_stack: List[str] = []
    github_link: Optional[str] = None
    live_link: Optional[str] = None
    description: str


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    tech_stack: Optional[List[str]] = None
    github_link: Optional[str] = None
    live_link: Optional[str] = None
    description: Optional[str] = None


class ProjectResponse(BaseModel):
    id: str
    title: str
    tech_stack: List[str]
    github_link: Optional[str] = None
    live_link: Optional[str] = None
    description: str
    created_at: datetime
    updated_at: datetime
