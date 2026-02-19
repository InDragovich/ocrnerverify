"""
NER entity extraction and verification.
Ported from Colab notebook cells 25, 29, 31, 33, 35, 37.

Extracts: kategori, periode, nominal from OCR text using IndoBERT NER.
"""

import re
import logging
from typing import Optional

from ner.model import get_pipeline

logger = logging.getLogger(__name__)

# ─── Category mapping (from notebook cell 31) ─────────────────────────────────

CATEGORY_MAPPING = {
    "Listrik": [
        "PLN", "PERUSAHAAN LISTRIK NEGARA", "PT PLN", "LISTRIK NEGARA", "LISTRIK",
    ],
    "Telepon": [
        "TELKOMSEL", "XL", "AXIS", "INDOSAT", "IM3", "TRI",
        "HANDPHONE", "TELEPON", "FAX", "TOPUP",
    ],
    "Air dan Gas": [
        "AIR", "PDAM", "GAS", "LPG", "GALON",
    ],
    "Kebersihan": [
        "KEBERSIHAN", "PENERANGAN", "RUMPUT", "PEMELIHARAAN",
    ],
}

# ─── Month constants (from notebook cell 33) ──────────────────────────────────

ID_MONTHS = {
    "jan": "Januari", "januari": "Januari",
    "feb": "Februari", "februari": "Februari",
    "mar": "Maret", "maret": "Maret",
    "apr": "April", "april": "April",
    "mei": "Mei",
    "jun": "Juni", "juni": "Juni",
    "jul": "Juli", "juli": "Juli",
    "agu": "Agustus", "agt": "Agustus", "agustus": "Agustus",
    "sep": "September", "september": "September",
    "okt": "Oktober", "oktober": "Oktober",
    "nov": "November", "november": "November",
    "des": "Desember", "desember": "Desember",
}

MONTHS_LIST = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
]


# ─── Text preprocessing (from notebook cell 29) ───────────────────────────────

def preprocess_text_for_ner(text: str) -> str:
    """
    Reorder text so lines containing nominal keywords appear first.
    This improves NER detection accuracy for MON (money) entities.
    """
    lines = text.split("\n")
    priority_lines = []
    other_lines = []

    nominal_keywords = [
        "total", "bayar", "tagihan", "jumlah", "pembayaran", "rp", "rupiah",
    ]

    for line in lines:
        line_lower = line.lower()
        if any(kw in line_lower for kw in nominal_keywords):
            priority_lines.append(line)
        else:
            other_lines.append(line)

    return "\n".join(priority_lines + other_lines)


# ─── Rupiah normalization (from notebook cell 29) ─────────────────────────────

def normalize_rupiah(text: str) -> Optional[int]:
    """
    Normalize Indonesian rupiah format to integer.
    Supports: Rp 200.000, 200000, 2,5 juta, 500 ribu
    """
    if not text:
        return None

    text = text.strip().lower()

    # Handle juta/ribu multipliers
    if "jt" in text or "juta" in text:
        match = re.search(r"([\d.,]+)", text)
        if match:
            val = float(match.group(1).replace(".", "").replace(",", "."))
            return int(val * 1_000_000)

    if "rb" in text or "ribu" in text:
        match = re.search(r"([\d.,]+)", text)
        if match:
            val = float(match.group(1).replace(".", "").replace(",", "."))
            return int(val * 1_000)

    # Strip Rp prefix
    text = re.sub(r"rp\.?\s*", "", text)

    # Extract only digits, dots, commas
    clean = re.sub(r"[^\d.,]", "", text)
    if not clean:
        return None

    try:
        # Indonesian format: 200.000 (dot = thousands separator)
        if "." in clean and "," not in clean:
            if len(clean.split(".")[-1]) == 3:
                return int(clean.replace(".", ""))

        # Format: 200,000 (comma = thousands separator)
        if "," in clean and "." not in clean:
            return int(clean.replace(",", ""))

        # Plain number
        if clean.replace(".", "").replace(",", "").isdigit():
            return int(clean.replace(".", "").replace(",", ""))

    except (ValueError, TypeError):
        pass

    return None


# ─── NER entity extraction (from notebook cell 25) ────────────────────────────

