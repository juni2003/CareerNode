"""
AI Router — Gemini API integration for chat, cover letters, and interview prep
"""

import os
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from bson import ObjectId
import google.generativeai as genai

from db.mongo import get_db
from models.chat import ChatRequest, ChatSessionCreate, ChatSessionResponse

router = APIRouter(prefix="/ai", tags=["ai"])

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")


def get_gemini_model():
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY not configured. Add it to your .env file."
        )
    genai.configure(api_key=GEMINI_API_KEY)
    return genai.GenerativeModel("gemini-3.5-flash")


# ─── Session Management ────────────────────────────────────────────────────────

@router.post("/sessions")
async def create_session(body: ChatSessionCreate):
    db = get_db()
    now = datetime.now(timezone.utc)
    session = {
        "session_id": str(uuid.uuid4()),
        "title": body.title or "New Chat",
        "messages": [],
        "created_at": now,
        "updated_at": now,
    }
    result = await db.chat_sessions.insert_one(session)
    session["id"] = str(result.inserted_id)
    session.pop("_id", None)
    return session


@router.get("/sessions")
async def list_sessions():
    db = get_db()
    sessions = []
    async for doc in db.chat_sessions.find().sort("updated_at", -1).limit(50):
        doc["id"] = str(doc.pop("_id"))
        doc["message_count"] = len(doc.get("messages", []))
        sessions.append(doc)
    return sessions


