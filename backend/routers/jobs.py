"""
Jobs Router — CRUD for job applications
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timezone
from bson import ObjectId

from db.mongo import get_db
from models.job import JobApplicationCreate, JobApplicationUpdate, JobApplicationResponse
from services.tech_tagger import extract_tech_tags

router = APIRouter(prefix="/jobs", tags=["jobs"])


def serialize_job(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.get("/", response_model=List[dict])
async def list_jobs(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query("date_applied"),
    sort_order: Optional[int] = Query(-1),
    limit: int = Query(100),
    skip: int = Query(0),
):
    db = get_db()
    query = {}
    if status:
        query["status"] = status
    if search:
        query["$or"] = [
            {"company": {"$regex": search, "$options": "i"}},
            {"role": {"$regex": search, "$options": "i"}},
            {"tech_tags": {"$regex": search, "$options": "i"}},
        ]

    cursor = db.job_applications.find(query).sort(sort_by, sort_order).skip(skip).limit(limit)
    jobs = []
    async for doc in cursor:
        jobs.append(serialize_job(doc))
    return jobs


@router.get("/stats/count")
async def get_stats():
    db = get_db()
    pipeline = [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    result = {}
    async for doc in db.job_applications.aggregate(pipeline):
        result[doc["_id"]] = doc["count"]
    total = await db.job_applications.count_documents({})
    result["Total"] = total
    return result


@router.get("/action-needed")
async def get_action_needed():
    """
    Returns all PENDING Assessment and Interview applications that need user action.
    Pending = status is Assessment, Interview, Interview_Online, or Interview_Onsite.
    Each item includes last_status_date and days_waiting calculated from status_history.
    """
    db = get_db()
    pending_statuses = [
        "Assessment_Pending", "Interview_Pending", 
        "Assessment", "Interview", "Interview_Online", "Interview_Onsite"
    ]
    cursor = db.job_applications.find(
        {"status": {"$in": pending_statuses}}
    ).sort("updated_at", 1)  # oldest first = most urgent

    items = []
    now = datetime.now(timezone.utc)
    async for doc in cursor:
        # Find the date when the current status was last set
        last_status_date = None
        history = doc.get("status_history", [])
        # Walk history in reverse to find the most recent entry for current status
        for entry in reversed(history):
            if entry.get("status") == doc.get("status"):
                last_status_date = entry.get("date")
                break
        # Fallback to updated_at
        if not last_status_date:
            last_status_date = doc.get("updated_at") or doc.get("created_at")

        # Calculate days waiting
        if last_status_date:
            if hasattr(last_status_date, 'tzinfo') and last_status_date.tzinfo is None:
                last_status_date = last_status_date.replace(tzinfo=timezone.utc)
            days_waiting = (now - last_status_date).days
        else:
            days_waiting = 0

        item = serialize_job(doc)
        item["last_status_date"] = last_status_date.isoformat() if last_status_date else None
        item["days_waiting"] = days_waiting
        items.append(item)

    return items


@router.get("/{job_id}")
async def get_job(job_id: str):
    db = get_db()
    try:
        doc = await db.job_applications.find_one({"_id": ObjectId(job_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job ID")
    if not doc:
        raise HTTPException(status_code=404, detail="Job not found")
    return serialize_job(doc)


@router.post("/", status_code=201)
async def create_job(job: JobApplicationCreate):
    db = get_db()
    now = datetime.now(timezone.utc)

    # Auto-tag tech stack from job description
    tech_tags = job.tech_tags or []
    if job.job_description and not tech_tags:
        tech_tags = extract_tech_tags(job.job_description)

    doc = {
        **job.model_dump(),
        "tech_tags": tech_tags,
        "date_applied": job.date_applied or now,
        "status_history": [{"status": job.status, "date": now, "source": "manual"}],
        "created_at": now,
        "updated_at": now,
    }
    result = await db.job_applications.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@router.patch("/{job_id}")
async def update_job(job_id: str, update: JobApplicationUpdate):
    db = get_db()
    try:
        oid = ObjectId(job_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job ID")

    existing = await db.job_applications.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Job not found")

    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)

    # If status is changing, append to history
    push_ops = {}
    if "status" in update_data and update_data["status"] != existing.get("status"):
        push_ops["status_history"] = {
            "status": update_data["status"],
            "date": datetime.now(timezone.utc),
            "source": "manual",
        }

    # Re-tag tech if job description updated
    if "job_description" in update_data:
        update_data["tech_tags"] = extract_tech_tags(update_data["job_description"])

    mongo_update = {"$set": update_data}
    if push_ops:
        mongo_update["$push"] = push_ops

    await db.job_applications.update_one({"_id": oid}, mongo_update)
    updated = await db.job_applications.find_one({"_id": oid})
    return serialize_job(updated)


@router.delete("/{job_id}")
async def delete_job(job_id: str):
    db = get_db()
    try:
        oid = ObjectId(job_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job ID")
    result = await db.job_applications.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"message": "Deleted successfully"}


@router.delete("/system/wipe-all")
async def wipe_all_data():
    """Wipe all scraped jobs and radar leads (Danger Zone)."""
    db = get_db()
    await db.job_applications.delete_many({})
    await db.opportunity_radar.delete_many({})
    return {"message": "All jobs and radar leads wiped successfully."}