def extract_entities_with_ner(text: str) -> list[dict]:
    """
    Run IndoBERT NER pipeline on text.
    Returns list of {text, label, score, start, end}.
    """
    ner = get_pipeline()

    # IndoBERT has ~512 token limit; truncate long texts
    # Keep first ~2000 chars which usually covers header + billing info
    chunk = text[:2000]

    try:
        entities = ner(chunk)
    except Exception as e:
        logger.error(f"NER inference error: {e}")
        return []

    formatted = []
    for ent in entities:
        formatted.append({
            "text": ent.get("word", "").replace("##", ""),
            "label": ent.get("entity_group", ""),
            "score": float(ent.get("score", 0.0)),
            "start": int(ent.get("start", 0)),
            "end": int(ent.get("end", 0)),
        })

    return formatted


# ─── Category extraction (from notebook cell 31) ──────────────────────────────

def extract_category_from_entities(
    entities: list[dict], raw_text: str
) -> tuple[Optional[str], float]:
    """
    Extract document category from ORG entities.
    Returns (category_name, confidence_score).
    """
    org_entities = [e for e in entities if e["label"] == "ORG"]

    category_scores: dict[str, float] = {cat: 0.0 for cat in CATEGORY_MAPPING}

    for org_ent in org_entities:
        org_text = org_ent["text"].upper()
        org_score = org_ent["score"]

        for category, keywords in CATEGORY_MAPPING.items():
            for keyword in keywords:
                if keyword.upper() in org_text or org_text in keyword.upper():
                    category_scores[category] += org_score

    if max(category_scores.values()) > 0:
        best = max(category_scores, key=category_scores.get)
        return best, category_scores[best]

    return None, 0.0


# ─── Date/period parsing (from notebook cell 33) ──────────────────────────────

def _try_parse_short_date(token: str) -> Optional[tuple[str, int]]:
    """Parse OKT24, JUL25 style tokens → (month_name, year)."""
    token = token.strip().lower()
    m = re.match(r"^([a-z]{3,4})(\d{2})$", token)
    if m:
        mon_raw, yy = m.group(1), m.group(2)
        mon = ID_MONTHS.get(mon_raw[:3]) or ID_MONTHS.get(mon_raw)
        if mon:
            return mon, 2000 + int(yy)
    return None


def normalize_date_to_period(text: str) -> Optional[str]:
    """
    Normalize various date formats to 'Bulan Tahun' (e.g., 'Oktober 2024').
    Supports: BL/TH OKT24, Oktober 2024, 10/2024, DD-MM-YYYY, OKT24.
    """
    t = text.strip()

    # Pattern 1: BL/TH format
    m = re.search(r"BL/TH\s*([^\n]+)", t, flags=re.IGNORECASE)
    if m:
        tail = m.group(1)
        for tok in tail.split():
            parsed = _try_parse_short_date(tok)
            if parsed:
                return f"{parsed[0]} {parsed[1]}"

    # Pattern 2: Full month name + year
    m = re.search(
        r"\b(jan(?:uari)?|feb(?:ruari)?|mar(?:et)?|apr(?:il)?|mei|"
        r"jun(?:i)?|jul(?:i)?|ag[ut](?:ustus)?|sep(?:tember)?|"
        r"okt(?:ober)?|nov(?:ember)?|des(?:ember)?)\s+(\d{4})\b",
        t, flags=re.IGNORECASE,
    )
    if m:
        mon = ID_MONTHS.get(m.group(1).lower()[:3]) or ID_MONTHS.get(m.group(1).lower())
        year = int(m.group(2))
        if mon:
            return f"{mon} {year}"

    # Pattern 3: DD-MM-YYYY or DD/MM/YYYY
    m = re.search(r"\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b", t)
    if m:
        mm = int(m.group(2))
        yy = int(m.group(3))
        if yy < 100:
            yy += 2000
        if 1 <= mm <= 12:
            return f"{MONTHS_LIST[mm - 1]} {yy}"

    # Pattern 4: MM/YYYY
    m = re.search(r"\b(\d{1,2})/(\d{4})\b", t)
    if m:
        mm = int(m.group(1))
        yy = int(m.group(2))
        if 1 <= mm <= 12:
            return f"{MONTHS_LIST[mm - 1]} {yy}"

    # Pattern 5: OKT24 standalone
    toks = re.findall(r"\b[A-Za-z]{3,4}\d{2}\b", t)
    for tok in toks:
        parsed = _try_parse_short_date(tok)
        if parsed:
            return f"{parsed[0]} {parsed[1]}"

    return None


