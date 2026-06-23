"""
Gmail IMAP Service — Uses App Password (no OAuth, no Google Cloud needed)
Connect via IMAP with a Gmail App Password for secure, local-only access.
"""

import imaplib
import email as email_lib
from email.header import decode_header as email_decode_header
import os
import logging
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Any

from services.email_parser import parse_email, html_to_text
from services.deduplication import find_existing_application, should_update_status
from services.tech_tagger import extract_tech_tags
from db.mongo import get_db

logger = logging.getLogger(__name__)

GMAIL_EMAIL = os.getenv("GMAIL_EMAIL", "")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "")
IMAP_HOST = "imap.gmail.com"
IMAP_PORT = 993

# ─── Subject-line keywords to search for (IMAP SUBJECT search) ──────────────
SEARCH_SUBJECTS = [
    # Application confirmations (most common patterns)
    "application submitted",       # Indeed, Glassdoor
    "application received",         # Workday, Greenhouse
    "application confirmation",
    "your application",             # broad catch
    "we received your application",
    "we received your",
    "thanks for applying",
    "thank you for applying",
    "thank you for your application",
    "thank you for your interest",  # EventMobi, Datamatics style
    "thanks for your interest",
    "thanks for submitting",
    "thank you for submitting",
    "successfully applied",
    "application under review",

    # Status update keywords
    "congratulations",
    "interview invitation",
    "moving to the next",
    "next steps",
    "we'd like to invite",
    "we would like to invite",
    "unfortunately",
    "we regret",
    "not moving forward",

    # Assessment / Test emails
    "online assessment",
    "coding challenge",
    "take-home",

    # Offer
    "offer letter",
    "job offer",

    # Job Alerts
    "job alert",
    "jobs you may like",
    "new jobs for you",
]

# ─── Body-text keywords for secondary IMAP TEXT search (catches unusual subjects)
SEARCH_BODY_TEXT = [
    "thank you for your interest in working with us",  # EventMobi
    "thank you for your interest in employment",       # Datamatics
    "we will review your application",
    "we will be reviewing your application",
    "your resume is not going into a black hole",
    "good luck with your application",
]


def is_configured() -> bool:
    """Check if Gmail credentials are set in .env"""
    return bool(GMAIL_EMAIL and GMAIL_APP_PASSWORD)


def get_imap_connection() -> imaplib.IMAP4_SSL:
    """Connect and login to Gmail via IMAP."""
    if not is_configured():
        raise ValueError(
            "Gmail not configured. Add GMAIL_EMAIL and GMAIL_APP_PASSWORD to backend/.env"
        )
    mail = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
    mail.login(GMAIL_EMAIL, GMAIL_APP_PASSWORD)
    return mail


def decode_str(value: str) -> str:
    """Decode email header value (handles encoded words)."""
    if not value:
        return ""
    parts = email_decode_header(value)
    decoded = []
    for part, enc in parts:
        if isinstance(part, bytes):
            decoded.append(part.decode(enc or "utf-8", errors="replace"))
        else:
            decoded.append(str(part))
    return " ".join(decoded).strip()


def get_email_body(msg) -> tuple[str, str]:
    """Extract plain text and HTML body from email message."""
    plain = ""
    html = ""

    if msg.is_multipart():
        for part in msg.walk():
            ct = part.get_content_type()
            cd = str(part.get("Content-Disposition") or "")
            if "attachment" in cd:
                continue
            charset = part.get_content_charset() or "utf-8"
            try:
                payload = part.get_payload(decode=True)
                if payload is None:
                    continue
                text = payload.decode(charset, errors="replace")
                if ct == "text/plain" and not plain:
                    plain = text
                elif ct == "text/html" and not html:
                    html = text
            except Exception:
                continue
    else:
        ct = msg.get_content_type()
        charset = msg.get_content_charset() or "utf-8"
        try:
            payload = msg.get_payload(decode=True)
            text = payload.decode(charset, errors="replace") if payload else ""
            if ct == "text/html":
                html = text
                plain = html_to_text(text)
            else:
                plain = text
        except Exception:
            pass

    if html and not plain:
        plain = html_to_text(html)

    return plain, html


def build_imap_date(dt: datetime) -> str:
    """Return IMAP-formatted date string from a datetime object."""
    return dt.strftime("%d-%b-%Y")


async def get_last_sweep_time() -> datetime | None:
    """
    Returns the start time of the last successful sweep from MongoDB,
    or None if no sweep has been recorded yet.
    """
    db = get_db()
    doc = await db.sweep_log.find_one(sort=[("started_at", -1)])
    if doc:
        ts = doc.get("started_at")
        if ts and hasattr(ts, 'tzinfo') and ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        return ts
    return None


