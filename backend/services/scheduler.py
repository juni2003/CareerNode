"""
APScheduler Background Job Scheduler
Runs periodic email sweeps in the background.
"""

import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
import os

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def scheduled_sweep():
    """Periodic Gmail sweep task."""
    try:
        from services.gmail_service import sweep_emails, is_configured
        if not is_configured():
            logger.info("Scheduler: Gmail not configured, skipping sweep.")
            return
        stats = await sweep_emails(months=1)
        logger.info(f"Scheduled sweep complete: {stats}")
    except Exception as e:
        logger.error(f"Scheduled sweep error: {e}")


def start_scheduler():
    interval_minutes = int(os.getenv("SCRAPE_INTERVAL_MINUTES", "30"))
    scheduler.add_job(
        scheduled_sweep,
        trigger=IntervalTrigger(minutes=interval_minutes),
        id="gmail_sweep",
        name="Gmail Email Sweep",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(f"✅ Scheduler started — sweeping every {interval_minutes} minutes.")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("🔌 Scheduler stopped.")