def extract_period_from_entities(
    entities: list[dict], raw_text: str
) -> Optional[str]:
    """
    Extract period from NER DATE entities and raw text.
    Priority: 1) NER DATE entities  2) Lines with period keywords  3) Full text
    """
    # Priority 1: NER DATE entities
    dat_spans = [
        e["text"] for e in entities
        if e.get("label", "").upper() in ("DAT", "DATE")
    ]
    for span in dat_spans:
        p = normalize_date_to_period(span)
        if p:
            return p

    # Priority 2: Lines with period keywords
    for line in raw_text.splitlines():
        if re.search(r"\b(periode|bl/th|bulan|bln)\b", line, flags=re.IGNORECASE):
            p = normalize_date_to_period(line)
            if p:
                return p

    # Priority 3: Fallback to full text
    return normalize_date_to_period(raw_text)


# ─── Nominal extraction (from notebook cell 35) ───────────────────────────────

def extract_nominal_from_entities(
    entities: list[dict],
    raw_text: str,
    user_nominal: Optional[int] = None,
) -> Optional[int]:
    """
    Extract nominal amount from MON (Money) entities.
    Uses similarity scoring against user_nominal to pick best candidate.
    """
    exclude_keywords = ["materai", "ppn", "pajak", "diskon", "potongan", "kotor"]

    mon_entities = [e for e in entities if e.get("label", "").upper() == "MON"]

    if not mon_entities:
        return None

    candidates = []

    for mon_ent in mon_entities:
        mon_text = mon_ent["text"]
        mon_score = mon_ent["score"]

        normalized = normalize_rupiah(mon_text)
        if not normalized:
            continue

        # Validate range (1,000 - 50,000,000)
        if not (1000 <= normalized <= 50_000_000):
            continue

        # Check exclude keywords in surrounding context
        try:
            position = raw_text.lower().find(mon_text.lower())

            if position == -1:
                normalized_text = re.sub(r"\s+", " ", mon_text.strip())
                pattern = re.escape(normalized_text).replace(r"\ ", r"\s*")
                match = re.search(pattern, raw_text, re.IGNORECASE)
                if match:
                    position = match.start()

            if position == -1:
                number_only = re.sub(r"[^\d]", "", mon_text)
                if number_only and len(number_only) >= 3:
                    match = re.search(number_only, raw_text)
                    if match:
                        position = match.start()

            if position != -1:
                context_start = max(0, position - 100)
                context = raw_text[context_start:position].lower()
                if any(excl in context for excl in exclude_keywords):
                    continue
        except Exception:
            pass

        # Score candidates
        if user_nominal and user_nominal > 0:
            difference = abs(normalized - user_nominal)
            pct_diff = (difference / user_nominal) * 100

            if pct_diff == 0:
                similarity_score = 10.0
            elif pct_diff <= 1:
                similarity_score = 9.0
            elif pct_diff <= 5:
                similarity_score = 7.0
            elif pct_diff <= 10:
                similarity_score = 5.0
            elif pct_diff <= 20:
                similarity_score = 3.0
            else:
                similarity_score = max(0.1, 10.0 - (pct_diff / 10))

            total_score = mon_score + similarity_score
            candidates.append((normalized, total_score))
        else:
            score = mon_score
            if normalized > 50000:
                score += 0.5
            candidates.append((normalized, score))

    if candidates:
        best = max(candidates, key=lambda x: x[1])
        return best[0]

    return None


# ─── Main orchestrator (from notebook cell 37) ────────────────────────────────

def verify_document_ner(
    ocr_text: str,
    user_kategori: Optional[str] = None,
    user_periode: Optional[str] = None,
    user_nominal: Optional[int] = None,
) -> dict:
    """
    Full NER extraction pipeline.

    Returns dict with keys: kategori, periode, nominal
    matching the format expected by Laravel's MatchingService.
    """
    # Step 0: Preprocess text
    preprocessed = preprocess_text_for_ner(ocr_text)

    # Step 1: Run NER
    entities = extract_entities_with_ner(preprocessed)
    logger.info(f"NER found {len(entities)} entities")

    # Step 2: Extract fields
    kategori, cat_conf = extract_category_from_entities(entities, ocr_text)
    periode = extract_period_from_entities(entities, ocr_text)
    nominal = extract_nominal_from_entities(entities, ocr_text, user_nominal)

    logger.info(
        f"Extracted — kategori: {kategori}, periode: {periode}, nominal: {nominal}"
    )

    return {
        "kategori": kategori,
        "periode": periode,
        "nominal": str(nominal) if nominal is not None else None,
    }
