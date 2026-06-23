"""
Email Parser Service
Extracts structured job application metadata from raw email bodies.
Uses Gemini AI for highly accurate extraction of Company, Role, and Status.

Improvements:
  - Fix 2: Block known non-job sender domains (github.com, etc.)
  - Fix 4: Extract company/role from Indeed HTML structure when AI misses it
  - Fix 5: Tag entries with 'needs_review' flag when role/company is missing
"""

import re
import os
import json
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
from bs4 import BeautifulSoup
import google.generativeai as genai

logger = logging.getLogger(__name__)

# ─── Fix 2: Sender domains to always block (not job-related) ──────────────────
BLOCKED_SENDER_DOMAINS = {
    "github.com",
    "gitlab.com",
    "bitbucket.org",
    "stackoverflow.com",
    "reddit.com",
    "twitter.com",
    "facebook.com",
    "instagram.com",
    "youtube.com",
    "medium.com",
    "substack.com",
    "mailchimp.com",       # marketing newsletters
    "constantcontact.com", # marketing newsletters
}

# ─── Status Detection Keywords (Fallback) ────────────────────────────────────
STATUS_KEYWORDS = {
    "Applied": [
        "thanks for applying", "thank you for applying",
        "application received", "we received your application",
        "your application has been submitted", "successfully applied",
        "application confirmation", "we got your application",
    ],
    "Assessment": [
        "online assessment", "coding challenge", "technical test",
        "take-home assignment", "skills assessment", "aptitude test",
        "hackerrank", "codility", "testgorilla",
    ],
    "Interview": [
        "congratulations", "moving to the next", "next stage",
        "schedule an interview", "interview invitation", "we'd like to speak",
        "we would like to invite", "phone screen", "technical interview",
        "virtual interview", "video interview", "moving forward",
    ],
    "Offer": [
        "we are pleased to offer", "job offer", "offer letter",
        "we'd like to extend an offer", "congratulations on your offer",
    ],
    "Rejected": [
        "unfortunately", "we will not be moving forward",
        "we have decided to pursue other candidates",
        "not selected", "position has been filled",
        "we won't be moving forward", "after careful consideration",
        "not a match", "we're unable to move forward",
    ],
}

PLATFORM_SENDERS = {
    "linkedin": "LinkedIn",
    "indeed": "Indeed",
    "glassdoor": "Glassdoor",
    "naukri": "Naukri",
    "rozee": "Rozee.pk",
    "workday": "Workday",
    "greenhouse": "Greenhouse",
    "lever": "Lever",
    "breezy": "Breezy HR",
}


def html_to_text(html: str) -> str:
    """Strip HTML tags and return plain text."""
    try:
        soup = BeautifulSoup(html, "lxml")
        return soup.get_text(separator=" ", strip=True)
    except Exception:
        return html


def detect_platform(sender: str) -> Optional[str]:
    """Detect the job platform from sender email address."""
    sender_lower = sender.lower()
    for key, platform in PLATFORM_SENDERS.items():
        if key in sender_lower:
            return platform
    return None


def is_blocked_sender(sender: str) -> bool:
    """Fix 2: Return True if this email is from a non-job domain."""
    sender_lower = sender.lower()
    for domain in BLOCKED_SENDER_DOMAINS:
        if domain in sender_lower:
            return True
    return False


def extract_apply_links(body_html: str) -> List[str]:
    """Extract apply/job links from HTML email body."""
    try:
        soup = BeautifulSoup(body_html, "lxml")
        links = []
        for a in soup.find_all("a", href=True):
            href = a.get("href", "")
            text = a.get_text(strip=True).lower()
            if any(kw in text for kw in ["apply", "view job", "see job", "job details", "learn more"]):
                if href.startswith("http"):
                    links.append(href)
        return links[:3]
    except Exception:
        return []


