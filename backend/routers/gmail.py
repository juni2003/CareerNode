"""
Gmail Router — IMAP App Password approach (no OAuth needed)
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel

router = APIRouter(prefix="/gmail", tags=["gmail"])


class SweepRequest(BaseModel):
    months: int = 2


@router.get("/status")
async def gmail_status():
    """Check if Gmail App Password credentials are configured."""
    from services.gmail_service import is_configured, GMAIL_EMAIL

    configured = is_configured()

    # If configured, try a quick IMAP connection test
    connected = False
    error_msg = None
    if configured:
        try:
            import imaplib
            mail = imaplib.IMAP4_SSL("imap.gmail.com", 993)
            mail.login(
                __import__("os").getenv("GMAIL_EMAIL", ""),
                __import__("os").getenv("GMAIL_APP_PASSWORD", "")
            )
            mail.logout()
            connected = True
        except Exception as e:
            error_msg = str(e)

    from services.gmail_service import get_last_sweep_time

    last_sweep = await get_last_sweep_time()

    return {
        "configured": configured,
        "connected": connected,
        "email": GMAIL_EMAIL if configured else None,
        "method": "imap_app_password",
        "error": error_msg,
        "last_sweep_at": last_sweep.isoformat() if last_sweep else None,
    }


@router.post("/sweep")
async def trigger_sweep(request: SweepRequest, background_tasks: BackgroundTasks):
    """Trigger email sweep in the background."""
    from services.gmail_service import is_configured, sweep_emails

    if not is_configured():
        raise HTTPException(
            status_code=400,
            detail=(
                "Gmail not configured. Add these two lines to backend/.env:\n"
                "GMAIL_EMAIL=you@gmail.com\n"
                "GMAIL_APP_PASSWORD=your16charpassword"
            ),
        )

    background_tasks.add_task(sweep_emails, request.months)
    return {"message": f"Email sweep started for the last {request.months} months."}


@router.post("/sweep/sync")
async def trigger_sweep_sync(request: SweepRequest):
    """Trigger synchronous email sweep and return results."""
    from services.gmail_service import is_configured, sweep_emails

    if not is_configured():
        raise HTTPException(
            status_code=400,
            detail=(
                "Gmail not configured. Add these two lines to backend/.env:\n"
                "GMAIL_EMAIL=you@gmail.com\n"
                "GMAIL_APP_PASSWORD=your16charpassword"
            ),
        )

    stats = await sweep_emails(months=request.months)
    return {"message": "Sweep complete", "stats": stats}
