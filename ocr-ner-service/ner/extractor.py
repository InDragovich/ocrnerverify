"""
NER entity extraction using fine-tuned IndoBERT.

Model: ner_indobert_p2_best (fine-tuned IndoBERT BertForTokenClassification).
Labels: O, B-KATEGORI, I-KATEGORI, B-PERIODE, I-PERIODE, B-NOMINAL, I-NOMINAL.

Logika port dari Notebook_2_Demo (rev2): extract entities → group by label →
normalize per kategori/periode/nominal → return triple.
"""

import os
import re
import logging
from pathlib import Path
from typing import Any, Optional

import torch
from transformers import AutoModelForTokenClassification, AutoTokenizer, pipeline

logger = logging.getLogger(__name__)

# ── Config ───────────────────────────────────────────────────────────────────

_DEFAULT_MODEL_DIR = (Path(__file__).resolve().parent.parent / "models" / "ner_indobert").as_posix()
NER_MODEL_NAME = os.environ.get("NER_MODEL_NAME", _DEFAULT_MODEL_DIR)
NER_MAX_CHARS = int(os.environ.get("NER_MAX_CHARS", "2000"))

# ── Singleton NER pipeline ───────────────────────────────────────────────────

_ner_pipeline = None


def load_model() -> None:
    """Load fine-tuned NER model. Called once at application startup."""
    global _ner_pipeline

    device = 0 if torch.cuda.is_available() else -1
    print(f"[NER] Model:  {NER_MODEL_NAME}")
    print(f"[NER] Device: {'GPU (CUDA)' if device == 0 else 'CPU'}")

    if not Path(NER_MODEL_NAME).exists() and not NER_MODEL_NAME.count("/") == 1:
        raise FileNotFoundError(
            f"NER model tidak ditemukan: {NER_MODEL_NAME}\n"
            "Letakkan file model (config.json, model.safetensors, tokenizer.json, "
            "tokenizer_config.json) di folder tersebut, atau set env "
            "NER_MODEL_NAME ke HuggingFace repo id."
        )

    tokenizer = AutoTokenizer.from_pretrained(NER_MODEL_NAME)
    model = AutoModelForTokenClassification.from_pretrained(NER_MODEL_NAME)

    _ner_pipeline = pipeline(
        "token-classification",
        model=model,
        tokenizer=tokenizer,
        aggregation_strategy="simple",
        device=device,
    )

    # Warm-up
    test = "PT PLN menerbitkan tagihan bulan Oktober 2024 sebesar Rp 200.000"
    result = _ner_pipeline(test)
    print(f"[NER] Loaded. Warm-up: {len(result)} entities detected")


def _get_pipeline():
    if _ner_pipeline is None:
        raise RuntimeError("NER pipeline not initialized. Call load_model() first.")
    return _ner_pipeline


# ── Konstanta normalisasi (port dari Notebook 2) ────────────────────────────

MONTHS_ID = {
    "JANUARI": 1, "JAN": 1,
    "FEBRUARI": 2, "FEB": 2,
    "MARET": 3, "MAR": 3,
    "APRIL": 4, "APR": 4,
    "MEI": 5,
    "JUNI": 6, "JUN": 6,
    "JULI": 7, "JUL": 7,
    "AGUSTUS": 8, "AGU": 8, "AGS": 8, "AUG": 8,
    "SEPTEMBER": 9, "SEP": 9, "SEPT": 9,
    "OKTOBER": 10, "OKOTBER": 10, "OKT": 10, "OCT": 10,
    "NOVEMBER": 11, "NOV": 11,
    "DESEMBER": 12, "DES": 12, "DEC": 12,
}

MONTH_NAMES = {
    1: "Januari", 2: "Februari", 3: "Maret", 4: "April",
    5: "Mei", 6: "Juni", 7: "Juli", 8: "Agustus",
    9: "September", 10: "Oktober", 11: "November", 12: "Desember",
}

VALID_PERIOD_YEAR_RANGE = (2020, 2027)

CATEGORY_PATTERNS = {
    "Listrik": [
        r"PERUSAHAAN LISTRIK NEGARA",
        r"PT PLN",
        r"TAGIHAN LISTRIK",
        r"PLN",
        r"LISTRIK",
    ],
    "Telepon": [
        r"TELKOM",
        r"HANDPHONE",
        r"TELEPON",
        r"TELP",
        r"XL",
        r"AXIS",
    ],
    "Air dan Gas": [
        r"PDAM[^\n]{0,40}",
        r"TAGIHAN AIR",
        r"AIR",
        r"LPG",
        r"GALON",
        r"GAS",
    ],
}


# ── Helper: text cleaning ───────────────────────────────────────────────────