def extract_indeed_metadata(body_html: str, subject: str) -> Dict[str, Optional[str]]:
    """
    Fix 4: Extract company and role from Indeed's HTML email structure.
    Indeed emails contain structured table data with job title and company name.
    """
    result = {"company": None, "role": None}
    if not body_html:
        return result

    try:
        soup = BeautifulSoup(body_html, "lxml")
        text_blocks = [t.strip() for t in soup.get_text(separator="\n").split("\n") if t.strip()]

        # Indeed's "Application submitted" email structure:
        # Line 1: "Application submitted"
        # Line 2: Job Title
        # Line 3: Company Name - Location
        # Find the "Application submitted" anchor
        for i, block in enumerate(text_blocks):
            if "application submitted" in block.lower() or "application was submitted" in block.lower():
                # Next non-empty lines are role and company
                remaining = [b for b in text_blocks[i+1:] if len(b) > 2]
                if remaining:
                    # First block after "Application submitted" is likely the job title
                    role_candidate = remaining[0]
                    # Filter out boilerplate
                    if len(role_candidate) > 3 and "indeed" not in role_candidate.lower():
                        result["role"] = role_candidate

                if len(remaining) > 1:
                    # Second block often is "Company - Location"
                    company_line = remaining[1]
                    # Strip location (everything after " - " or " – ")
                    company_candidate = re.split(r"\s[-–]\s", company_line)[0].strip()
                    if len(company_candidate) > 2 and "indeed" not in company_candidate.lower():
                        result["company"] = company_candidate
                break

        # Fallback: look for common HTML patterns in Indeed emails (td/h* tags)
        if not result["role"]:
            for tag in soup.find_all(["h1", "h2", "h3", "strong", "b"]):
                text = tag.get_text(strip=True)
                if 3 < len(text) < 100 and "indeed" not in text.lower() and "application" not in text.lower():
                    result["role"] = text
                    break

    except Exception as e:
        logger.debug(f"Indeed HTML extraction failed: {e}")

    return result


def ai_parse_metadata(subject: str, body_plain: str, sender: str, body_html: str = "") -> Dict[str, Any]:
    """
    Uses Gemini AI to intelligently extract Company, Role, Status, and alert flag.
    Also passes a cleaned HTML snippet for better context on platform emails.
    Returns a dict with 'company', 'role', 'status', 'is_job_alert'.
    """
    api_key = os.getenv("GEMINI_API_KEY", "")

    # Combine plain text + key parts of HTML for richer context
    html_text_supplement = ""
    if body_html:
        # Get first 1000 chars of HTML-stripped text as supplemental context
        raw_html_text = html_to_text(body_html)
        if raw_html_text and raw_html_text != body_plain:
            html_text_supplement = f"\n\nAdditional content from HTML version:\n{raw_html_text[:1000]}"

    prompt = f"""
You are an expert AI parser for a job application tracking system.
Analyze this email (sender, subject, and body) to extract job application details.

Email Sender: {sender}
Email Subject: {subject}
Email Body:
{body_plain[:2000]}{html_text_supplement}

Extract the following information and return ONLY valid JSON:
{{
  "company": "The exact name of the hiring company. Do not use platform names (LinkedIn, Indeed, Workday) unless they are the actual employer. Look carefully in both the subject and body.",
  "role": "The exact job title being applied for. Look in the subject line too — platforms like Indeed often put it there.",
  "status": "Must be exactly one of: 'Applied', 'Assessment_Pending', 'Assessment_Done', 'Interview_Pending', 'Interview_Done', 'Offer', 'Rejected'.",
  "is_job_alert": false
}}

Important rules:
- For Indeed emails: The subject often contains the job title like 'Application submitted'. Check carefully.
- For Telenor/TelenorPk: normalize company to 'Telenor'.
- If company is a platform name (Indeed, LinkedIn, Workday, SmartRecruiters), set company to null.
- Set is_job_alert to true ONLY for generic recommendation/alert emails, not individual application confirmations.
- If you genuinely cannot determine company or role, return null for that field.
"""

    fallback_result = {
        "company": None,
        "role": None,
        "status": "Applied",
        "is_job_alert": False
    }

    if not api_key:
        logger.warning("No GEMINI_API_KEY found, falling back to basic parsing.")
        return fallback_basic_parse(subject, body_plain, sender)

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-3.1-flash-lite')
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        data = json.loads(response.text)

        # Gemini sometimes wraps the result in a list — unwrap it
        if isinstance(data, list):
            data = data[0] if data else {}

        # Ensure it's a dict before calling .get()
        if not isinstance(data, dict):
            raise ValueError(f"Unexpected Gemini response type: {type(data)}")

        # Ensure status is valid
        valid_statuses = {
            "Applied", "Assessment_Pending", "Assessment_Done", 
            "Interview_Pending", "Interview_Done",
            "Offer", "Rejected"
        }
        if data.get("status") not in valid_statuses:
            data["status"] = "Applied"

        return data
    except Exception as e:
        logger.error(f"Gemini parsing failed: {e}")
        return fallback_basic_parse(subject, body_plain, sender)


