"""
Analytics Router — Aggregation queries for dashboard charts
"""

from fastapi import APIRouter
from datetime import datetime, timezone, timedelta
from db.mongo import get_db

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview")
async def get_overview():
    """Summary stats for the top of the dashboard."""
    db = get_db()
    total = await db.job_applications.count_documents({})
    pipeline = [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    status_counts = {}
    async for doc in db.job_applications.aggregate(pipeline):
        status_counts[doc["_id"]] = doc["count"]

    interview_count = (
        status_counts.get("Interview", 0) +
        status_counts.get("Interview_Online", 0) +
        status_counts.get("Interview_Onsite", 0) +
        status_counts.get("Interview_Pending", 0) +
        status_counts.get("Interview_Done", 0)
    )

    assessment_count = (
        status_counts.get("Assessment", 0) +
        status_counts.get("Assessment_Pending", 0) +
        status_counts.get("Assessment_Done", 0)
    )

    return {
        "total": total,
        "by_status": status_counts,
        "interviews": interview_count,
        "assessments": assessment_count,
        "offers": status_counts.get("Offer", 0),
        "conversion_rate": (
            round(interview_count / total * 100, 1) if total > 0 else 0
        ),
    }


@router.get("/volume")
async def application_volume():
    """Applications per week for the time-series chart."""
    db = get_db()
    pipeline = [
        {
            "$group": {
                "_id": {
                    "year": {"$year": "$date_applied"},
                    "week": {"$week": "$date_applied"},
                },
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"_id.year": 1, "_id.week": 1}},
        {"$limit": 52},
    ]
    data = []
    async for doc in db.job_applications.aggregate(pipeline):
        year = doc["_id"]["year"]
        week = doc["_id"]["week"]
        # Convert week to approximate date string
        label = f"W{week:02d}/{year}"
        data.append({"label": label, "count": doc["count"], "year": year, "week": week})
    return data


@router.get("/by-role")
async def role_distribution():
    """Applications grouped by role for pie chart."""
    db = get_db()
    pipeline = [
        {"$group": {"_id": "$role", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    data = []
    async for doc in db.job_applications.aggregate(pipeline):
        data.append({"role": doc["_id"] or "Unknown", "count": doc["count"]})
    return data


@router.get("/work-model")
async def work_model_distribution():
    """Remote vs Hybrid vs On-Site, Domestic vs International — for stacked bar."""
    db = get_db()
    pipeline = [
        {
            "$group": {
                "_id": {
                    "work_model": "$work_model",
                    "origin": "$company_origin",
                },
                "count": {"$sum": 1},
            }
        }
    ]
    data = []
    async for doc in db.job_applications.aggregate(pipeline):
        data.append({
            "work_model": doc["_id"]["work_model"] or "Unknown",
            "origin": doc["_id"]["origin"] or "Unknown",
            "count": doc["count"],
        })
    return data


@router.get("/funnel")
async def conversion_funnel():
    """Funnel data: Applied → Assessment → Interview → Offer."""
    db = get_db()
    statuses = ["Applied", "Assessment", "Interview", "Offer"]
    funnel = []

    for status in statuses:
        # Count all applications that EVER reached this status (in history)
        count = await db.job_applications.count_documents({
            "status_history.status": status
        })
        funnel.append({"stage": status, "count": count})

    return funnel


@router.get("/tech-tags")
async def top_tech_tags():
    """Most common tech tags across all applications."""
    db = get_db()
    pipeline = [
        {"$unwind": "$tech_tags"},
        {"$group": {"_id": "$tech_tags", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 15},
    ]
    data = []
    async for doc in db.job_applications.aggregate(pipeline):
        data.append({"tag": doc["_id"], "count": doc["count"]})
    return data


@router.get("/recent-activity")
async def recent_activity():
    """Last 10 status changes across all applications."""
    db = get_db()
    pipeline = [
        {"$unwind": "$status_history"},
        {"$sort": {"status_history.date": -1}},
        {"$limit": 10},
        {
            "$project": {
                "company": 1,
                "role": 1,
                "status": "$status_history.status",
                "date": "$status_history.date",
                "source": "$status_history.source",
            }
        },
    ]
    data = []
    async for doc in db.job_applications.aggregate(pipeline):
        doc["id"] = str(doc.pop("_id"))
        data.append(doc)
    return data
