"""
ocrnerverify OCR-NER Microservice

Setup: pip install -r requirements.txt
Run:   python main.py
"""

import os
import re
import time
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ocr.extractor import extract_text_from_file
from ner.extractor import load_model, verify_document_ner

# ── Config (override via env vars, no .env file needed) ──────────────────────

HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "5001"))
MAX_FILE_SIZE_MB = int(os.environ.get("MAX_FILE_SIZE_MB", "10"))
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")

logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {"pdf", "jpg", "jpeg", "png"}
MAX_FILE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024


# ── Schemas ──────────────────────────────────────────────────────────────────

class EntitiesSchema(BaseModel):
    kategori: Optional[str] = None
    periode: Optional[str] = None
    nominal: Optional[str] = None


class OcrOutputSchema(BaseModel):
    """Output modul OCR sesuai Tabel IV-10 — input untuk NER."""
    nama_dokumen: str
    metode_ekstraksi: str  # "OCR" | "Teks PDF"
    teks_ekstraksi: str
    waktu_pemrosesan: float  # detik


class OcrNerResponse(BaseModel):
    # Field utama
    text_ocr: str            # = ocr.teks_ekstraksi (alias backward-compat)
    entities: EntitiesSchema
    status: str              # "success" | "partial_success" | "failed"
    error_message: Optional[str] = None
    # Detail modul OCR
    ocr: Optional[OcrOutputSchema] = None
    waktu_total: Optional[float] = None  # detik, OCR + NER


# ── FastAPI app ──────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting OCR-NER service...")
    load_model()
    logger.info("OCR-NER service ready!")
    yield
    logger.info("Shutting down OCR-NER service.")


app = FastAPI(
    title="ocrnerverify OCR-NER Service",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://localhost:5173"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/extract", response_model=OcrNerResponse)
async def extract(
    file_lampiran: UploadFile = File(...),
    kategori: Optional[str] = Form(None),
    periode: Optional[str] = Form(None),
    nominal: Optional[str] = Form(None),
):
    filename = file_lampiran.filename or ""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=422,
            detail=f"Tipe file tidak didukung: .{ext}. Didukung: {SUPPORTED_EXTENSIONS}",
        )

    file_bytes = await file_lampiran.read()

    if len(file_bytes) > MAX_FILE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File terlalu besar. Maksimal {MAX_FILE_SIZE_MB}MB.",
        )

    logger.info(f"Processing: {filename} ({len(file_bytes)} bytes)")

    t_start = time.perf_counter()

    # ── Phase 1: OCR ─────────────────────────────────────────────────────
    try:
        ocr_result = extract_text_from_file(file_bytes, filename, kategori=kategori)
    except Exception as e:
        logger.exception("OCR phase failed")
        return OcrNerResponse(
            text_ocr="",
            entities=EntitiesSchema(),
            status="failed",
            error_message=f"OCR gagal: {str(e)}",
            waktu_total=round(time.perf_counter() - t_start, 3),
        )

    text_ocr = ocr_result["teks_ekstraksi"]
    ocr_schema = OcrOutputSchema(**ocr_result)

    if not text_ocr.strip():
        return OcrNerResponse(
            text_ocr="",
            entities=EntitiesSchema(),
            status="failed",
            error_message="Tidak ada teks yang dapat diekstrak dari dokumen.",
            ocr=ocr_schema,
            waktu_total=round(time.perf_counter() - t_start, 3),
        )

    # ── Phase 2: NER ─────────────────────────────────────────────────────
    try:
        user_nominal_int = None
        if nominal:
            cleaned = re.sub(r"[^\d]", "", nominal)
            user_nominal_int = int(cleaned) if cleaned else None

        entities_dict = verify_document_ner(
            ocr_text=text_ocr,
            user_kategori=kategori,
            user_periode=periode,
            user_nominal=user_nominal_int,
        )
    except Exception as e:
        logger.exception("NER phase failed")
        return OcrNerResponse(
            text_ocr=text_ocr,
            entities=EntitiesSchema(),
            status="partial_success",
            error_message=f"NER gagal: {str(e)}",
            ocr=ocr_schema,
            waktu_total=round(time.perf_counter() - t_start, 3),
        )

    # ── Determine status ─────────────────────────────────────────────────
    null_count = sum(1 for v in entities_dict.values() if v is None)

    if null_count == 0:
        status = "success"
        error_message = None
    elif null_count < 3:
        missing = [k for k, v in entities_dict.items() if v is None]
        status = "partial_success"
        error_message = f"Entity tidak terdeteksi: {', '.join(missing)}"
    else:
        status = "partial_success"
        error_message = "Semua entitas tidak terdeteksi oleh NER"

    logger.info(f"Result: status={status}, entities={entities_dict}")

    return OcrNerResponse(
        text_ocr=text_ocr,
        entities=EntitiesSchema(**entities_dict),
        status=status,
        error_message=error_message,
        ocr=ocr_schema,
        waktu_total=round(time.perf_counter() - t_start, 3),
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