@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    db = get_db()
    doc = await db.chat_sessions.find_one({"session_id": session_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Session not found")
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    db = get_db()
    result = await db.chat_sessions.delete_one({"session_id": session_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"message": "Session deleted"}


# ─── Chat Endpoint ─────────────────────────────────────────────────────────────

@router.post("/chat")
async def chat(request: ChatRequest):
    db = get_db()
    model = get_gemini_model()

    # Fetch session
    session = await db.chat_sessions.find_one({"session_id": request.session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    messages = session.get("messages", [])
    user_message = request.message.strip()

    # ── Context injection ──────────────────────────────────────────────────────
    context_parts = []

    # Always provide a quick summary of their jobs if they ask about progress, jobs, or applications
    msg_lower = user_message.lower()
    trigger_words = ["apply", "applied", "job", "jobs", "summary", "progress", "how many", "status", "applications"]
    
    if any(word in msg_lower for word in trigger_words):
        # Query DB before answering
        jobs_cursor = db.job_applications.find({}).sort("updated_at", -1)
        all_jobs_list = [j async for j in jobs_cursor]
        
        # Calculate brief stats
        total = len(all_jobs_list)
        status_counts = {}
        for j in all_jobs_list:
            status_counts[j.get("status", "Unknown")] = status_counts.get(j.get("status", "Unknown"), 0) + 1
            
        stats_str = f"Database Summary: {total} total applications. Breakdown: {status_counts}"
        
        # Limit the detailed list to 100 most recent so we don't blow up context size
        recent_jobs = [f"- {j.get('company')} — {j.get('role')} (Status: {j.get('status')})" for j in all_jobs_list[:100]]
        
        context_parts.append(
            f"{stats_str}\n\nRecent applications (up to 100):\n" + "\n".join(recent_jobs)
        )

    # If job_id provided, inject job context
    if request.job_id:
        try:
            job = await db.job_applications.find_one({"_id": ObjectId(request.job_id)})
            if job:
                context_parts.append(
                    f"Job Context:\nCompany: {job.get('company')}\n"
                    f"Role: {job.get('role')}\n"
                    f"Status: {job.get('status')}\n"
                    f"Job Description:\n{job.get('job_description', 'N/A')[:2000]}"
                )
        except Exception:
            pass

    # If resume_id provided, inject resume
    if request.resume_id:
        try:
            resume = await db.resumes.find_one({"_id": ObjectId(request.resume_id)})
            if resume:
                context_parts.append(
                    f"Resume ({resume.get('name')}):\n{resume.get('content_markdown', '')}"
                )
        except Exception:
            pass
    else:
        # Auto-select relevant resume based on job role if cover letter / interview requested
        if request.job_id and any(kw in user_message.lower() for kw in ["cover letter", "interview", "prep"]):
            try:
                job = await db.job_applications.find_one({"_id": ObjectId(request.job_id)})
                if job:
                    role_lower = job.get("role", "").lower()
                    # Heuristic: find resume whose category matches role
                    resume = await db.resumes.find_one({
                        "role_category": {"$regex": "|".join(
                            w for w in ["ai", "ml", "full-stack", "backend", "data", "software"]
                            if w in role_lower
                        ) or ".", "$options": "i"}
                    })
                    if resume:
                        context_parts.append(
                            f"Resume ({resume.get('name')}):\n{resume.get('content_markdown', '')}"
                        )
            except Exception:
                pass

    # Inject projects bank
    if any(kw in user_message.lower() for kw in ["cover letter", "project", "portfolio"]):
        projects_cursor = db.projects.find({}).limit(10)
        project_texts = []
        async for p in projects_cursor:
            project_texts.append(
                f"- {p['title']} ({', '.join(p.get('tech_stack', []))}): {p['description'][:200]}"
            )
        if project_texts:
            context_parts.append("Projects Portfolio:\n" + "\n".join(project_texts))

    # ── Build system prompt ────────────────────────────────────────────────────
    system_prompt = """You are CareerNode AI Assistant — a personal career coach embedded in the user's job tracking app. 
You have access to the user's job applications database, resume variants, and project portfolio.

Your capabilities:
1. Answer queries about the user's job applications (e.g., "Did I apply to Google?")
2. Generate hyper-tailored cover letters using the user's actual resume and projects
3. Generate 5 customized technical interview questions based on job descriptions and resume
4. Provide career advice, application tips, and insights

When generating cover letters:
- Use a professional, confident tone
- Reference specific projects from the user's portfolio
- Align the letter with the exact job description requirements
- Keep it concise (under 400 words)

When generating interview questions:
- Make questions specific to the exact tech stack in the job description
- Mix behavioral and technical questions
- Provide brief tips for answering each question

Always be direct, actionable, and personalized. Never be generic."""

    # ── Build conversation for Gemini ──────────────────────────────────────────
    history = []
    for msg in messages[-10:]:  # Last 10 messages as context
        history.append({
            "role": msg["role"],
            "parts": [msg["content"]],
        })

    context_block = "\n\n---\n".join(context_parts)
    full_user_message = user_message
    if context_block:
        full_user_message = f"[Context from user's database]\n{context_block}\n\n---\n\nUser question: {user_message}"

    # Gemini chat
    chat_session = model.start_chat(history=history)
    
    # Inject system prompt if it's the first message
    if not history:
        full_user_message = system_prompt + "\n\n" + full_user_message
        
    response = await chat_session.send_message_async(full_user_message)

    reply = response.text

    # ── Save messages ──────────────────────────────────────────────────────────
    now = datetime.now(timezone.utc)
    new_messages = [
        {"role": "user", "content": user_message, "timestamp": now.isoformat()},
        {"role": "model", "content": reply, "timestamp": now.isoformat()},
    ]

    # Update session title if it's the first message
    update_ops = {
        "$push": {"messages": {"$each": new_messages}},
        "$set": {"updated_at": now},
    }
    if not messages:
        update_ops["$set"]["title"] = user_message[:60] + ("..." if len(user_message) > 60 else "")

    await db.chat_sessions.update_one(
        {"session_id": request.session_id}, update_ops
    )

    return {
        "session_id": request.session_id,
        "reply": reply,
        "messages": new_messages,
    }


# ─── Quick Check Endpoint ──────────────────────────────────────────────────────

@router.get("/check-application")
async def check_application(company: str, role: str):
    """Quick check: Did I apply to Company for Role?"""
    from services.deduplication import find_existing_application
    existing = await find_existing_application(company, role)
    if existing:
        existing["id"] = str(existing.pop("_id"))
        return {"applied": True, "application": existing}
    return {"applied": False, "application": None}
