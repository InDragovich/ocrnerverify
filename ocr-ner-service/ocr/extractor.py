"""
OCR text extraction from PDF/image files.
Ported from Colab notebook cells 8, 14, 16.
"""

import io
import re
import logging

import cv2
import numpy as np
import pytesseract
from pdf2image import convert_from_bytes
from PIL import Image

from config import settings
from ocr.preprocessor import preprocess

pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd

logger = logging.getLogger(__name__)

TESSERACT_CONFIG = "--oem 3 --psm 3"


def _pil_to_numpy(pil_img: Image.Image) -> np.ndarray:
    """Convert PIL Image (RGB) to numpy array."""
    return np.array(pil_img.convert("RGB"))


def _clean_garbage_lines(text: str) -> str:
    """
    Remove lines that are likely OCR garbage (watermarks, stamps, artifacts).
    Ported from notebook cell 14.

    Criteria:
    1. Very short lines (<=2 chars) that aren't digits
    2. Lines with too-low alphanumeric ratio (<40%)
    3. Lines with too many single-char words (>60%)
    """
    lines = text.split("\n")
    cleaned = []

    for line in lines:
        stripped = line.strip()

        if not stripped:
            cleaned.append(line)
            continue

        is_garbage = False

        # Check 1: Very short non-digit lines
        if len(stripped) <= 2 and not stripped.isdigit():
            is_garbage = True

        # Check 2: Low alphanumeric ratio
        if not is_garbage and len(stripped) > 0:
            alnum_count = sum(1 for c in stripped if c.isalnum())
            alnum_ratio = alnum_count / len(stripped)
            if alnum_ratio < 0.4 and len(stripped) < 20:
                is_garbage = True

        # Check 3: Too many single-character words
        if not is_garbage:
            words = stripped.split()
            if len(words) >= 3:
                single_char_count = sum(1 for w in words if len(w) == 1)
                single_char_ratio = single_char_count / len(words)
                if single_char_ratio > 0.6 and len(stripped) < 30:
                    is_garbage = True

        if not is_garbage:
            cleaned.append(line)

    # Clean up excessive whitespace
    result = "\n".join(cleaned)
    result = re.sub(r"\n{3,}", "\n\n", result)
    return result.strip()


def extract_text_from_file(file_bytes: bytes, filename: str) -> str:
    """
    Extract OCR text from a PDF or image file.

    Args:
        file_bytes: Raw file content
        filename: Original filename (used to determine format)

    Returns:
        Cleaned OCR text string
    """
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    lang = settings.ocr_lang
    pages_text = []

    if ext == "pdf":
        logger.info(f"Converting PDF to images (DPI={settings.ocr_dpi})...")
        pil_images = convert_from_bytes(
            file_bytes,
            dpi=settings.ocr_dpi,
            poppler_path=settings.poppler_path,
        )
        logger.info(f"PDF has {len(pil_images)} page(s)")

        for i, pil_img in enumerate(pil_images):
            img_np = _pil_to_numpy(pil_img)
            processed = preprocess(img_np)
            pil_processed = Image.fromarray(processed)
            text = pytesseract.image_to_string(
                pil_processed, lang=lang, config=TESSERACT_CONFIG
            )
            pages_text.append(text)
            logger.debug(f"Page {i + 1}: extracted {len(text)} chars")
    else:
        # Image file (PNG, JPG, JPEG)
        pil_img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
        img_np = _pil_to_numpy(pil_img)
        processed = preprocess(img_np)
        pil_processed = Image.fromarray(processed)
        text = pytesseract.image_to_string(
            pil_processed, lang=lang, config=TESSERACT_CONFIG
        )
        pages_text.append(text)

    raw_text = "\n".join(pages_text)
    cleaned = _clean_garbage_lines(raw_text)

    logger.info(f"OCR complete: {len(raw_text)} chars raw → {len(cleaned)} chars cleaned")
    return cleaned
