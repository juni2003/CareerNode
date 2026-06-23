from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str
    timestamp: datetime = None


class ChatSessionCreate(BaseModel):
    title: Optional[str] = "New Chat"


class ChatRequest(BaseModel):
    session_id: str
    message: str
    job_id: Optional[str] = None          # for cover letter / interview prep context
    resume_id: Optional[str] = None       # force specific resume


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    action: Optional[str] = None         # "cover_letter" | "interview_prep" | "query"
    messages: List[ChatMessage] = []


class ChatSessionResponse(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int