async def save_sweep_log(started_at: datetime, stats: dict) -> None:
    """Save a record of this sweep to MongoDB for incremental tracking."""
    db = get_db()
    await db.sweep_log.insert_one({
        "started_at": started_at,
        "completed_at": datetime.now(timezone.utc),
        "stats": stats,
    })
    # Keep only the last 50 sweep logs to avoid bloat
    logs = await db.sweep_log.count_documents({})
    if logs > 50:
        oldest = await db.sweep_log.find_one(sort=[("started_at", 1)])
        if oldest:
            await db.sweep_log.delete_one({"_id": oldest["_id"]})


async def sweep_emails(months: int = 2) -> Dict[str, int]:
    """
    Connect to Gmail via IMAP, search for job-related emails,
    parse them, and store/update in MongoDB.
    """
    if not is_configured():
        raise ValueError(
            "Gmail credentials not set. Open backend/.env and add:\n"
            "GMAIL_EMAIL=you@gmail.com\n"
            "GMAIL_APP_PASSWORD=your16charpassword"
        )

    db = get_db()
    stats = {"inserted": 0, "updated": 0, "skipped": 0, "radar": 0, "errors": 0, "total_found": 0}

    # ── Incremental sweep: use last sweep time with 1-hour overlap buffer ──────
    sweep_start = datetime.now(timezone.utc)
    last_sweep = await get_last_sweep_time()

    if last_sweep:
        # Subtract 1 hour from last sweep time as a safety buffer.
        # This means we re-check emails that arrived in the hour before the
        # last sweep started, guaranteeing nothing gets missed.
        cutoff_dt = last_sweep - timedelta(hours=1)
        since_date = build_imap_date(cutoff_dt)
        logger.info(f"Incremental sweep: looking at emails since {since_date} (with 1hr buffer)")
    else:
        # First ever sweep — go back N months
        cutoff_dt = datetime.now(timezone.utc) - timedelta(days=months * 30)
        since_date = build_imap_date(cutoff_dt)
        logger.info(f"First sweep: looking back {months} months since {since_date}")

    try:
        mail = get_imap_connection()
        mail.select("inbox")

        # Collect message IDs from multiple subject searches
        all_ids: set[bytes] = set()

        # Pass 1: Subject-line keyword search
        for subject_kw in SEARCH_SUBJECTS:
            try:
                _, data = mail.search(None, f'(SINCE "{since_date}" SUBJECT "{subject_kw}")')
                if data and data[0]:
                    for mid in data[0].split():
                        all_ids.add(mid)
            except Exception:
                pass

        # Pass 2: Body-text search for emails with unusual/generic subjects
        for body_kw in SEARCH_BODY_TEXT:
            try:
                _, data = mail.search(None, f'(SINCE "{since_date}" BODY "{body_kw}")')
                if data and data[0]:
                    for mid in data[0].split():
                        all_ids.add(mid)
            except Exception:
                pass

        # Pass 3: Also search "All Mail" (catches archived / auto-labeled emails)
        try:
            mail.select('"[Gmail]/All Mail"')
            for subject_kw in ["application submitted", "thanks for applying",
                                "thank you for your interest", "application received",
                                "interview", "your application"]:
                _, data = mail.search(None, f'(SINCE "{since_date}" SUBJECT "{subject_kw}")')
                if data and data[0]:
                    for mid in data[0].split():
                        all_ids.add(mid)
        except Exception:
            pass

        # Go back to inbox
        mail.select("inbox")
        stats["total_found"] = len(all_ids)
        logger.info(f"IMAP sweep found {len(all_ids)} candidate emails.")

        for msg_id in all_ids:
            try:
                _, msg_data = mail.fetch(msg_id, "(RFC822)")
                if not msg_data or not msg_data[0]:
                    continue
                raw_email = msg_data[0][1]
                msg = email_lib.message_from_bytes(raw_email)

                sender = decode_str(msg.get("From", ""))
                subject = decode_str(msg.get("Subject", ""))
                date_str = msg.get("Date", "")
                message_id = msg.get("Message-ID", str(msg_id))

                # Fix 1: Skip if this exact email was already processed
                from services.deduplication import message_id_exists
                if await message_id_exists(message_id):
                    logger.debug(f"Skipping already-processed email: {message_id[:50]}")
                    stats["skipped"] += 1
                    continue

                # Fix 2: Skip blocked sender domains (github, reddit, etc.)
                from services.email_parser import is_blocked_sender
                if is_blocked_sender(sender):
                    logger.debug(f"Blocked sender skipped: {sender}")
                    stats["skipped"] += 1
                    continue

                # Parse date
                try:
                    import email.utils
                    date_tuple = email.utils.parsedate_tz(date_str)
                    if date_tuple:
                        timestamp = email.utils.mktime_tz(date_tuple)
                        date = datetime.fromtimestamp(timestamp, tz=timezone.utc)
                    else:
                        date = datetime.now(timezone.utc)
                except Exception:
                    date = datetime.now(timezone.utc)

                plain, html_body = get_email_body(msg)

                # Rate limit: max 15 requests per minute -> ~1 request every 4 seconds
                await asyncio.sleep(4.5)

                # Use existing parser
                parsed = parse_email(message_id, sender, subject, plain, html_body, date)

                if parsed["is_job_alert"]:
                    # Only store radar leads that have an actual apply link — skip null ones
                    # to avoid MongoDB duplicate key error on the unique apply_link index
                    if parsed["apply_links"]:
                        radar_doc = {
                            "platform": parsed["platform"],
                            "job_title": parsed["role"],
                            "company": parsed["company"],
                            "apply_link": parsed["apply_links"][0],
                            "description_snippet": parsed["body_snippet"],
                            "email_date": date,
                            "status": "unreviewed",
                            "created_at": datetime.now(timezone.utc),
                        }
                        await db.opportunity_radar.update_one(
                            {"apply_link": radar_doc["apply_link"]},
                            {"$setOnInsert": radar_doc},
                            upsert=True,
                        )
                        stats["radar"] += 1
                    else:
                        stats["skipped"] += 1
                    continue

                # Skip only if we truly have nothing to work with
                # Try extracting company from the sender email domain as last resort
                if not parsed["company"]:
                    import re as _re
                    domain_match = _re.search(r"@([a-zA-Z0-9-]+)\.", sender)
                    if domain_match:
                        domain = domain_match.group(1).lower()
                        if domain not in ("gmail", "yahoo", "outlook", "hotmail", "noreply",
                                          "indeed", "linkedin", "glassdoor", "bounce", "mail"):
                            parsed["company"] = domain.capitalize()

                if not parsed["company"] and not parsed["role"]:
                    logger.debug(f"Skipping email — no company or role found: {subject[:60]}")
                    stats["skipped"] += 1
                    continue

                company = parsed["company"] or "Unknown Company"
                role = parsed["role"] or "Unknown Role"
                status = parsed["status"]

                existing = await find_existing_application(company, role)

                if existing:
                    if await should_update_status(existing, status):
                        await db.job_applications.update_one(
                            {"_id": existing["_id"]},
                            {
                                "$set": {"status": status, "updated_at": datetime.now(timezone.utc)},
                                "$push": {
                                    "status_history": {
                                        "status": status,
                                        "date": date,
                                        "source": "email",
                                    }
                                },
                            },
                        )
                        stats["updated"] += 1
                    else:
                        stats["skipped"] += 1
                else:
                    tech_tags = extract_tech_tags(plain)
                    doc = {
                        "company": company,
                        "role": role,
                        "date_applied": date,
                        "status": status,
                        "status_history": [{"status": status, "date": date, "source": "email"}],
                        "job_description": plain[:3000],
                        "tech_tags": tech_tags,
                        "location": None,
                        "work_model": "Unknown",
                        "company_origin": "Unknown",
                        "platform": parsed["platform"],
                        "apply_link": parsed["apply_links"][0] if parsed["apply_links"] else None,
                        "notes": "",
                        "source_email_id": message_id,
                        "needs_review": parsed.get("needs_review", False),  # Fix 5
                        "created_at": datetime.now(timezone.utc),
                        "updated_at": datetime.now(timezone.utc),
                    }
                    await db.job_applications.insert_one(doc)
                    stats["inserted"] += 1

            except Exception as e:
                logger.error(f"Error processing message {msg_id}: {e}")
                stats["errors"] += 1
                continue

        try:
            mail.logout()
        except Exception:
            pass

    except imaplib.IMAP4.error as e:
        error_msg = str(e)
        if "AUTHENTICATIONFAILED" in error_msg.upper():
            raise ValueError(
                "Gmail login failed! Make sure:\n"
                "1. GMAIL_EMAIL is your full Gmail address\n"
                "2. GMAIL_APP_PASSWORD is the 16-char app password (no spaces)\n"
                "3. 2-Step Verification is ON in your Google account\n"
                "4. IMAP is enabled in Gmail Settings → See all settings → Forwarding and POP/IMAP"
            )
        raise

    # Save sweep timestamp so next run is incremental
    await save_sweep_log(sweep_start, stats)
    logger.info(f"Sweep log saved. Next sweep will start from {sweep_start.strftime('%Y-%m-%d %H:%M')} UTC (minus 1hr buffer).")

    return stats
