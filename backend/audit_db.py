from dotenv import load_dotenv
load_dotenv()
import asyncio
import motor.motor_asyncio
from datetime import datetime

async def audit():
    client = motor.motor_asyncio.AsyncIOMotorClient('mongodb://localhost:27017')
    db = client.careernode

    jobs = []
    async for doc in db.job_applications.find().sort('date_applied', -1):
        jobs.append(doc)

    print("=" * 70)
    print(f"JOB APPLICATIONS  (total: {len(jobs)})")
    print("=" * 70)
    for j in jobs:
        status   = j.get("status", "?")
        company  = j.get("company", "?")
        role     = j.get("role", "?")
        platform = j.get("platform") or "Direct"
        applied  = str(j.get("date_applied", ""))[:10]
        src_subj = j.get("source_email_id", "")[:60]
        tags     = ", ".join(j.get("tech_tags", [])[:5])
        print(f"  STATUS  : {status}")
        print(f"  COMPANY : {company}")
        print(f"  ROLE    : {role}")
        print(f"  PLATFORM: {platform}")
        print(f"  APPLIED : {applied}")
        print(f"  TAGS    : {tags}")
        print(f"  SRC-ID  : {src_subj}")
        print("-" * 70)

    print()
    print("=" * 70)
    print("STATUS BREAKDOWN")
    print("=" * 70)
    for status in ['Applied', 'Assessment', 'Interview', 'Offer', 'Rejected']:
        cnt = await db.job_applications.count_documents({'status': status})
        bar = '#' * cnt
        print(f"  {status:<12}: {cnt:3}  {bar}")

    print()
    print("=" * 70)
    print("OPPORTUNITY RADAR")
    print("=" * 70)
    radar_count = await db.opportunity_radar.count_documents({})
    print(f"Total radar leads: {radar_count}")
    async for doc in db.opportunity_radar.find().sort('email_date', -1).limit(20):
        print(f"  {doc.get('company','?'):<30} | {doc.get('job_title','?'):<30} | {doc.get('platform','?')}")

    print()
    print("=" * 70)
    print("POTENTIAL DATA QUALITY ISSUES")
    print("=" * 70)
    issues = 0
    async for j in db.job_applications.find():
        problems = []
        if j.get("company") in (None, "", "Unknown Company"):
            problems.append("MISSING COMPANY")
        if j.get("role") in (None, "", "Unknown Role"):
            problems.append("MISSING ROLE")
        if j.get("company") and len(j.get("company","")) < 2:
            problems.append("SUSPICIOUS COMPANY NAME")
        if problems:
            issues += 1
            print(f"  [{', '.join(problems)}] company={j.get('company','?')} | role={j.get('role','?')}")
    if issues == 0:
        print("  No obvious data quality issues found!")

asyncio.run(audit())
