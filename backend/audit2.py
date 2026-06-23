from dotenv import load_dotenv; load_dotenv()
import asyncio, motor.motor_asyncio

async def audit():
    db = motor.motor_asyncio.AsyncIOMotorClient('mongodb://localhost:27017').careernode

    print("=== NON-APPLIED STATUS ENTRIES ===")
    async for doc in db.job_applications.find({"status": {"$ne": "Applied"}}).sort("date_applied", -1):
        status  = doc.get("status", "?")
        company = doc.get("company", "?")
        role    = (doc.get("role") or "?")[:55]
        print(f"  [{status}] {company} | {role}")

    print()
    print("=== SAMPLE: Unknown Company Indeed email body ===")
    async for doc in db.job_applications.find({"platform": "Indeed", "company": "Unknown Company"}).limit(3):
        print("ROLE:", doc.get("role"))
        print("SNIPPET:", (doc.get("job_description") or "")[:300])
        print("---")

    print()
    print("=== SUSPICIOUS: Students / GitHub entry ===")
    async for doc in db.job_applications.find({"role": "Students"}):
        print("COMPANY:", doc.get("company"))
        print("SRC:", doc.get("source_email_id"))
        print("DESC:", (doc.get("job_description") or "")[:300])

    print()
    print("=== TOTAL COUNTS ===")
    total = await db.job_applications.count_documents({})
    unknown_co = await db.job_applications.count_documents({"company": "Unknown Company"})
    unknown_role = await db.job_applications.count_documents({"role": "Unknown Role"})
    print(f"  Total jobs     : {total}")
    print(f"  Unknown company: {unknown_co} ({round(unknown_co/total*100)}%)")
    print(f"  Unknown role   : {unknown_role} ({round(unknown_role/total*100)}%)")

asyncio.run(audit())