def _clean_ocr_text(text: str) -> str:
    text = str(text or "")
    text = text.replace(" ", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# ── Normalisasi: kategori, periode, nominal ─────────────────────────────────


def _normalize_rupiah(value: Any) -> Optional[int]:
    """Ekstrak digit saja dari string nominal."""
    if value is None:
        return None
    digits = re.sub(r"\D", "", str(value))
    return int(digits) if digits else None


def _valid_year(year: int) -> bool:
    return VALID_PERIOD_YEAR_RANGE[0] <= year <= VALID_PERIOD_YEAR_RANGE[1]


def _normalize_year(year_text: str) -> Optional[int]:
    year_text = str(year_text)
    if len(year_text) == 2:
        year = 2000 + int(year_text)
    else:
        year = int(year_text)
    return year if _valid_year(year) else None


def _normalize_period(value: Any) -> Optional[str]:
    """Rapikan ke format 'Bulan YYYY' (e.g. 'Oktober 2024')."""
    text = str(value or "").strip()
    if not text:
        return None
    upper = text.upper().replace("OKOTBER", "OKTOBER")

    sep = r"\s*[-/.]\s*"
    numeric_patterns = [
        rf"\b\d{{1,2}}{sep}(\d{{1,2}}){sep}(\d{{2,4}})\b",
        rf"\b(\d{{1,2}}){sep}(\d{{2,4}})\b",
    ]
    for pattern in numeric_patterns:
        for match in re.finditer(pattern, upper):
            month = int(match.group(1))
            year = _normalize_year(match.group(2))
            if 1 <= month <= 12 and year:
                return f"{MONTH_NAMES[month]} {year}"

    month_regex = "|".join(sorted(MONTHS_ID.keys(), key=len, reverse=True))
    for match in re.finditer(rf"\b({month_regex})\s*[-/]?\s*(\d{{2,4}})\b", upper):
        month = MONTHS_ID.get(match.group(1))
        year = _normalize_year(match.group(2))
        if month and year:
            return f"{MONTH_NAMES[month]} {year}"
    return None


def _map_category_from_text(value: Any) -> Optional[str]:
    text = str(value or "")
    if not text.strip():
        return None
    for category, patterns in CATEGORY_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, text, flags=re.IGNORECASE):
                return category
    return None


def _choose_first_valid_period(candidates: list[str]) -> Optional[str]:
    for candidate in candidates:
        normalized = _normalize_period(candidate)
        if normalized:
            return normalized
    return None


def _choose_largest_nominal(candidates: list[str]) -> Optional[int]:
    """Pilih nominal terbesar (biasanya = total bayar, bukan sub-item)."""
    values = [_normalize_rupiah(c) for c in candidates]
    values = [v for v in values if v is not None]
    return max(values) if values else None


# ── NER inference + post-processing ─────────────────────────────────────────


def _extract_entities(text: str) -> list[dict]:
    """Jalankan pipeline NER pada teks bersih."""
    ner = _get_pipeline()
    cleaned = _clean_ocr_text(text)
    chunk = cleaned[:NER_MAX_CHARS]  # IndoBERT 512-token limit; ~2000 char aman

    try:
        entities = ner(chunk)
    except Exception as e:
        logger.error(f"NER inference error: {e}")
        return []

    formatted = []
    for ent in entities:
        token_text = str(ent.get("word", "")).replace("##", "").strip()
        if not token_text:
            continue
        formatted.append({
            "text": token_text,
            "label": str(ent.get("entity_group", "")).upper(),
            "score": float(ent.get("score", 0.0)),
        })
    return formatted


def _post_process(entities: list[dict]) -> dict:
    """Kelompokkan per label lalu pilih kandidat final per entitas."""
    grouped = {"KATEGORI": [], "PERIODE": [], "NOMINAL": []}
    for ent in entities:
        label = ent["label"]
        value = ent["text"]
        if label in grouped and value:
            grouped[label].append(value)

    # Kategori: ambil yang pertama bisa di-map ke salah satu kategori valid.
    kategori_final = None
    for candidate in grouped["KATEGORI"]:
        kategori_final = _map_category_from_text(candidate)
        if kategori_final:
            break

    periode_final = _choose_first_valid_period(grouped["PERIODE"])
    nominal_final = _choose_largest_nominal(grouped["NOMINAL"])

    return {
        "kategori_final": kategori_final,
        "periode_final": periode_final,
        "nominal_final": nominal_final,
        "kategori_candidates": grouped["KATEGORI"],
        "periode_candidates": grouped["PERIODE"],
        "nominal_candidates": grouped["NOMINAL"],
    }


# ── Public entrypoint ───────────────────────────────────────────────────────


def verify_document_ner(
    ocr_text: str,
    user_kategori: Optional[str] = None,
    user_periode: Optional[str] = None,
    user_nominal: Optional[int] = None,
) -> dict:
    """
    Pipeline NER penuh.

    Args:
        ocr_text: Teks hasil OCR (dari modul OCR).
        user_kategori/periode/nominal: Tidak dipakai oleh model fine-tuned —
            disisakan untuk backward-compat dengan caller lama.

    Returns:
        Dict: kategori, periode, nominal (semua string atau None).
    """
    entities = _extract_entities(ocr_text)
    logger.info(f"NER found {len(entities)} entities")

    result = _post_process(entities)

    kategori = result["kategori_final"]
    periode = result["periode_final"]
    nominal = result["nominal_final"]

    logger.info(f"Extracted -- kategori: {kategori}, periode: {periode}, nominal: {nominal}")

    return {
        "kategori": kategori,
        "periode": periode,
        "nominal": str(nominal) if nominal is not None else None,
    }
