"""
One-time cleanup script:
- Deletes the GitHub discussion false-positive entry
- Deletes Telenor/TelenorPk duplicates, keeping only the best Assessment entry
"""
from dotenv import load_dotenv; load_dotenv()
import asyncio, motor.motor_asyncio

async def cleanup():
    db = motor.motor_asyncio.AsyncIOMotorClient('mongodb://localhost:27017').careernode

    # 1. Delete GitHub discussion entry
    r1 = await db.job_applications.delete_many({"source_email_id": {"$regex": "github.com"}})
    print(f"Deleted {r1.deleted_count} GitHub discussion entry/entries")

    # 2. Delete Telenor duplicates — keep only the Assessment with full role
    telenor_entries = []
    async for doc in db.job_applications.find({"company": {"$in": ["Telenor", "TelenorPk"]}}):
        telenor_entries.append(doc)

    print(f"Found {len(telenor_entries)} Telenor entries:")
    for e in telenor_entries:
        print(f"  [{e.get('status')}] {e.get('company')} | {e.get('role')} | id={e['_id']}")

    # Keep the one with fullest role name and Assessment status, delete the rest
    best = None
    for e in telenor_entries:
        if e.get("status") == "Assessment" and e.get("role") and "Unknown" not in e.get("role", ""):
            if best is None or len(e.get("role","")) > len(best.get("role","")):
                best = e

    if best:
        ids_to_delete = [e["_id"] for e in telenor_entries if e["_id"] != best["_id"]]
        if ids_to_delete:
            r2 = await db.job_applications.delete_many({"_id": {"$in": ids_to_delete}})
            print(f"Deleted {r2.deleted_count} Telenor duplicate(s), kept: [{best.get('status')}] {best.get('role')}")
        else:
            print("No Telenor duplicates to delete.")
    else:
        print("Could not determine best Telenor entry — skipping.")

    # 3. Also delete Devsinc duplicate (keep the one with longer role name)
    devsinc_entries = []
    async for doc in db.job_applications.find({"company": "Devsinc"}):
        devsinc_entries.append(doc)

    print(f"\nFound {len(devsinc_entries)} Devsinc entries:")
    for e in devsinc_entries:
        print(f"  {e.get('company')} | {e.get('role')} | id={e['_id']}")

    if len(devsinc_entries) > 1:
        # Keep the one with the longest role (more descriptive)
        best_d = max(devsinc_entries, key=lambda e: len(e.get("role") or ""))
        ids_to_delete_d = [e["_id"] for e in devsinc_entries if e["_id"] != best_d["_id"]]
        r3 = await db.job_applications.delete_many({"_id": {"$in": ids_to_delete_d}})
        print(f"Deleted {r3.deleted_count} Devsinc duplicate(s), kept: {best_d.get('role')}")

    print("\nCleanup done!")

asyncio.run(cleanup())
