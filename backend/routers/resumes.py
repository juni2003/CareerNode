"""
Resumes & Projects Router — CRUD for resume variants and project bank
"""

from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone
from typing import List
from bson import ObjectId

from db.mongo import get_db
from models.resume import ResumeCreate, ResumeUpdate, ProjectCreate, ProjectUpdate

router = APIRouter(prefix="/resumes", tags=["resumes"])


def serialize(doc):
    doc["id"] = str(doc.pop("_id"))
    return doc


# ─── Resumes ──────────────────────────────────────────────────────────────────

@router.get("/")
async def list_resumes():
    db = get_db()
    docs = []
    async for doc in db.resumes.find().sort("created_at", -1):
        docs.append(serialize(doc))
    return docs


@router.get("/{resume_id}")
async def get_resume(resume_id: str):
    db = get_db()
    try:
        doc = await db.resumes.find_one({"_id": ObjectId(resume_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    if not doc:
        raise HTTPException(status_code=404, detail="Resume not found")
    return serialize(doc)


@router.post("/", status_code=201)
async def create_resume(resume: ResumeCreate):
    db = get_db()
    now = datetime.now(timezone.utc)
    doc = {**resume.model_dump(), "created_at": now, "updated_at": now}
    result = await db.resumes.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@router.patch("/{resume_id}")
async def update_resume(resume_id: str, update: ResumeUpdate):
    db = get_db()
    try:
        oid = ObjectId(resume_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    await db.resumes.update_one({"_id": oid}, {"$set": update_data})
    doc = await db.resumes.find_one({"_id": oid})
    return serialize(doc)


@router.delete("/{resume_id}")
async def delete_resume(resume_id: str):
    db = get_db()
    try:
        oid = ObjectId(resume_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    result = await db.resumes.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Resume not found")
    return {"message": "Deleted"}


# ─── Projects ─────────────────────────────────────────────────────────────────

projects_router = APIRouter(prefix="/projects", tags=["projects"])


@projects_router.get("/")
async def list_projects():
    db = get_db()
    docs = []
    async for doc in db.projects.find().sort("created_at", -1):
        docs.append(serialize(doc))
    return docs


@projects_router.post("/", status_code=201)
async def create_project(project: ProjectCreate):
    db = get_db()
    now = datetime.now(timezone.utc)
    doc = {**project.model_dump(), "created_at": now, "updated_at": now}
    result = await db.projects.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@projects_router.patch("/{project_id}")
async def update_project(project_id: str, update: ProjectUpdate):
    db = get_db()
    try:
        oid = ObjectId(project_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    await db.projects.update_one({"_id": oid}, {"$set": update_data})
    doc = await db.projects.find_one({"_id": oid})
    return serialize(doc)


@projects_router.delete("/{project_id}")
async def delete_project(project_id: str):
    db = get_db()
    try:
        oid = ObjectId(project_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    result = await db.projects.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"message": "Deleted"}
