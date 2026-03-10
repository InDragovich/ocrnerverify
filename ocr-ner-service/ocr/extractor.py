"""
OCR text extraction with image preprocessing.
Auto-detects Tesseract and Poppler paths.
"""

import io
import os
import re
import glob
import shutil
import logging

import cv2
import numpy as np
import pytesseract
from pdf2image import convert_from_bytes
from PIL import Image

logger = logging.getLogger(__name__)

# ── Auto-detect Tesseract & Poppler ──────────────────────────────────────────


def _find_tesseract() -> str:
    """Find Tesseract executable. Checks: env var -> PATH -> common Windows paths."""
    env = os.environ.get("TESSERACT_CMD")
    if env and os.path.isfile(env):
        return env
    found = shutil.which("tesseract")
    if found:
        return found
    for path in [
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    ]:
        if os.path.isfile(path):
            return path
    return "tesseract"


def _find_poppler() -> str | None:
    """Find Poppler bin dir. Checks: env var -> PATH -> common Windows paths."""
    env = os.environ.get("POPPLER_PATH")
    if env and os.path.isdir(env):
        return env
    if shutil.which("pdftoppm"):
        return None  # already in system PATH
    for pattern in [
        r"C:\Program Files\poppler-*\Library\bin",
        r"C:\Program Files\poppler-*\bin",
        r"C:\Program Files (x86)\poppler-*\Library\bin",
    ]:
        matches = glob.glob(pattern)
        if matches:
            return sorted(matches)[-1]
    return None


TESSERACT_CMD = _find_tesseract()
POPPLER_PATH = _find_poppler()
OCR_DPI = int(os.environ.get("OCR_DPI", "300"))
OCR_LANG = os.environ.get("OCR_LANG", "ind+eng")
TESSERACT_CONFIG = "--oem 3 --psm 3"

pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD

print(f"[OCR] Tesseract: {TESSERACT_CMD}")
print(f"[OCR] Poppler:   {POPPLER_PATH or 'system PATH'}")


# ── Image preprocessing ─────────────────────────────────────────────────────


def _correct_orientation(img: np.ndarray) -> np.ndarray:
    """Detect and correct page rotation using Tesseract OSD."""
    try:
        pil_img = Image.fromarray(img)
        osd = pytesseract.image_to_osd(pil_img)

        rotation_angle = 0
        rotation_conf = 0.0
        for line in osd.split("\n"):
            if "Rotate:" in line:
                rotation_angle = int(line.split(":")[-1].strip())
            if "Orientation confidence:" in line:
                rotation_conf = float(line.split(":")[-1].strip())

        if rotation_angle != 0 and rotation_conf > 1.0:
            pil_img = pil_img.rotate(rotation_angle, expand=True, fillcolor=(255, 255, 255))
            return np.array(pil_img)
    except pytesseract.TesseractError:
        pass

    # Fallback: check if image is upside down (180 rotation)
    try:
        h, w = img.shape[:2]
        center_crop = img[h // 4 : 3 * h // 4, w // 4 : 3 * w // 4]

        data_normal = pytesseract.image_to_data(
            Image.fromarray(center_crop),
            lang=OCR_LANG,
            config="--psm 6 --oem 3",
            output_type=pytesseract.Output.DICT,
        )
        conf_normal = [int(c) for c in data_normal["conf"] if int(c) > 0]
        avg_conf_normal = sum(conf_normal) / len(conf_normal) if conf_normal else 0

        rotated_180 = np.rot90(img, 2)
        center_crop_180 = rotated_180[h // 4 : 3 * h // 4, w // 4 : 3 * w // 4]
        data_rotated = pytesseract.image_to_data(
            Image.fromarray(center_crop_180),
            lang=OCR_LANG,
            config="--psm 6 --oem 3",
            output_type=pytesseract.Output.DICT,
        )
        conf_rotated = [int(c) for c in data_rotated["conf"] if int(c) > 0]
        avg_conf_rotated = sum(conf_rotated) / len(conf_rotated) if conf_rotated else 0

        if avg_conf_rotated > avg_conf_normal + 5:
            return rotated_180
    except Exception:
        pass

    return img


def _to_grayscale(img: np.ndarray) -> np.ndarray:
    if len(img.shape) == 3:
        return cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    return img


def _adaptive_denoise(img: np.ndarray) -> np.ndarray:
    """Adaptive noise removal based on Laplacian variance."""
    noise_level = cv2.Laplacian(img, cv2.CV_64F).var()
    if noise_level > 1500:
        return cv2.GaussianBlur(img, (5, 5), 0)
    elif noise_level > 500:
        return cv2.GaussianBlur(img, (3, 3), 0)
    return img


def _preprocess(img: np.ndarray) -> np.ndarray:
    """Full pipeline: orientation -> grayscale -> denoise."""
    img = _correct_orientation(img)
    img = _to_grayscale(img)
    img = _adaptive_denoise(img)
    return img


# ── OCR extraction ──────────────────────────────────────────────────────────


def _clean_garbage_lines(text: str) -> str:
    """Remove lines that are likely OCR garbage (watermarks, stamps, artifacts)."""
    lines = text.split("\n")
    cleaned = []

    for line in lines:
        stripped = line.strip()

        if not stripped:
            cleaned.append(line)
            continue

        is_garbage = False

        # Very short non-digit lines
        if len(stripped) <= 2 and not stripped.isdigit():
            is_garbage = True

        # Low alphanumeric ratio
        if not is_garbage and len(stripped) > 0:
            alnum_count = sum(1 for c in stripped if c.isalnum())
            alnum_ratio = alnum_count / len(stripped)
            if alnum_ratio < 0.4 and len(stripped) < 20:
                is_garbage = True

        # Too many single-character words
        if not is_garbage:
            words = stripped.split()
            if len(words) >= 3:
                single_char_count = sum(1 for w in words if len(w) == 1)
                single_char_ratio = single_char_count / len(words)
                if single_char_ratio > 0.6 and len(stripped) < 30:
                    is_garbage = True

        if not is_garbage:
            cleaned.append(line)

    result = "\n".join(cleaned)
    result = re.sub(r"\n{3,}", "\n\n", result)
    return result.strip()


def extract_text_from_file(file_bytes: bytes, filename: str) -> str:
    """Extract OCR text from a PDF or image file."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    pages_text = []

    if ext == "pdf":
        logger.info(f"Converting PDF to images (DPI={OCR_DPI})...")
        pil_images = convert_from_bytes(
            file_bytes,
            dpi=OCR_DPI,
            poppler_path=POPPLER_PATH,
        )
        logger.info(f"PDF has {len(pil_images)} page(s)")

        for i, pil_img in enumerate(pil_images):
            img_np = np.array(pil_img.convert("RGB"))
            processed = _preprocess(img_np)
            text = pytesseract.image_to_string(
                Image.fromarray(processed), lang=OCR_LANG, config=TESSERACT_CONFIG
            )
            pages_text.append(text)
            logger.debug(f"Page {i + 1}: extracted {len(text)} chars")
    else:
        pil_img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
        img_np = np.array(pil_img)
        processed = _preprocess(img_np)
        text = pytesseract.image_to_string(
            Image.fromarray(processed), lang=OCR_LANG, config=TESSERACT_CONFIG
        )
        pages_text.append(text)

    raw_text = "\n".join(pages_text)
    cleaned = _clean_garbage_lines(raw_text)
    logger.info(f"OCR complete: {len(raw_text)} chars raw -> {len(cleaned)} chars cleaned")
    return cleaned
