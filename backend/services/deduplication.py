"""
Deduplication Service
Checks for duplicate job applications before inserting into MongoDB.

Improvements:
  - Fix 1: Deduplicate by Message-ID (prevents same email being processed twice)
  - Fix 3: Fuzzy company name matching (TelenorPk == Telenor)
  - Fix 6: Fuzzy role matching (AI Internship == AI Internship Program)
"""

from typing import Optional, Dict, Any
from db.mongo import get_db
import re
from difflib import SequenceMatcher

# ─── Known company name aliases ───────────────────────────────────────────────
# Maps variant → canonical name. Add more as you discover them.
COMPANY_ALIASES: Dict[str, str] = {
    "telenorpk": "telenor",
    "telenor pakistan": "telenor",
    "google llc": "google",
    "meta platforms": "meta",
    "amazon web services": "amazon",
    "microsoft corporation": "microsoft",
    "apple inc": "apple",
    "peopleperhour": "peopleperhour",
    "smartrecruiters": None,      # skip — it's a platform, not a company
}

# Minimum similarity ratio to consider roles as fuzzy duplicates (0.0–1.0)
ROLE_FUZZY_THRESHOLD = 0.82

# Minimum similarity ratio to consider company names as fuzzy duplicates
COMPANY_FUZZY_THRESHOLD = 0.88


def normalize(text: str) -> str:
    """Lowercase, strip punctuation, collapse spaces."""
    if not text:
        return ""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s]", "", text)
    text = re.sub(r"\s+", " ", text)
    return text


def normalize_company(name: str) -> Optional[str]:
    """
    Normalize company name using alias table.
    Returns None if the name is a platform (not a real employer).
    """
    if not name:
        return name
    key = normalize(name)
    if key in COMPANY_ALIASES:
        return COMPANY_ALIASES[key]   # None means "discard"
    return key


def fuzzy_ratio(a: str, b: str) -> float:
    """Return similarity ratio between two strings (0.0 to 1.0)."""
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b).ratio()


def companies_match(c1: str, c2: str) -> bool:
    """
    Returns True if two company names refer to the same company.
    Uses alias table first, then fuzzy matching.
    """
    n1 = normalize_company(c1) or normalize(c1)
    n2 = normalize_company(c2) or normalize(c2)
    if n1 == n2:
        return True
    return fuzzy_ratio(n1, n2) >= COMPANY_FUZZY_THRESHOLD


def roles_match(r1: str, r2: str) -> bool:
    """
    Returns True if two role names are likely the same position.
    Uses fuzzy matching to handle slight wording differences.
    """
    n1 = normalize(r1)
    n2 = normalize(r2)
    if n1 == n2:
        return True
    # One is a substring of the other (e.g. "AI Internship" ⊂ "AI Internship Program")
    if n1 in n2 or n2 in n1:
        return True
    return fuzzy_ratio(n1, n2) >= ROLE_FUZZY_THRESHOLD


async def message_id_exists(message_id: str) -> bool:
    """Fix 1: Check if this exact email (by Message-ID) was already processed."""
    if not message_id:
        return False
    db = get_db()
    existing = await db.job_applications.find_one({"source_email_id": message_id})
    return existing is not None


async def find_existing_application(company: str, role: str) -> Optional[Dict[str, Any]]:
    """
    Returns the existing document if Company AND Role match (with fuzzy logic),
    otherwise returns None.
    Rules:
      - Same company + same/similar role → duplicate, do NOT store
      - Same company + clearly different role → store as new entry
    """
    db = get_db()
    normalized_co = normalize(company)

    # Fetch all docs for roughly matching companies
    # Use a broad regex first, then apply fuzzy logic in Python
    cursor = db.job_applications.find({})
    async for doc in cursor:
        doc_company = doc.get("company", "")
        doc_role = doc.get("role", "")

        if companies_match(company, doc_company) and roles_match(role, doc_role):
            return doc

    return None


async def should_update_status(existing_doc: Dict, new_status: str) -> bool:
    """
    Determines if the existing application status should be updated
    based on status progression rules.
    Status order: Applied < Assessment < Interview < Offer | Rejected
    """
    STATUS_RANK = {
        "Applied": 1,
        "Assessment": 2,            # Deprecated
        "Assessment_Pending": 2,
        "Assessment_Done": 3,
        "Interview": 4,             # Deprecated
        "Interview_Online": 4,      # Deprecated
        "Interview_Onsite": 4,      # Deprecated
        "Interview_Pending": 4,
        "Interview_Done": 5,
        "Offer": 6,
        "Rejected": 7,
        "Withdrawn": 7,
        "Ghosted": 7,
    }
    current_status = existing_doc.get("status", "Applied")
    current_rank = STATUS_RANK.get(current_status, 1)
    new_rank = STATUS_RANK.get(new_status, 1)

    # Update if new status is a progression (higher rank)
    return new_rank > current_rank
