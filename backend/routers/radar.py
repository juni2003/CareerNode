"""
Opportunity Radar Router — Unapplied job leads from email alerts
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from datetime import datetime, timezone
from bson import ObjectId

from db.mongo import get_db
from models.radar import RadarStatusUpdate

router = APIRouter(prefix="/radar", tags=["radar"])


def serialize(doc):
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.get("/")
async def list_radar(
    status: Optional[str] = Query(None),
    platform: Optional[str] = Query(None),
    limit: int = Query(50),
    skip: int = Query(0),
):
    db = get_db()
    query = {}
    if status:
        query["status"] = status
    if platform:
        query["platform"] = {"$regex": platform, "$options": "i"}

    docs = []
    async for doc in db.opportunity_radar.find(query).sort("email_date", -1).skip(skip).limit(limit):
        docs.append(serialize(doc))
    return docs


@router.patch("/{radar_id}/status")
async def update_radar_status(radar_id: str, update: RadarStatusUpdate):
    db = get_db()
    try:
        oid = ObjectId(radar_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    result = await db.opportunity_radar.update_one(
        {"_id": oid},
        {"$set": {"status": update.status, "updated_at": datetime.now(timezone.utc)}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Radar item not found")
    doc = await db.opportunity_radar.find_one({"_id": oid})
    return serialize(doc)


@router.delete("/{radar_id}")
async def delete_radar(radar_id: str):
    db = get_db()
    try:
        oid = ObjectId(radar_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    result = await db.opportunity_radar.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Radar item not found")
    return {"message": "Deleted"}


@router.post("/{radar_id}/convert")
async def convert_to_application(radar_id: str):
    """Convert a radar lead into a tracked job application."""
    db = get_db()
    try:
        oid = ObjectId(radar_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")

    radar = await db.opportunity_radar.find_one({"_id": oid})
    if not radar:
        raise HTTPException(status_code=404, detail="Radar item not found")

    now = datetime.now(timezone.utc)
    job_doc = {
        "company": radar.get("company") or "Unknown Company",
        "role": radar.get("job_title") or "Unknown Role",
        "date_applied": now,
        "status": "Applied",
        "status_history": [{"status": "Applied", "date": now, "source": "radar"}],
        "job_description": radar.get("description_snippet", ""),
        "tech_tags": [],
        "location": None,
        "work_model": "Unknown",
        "company_origin": "Unknown",
        "platform": radar.get("platform"),
        "apply_link": radar.get("apply_link"),
        "notes": "Converted from Opportunity Radar",
        "source_email_id": None,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.job_applications.insert_one(job_doc)

    # Mark radar item as applied
    await db.opportunity_radar.update_one(
        {"_id": oid}, {"$set": {"status": "applied"}}
    )

    return {"message": "Converted to application", "job_id": str(result.inserted_id)}