def fallback_basic_parse(subject: str, body_plain: str, sender: str) -> Dict[str, Any]:
    """Basic regex fallback if Gemini is down or key is missing."""
    text_lower = (subject + " " + body_plain).lower()

    status = "Applied"
    # Basic keyword mapping
    keyword_map = {
        "Offer": STATUS_KEYWORDS.get("Offer", []),
        "Rejected": STATUS_KEYWORDS.get("Rejected", []),
        "Interview_Pending": STATUS_KEYWORDS.get("Interview", []),
        "Assessment_Pending": STATUS_KEYWORDS.get("Assessment", []),
        "Applied": STATUS_KEYWORDS.get("Applied", [])
    }
    
    for s, keywords in keyword_map.items():
        for kw in keywords:
            if kw in text_lower:
                status = s
                break
        if status != "Applied":
            break

    company = None
    role = None

    comp_match = re.search(r"at ([A-Z][A-Za-z0-9\s\.,&-]{1,30})\b", subject + " " + body_plain[:200])
    if comp_match:
        company = comp_match.group(1).strip()

    role_match = re.search(r"(?:for|position of|role of) ([A-Z][A-Za-z0-9\s/\-]{3,40})", subject + " " + body_plain[:200])
    if role_match:
        role = role_match.group(1).strip()

    is_alert = "job alert" in text_lower or "jobs you may like" in text_lower

    return {
        "company": company,
        "role": role,
        "status": status,
        "is_job_alert": is_alert
    }


def parse_email(
    message_id: str,
    sender: str,
    subject: str,
    body_plain: str,
    body_html: str,
    date: datetime,
) -> Dict[str, Any]:
    """
    Main parsing function. Returns structured dict with job metadata.
    Includes blocked-sender check (Fix 2).
    """
    # Fix 2: Block non-job senders immediately
    if is_blocked_sender(sender):
        logger.debug(f"Blocked sender: {sender} | Subject: {subject[:50]}")
        return {
            "message_id": message_id,
            "sender": sender,
            "subject": subject,
            "company": None,
            "role": None,
            "status": "Applied",
            "platform": None,
            "date": date,
            "is_job_alert": False,
            "is_blocked": True,     # signal to gmail_service to skip this
            "apply_links": [],
            "body_snippet": "",
        }

    platform = detect_platform(sender)
    apply_links = extract_apply_links(body_html) if body_html else []

    # Use AI to parse — now passing HTML too for better context
    ai_data = ai_parse_metadata(subject, body_plain, sender, body_html)

    company = ai_data.get("company")
    role = ai_data.get("role")

    # Fix 4: If platform is Indeed and company is still missing, try HTML extraction
    if platform == "Indeed" and not company:
        indeed_data = extract_indeed_metadata(body_html or "", subject)
        if indeed_data.get("company"):
            company = indeed_data["company"]
        if indeed_data.get("role") and not role:
            role = indeed_data["role"]

    # Fix 5: Flag records that need human review
    needs_review = not company or not role

    return {
        "message_id": message_id,
        "sender": sender,
        "subject": subject,
        "company": company,
        "role": role,
        "status": ai_data.get("status", "Applied"),
        "platform": platform,
        "date": date,
        "is_job_alert": ai_data.get("is_job_alert", False),
        "is_blocked": False,
        "needs_review": needs_review,       # Fix 5: visible flag for UI
        "apply_links": apply_links,
        "body_snippet": body_plain[:500] if body_plain else "",
    }
