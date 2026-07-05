"""
OCR text extraction pipeline — ported from PytesseractOCR_with_Testing.ipynb.

Pipeline: Konversi → OSD → Skew → Grayscale → Resize (adaptive) →
Black Top-Hat (kernel tunggal 25) → Otsu → Tesseract (PSM dinamis,
fallback PSM 3, confidence + whitelist filter) → Post-processing whitespace.

PDF text-extractable (PDF Digital) di-bypass: ekstrak langsung via pdftotext.
"""

import io
import os
import re
import glob
import time
import string
import shutil
import logging
import tempfile
import subprocess

import cv2
import numpy as np
import pytesseract
from pdf2image import convert_from_bytes
from PIL import Image

logger = logging.getLogger(__name__)

# ── Auto-detect Tesseract & Poppler ──────────────────────────────────────────


def _find_tesseract() -> str:
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
    env = os.environ.get("POPPLER_PATH")
    if env and os.path.isdir(env):
        return env
    if shutil.which("pdftoppm"):
        return None
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
pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD

print(f"[OCR] Tesseract: {TESSERACT_CMD}")
print(f"[OCR] Poppler:   {POPPLER_PATH or 'system PATH'}")

# ── Konstanta global (sinkron dengan notebook) ──────────────────────────────

PDF_DPI = int(os.environ.get("OCR_DPI", "300"))
IMAGE_DPI = 150
TESSERACT_LANG = os.environ.get("OCR_LANG", "ind+eng")
TESSERACT_LANG_PROBE = "ind"
TESSERACT_OEM = 3

CATEGORY_PSM: dict[str, int] = {
    "listrik": 4,
    "air": 3,
    "telepon": 4,
}
PSM_DEFAULT = 3
OSD_FALLBACK_PSM = 6

# OCR filter (closed-world whitelist berbasis audit ground truth 42 dokumen)
OCR_MIN_ALNUM = 100
OCR_TOKEN_CONF_MIN = 50
OCR_CHAR_WHITELIST = frozenset(
    string.ascii_letters       # A-Za-z
    + string.digits            # 0-9
    + " \n\t"                  # whitespace
    + ".,:-/()"                # 7 punctuation struktural (universal di GT)
    + '"'                      # double quote ASCII
    + "&"                      # ampersand: "POS & GIRO"
    + "³"                      # superscript 3: M³ untuk struk air PAB
)
# Pre-normalisasi curly quotes -> ASCII sebelum scrub whitelist.
SMART_QUOTE_MAP = str.maketrans({
    "“": '"', "”": '"',   # “ ” -> "
    "‘": "'", "’": "'",   # ‘ ’ -> '
})

# Orientation / skew
OSD_MIN_CONFIDENCE = 2.0
ROTATION_CONF_DIFF = 10
SKEW_MIN_ANGLE = 1.0
SKEW_MAX_ANGLE = 15.0

# PDF Digital threshold
PDF_DIGITAL_TEXT_THRESHOLD = 50

# Resize
TARGET_CHAR_HEIGHT_PX = 30
MIN_CHAR_HEIGHT_PX = 25
H_CHAR_MARGINAL_MIN = 15
MAX_UPSCALE_FACTOR = 3.0
RESIZE_PROBE_PSM = 6
RESIZE_PROBE_CONF_MIN = 40
HIGH_LAP_VAR_THRESHOLD = 1000.0

# Black Top-Hat — kernel tunggal (ablation eval_2026-06-27_152109: k=25
# rata-rata CER terendah pada 24 dokumen). Adaptive resize sudah menormalkan
# tinggi karakter ~30 px, jadi kernel tunggal cukup.
TOPHAT_KERNEL = 25


# ── Category detection ──────────────────────────────────────────────────────


def detect_category(filename: str) -> str:
    fname = filename.lower()
    if "listrik" in fname:
        return "listrik"
    if "air" in fname or "gas" in fname:
        return "air"
    if "telpon" in fname or "telepon" in fname:
        return "telepon"
    return "unknown"


def _normalize_kategori(kategori: str | None) -> str:
    if not kategori:
        return "unknown"
    k = kategori.strip().lower()
    if "listrik" in k:
        return "listrik"
    if "air" in k or "gas" in k or "pdam" in k:
        return "air"
    if "tel" in k:
        return "telepon"
    return "unknown"


# ── PDF Digital detection (pdftotext) ───────────────────────────────────────


def _pdftotext_bin() -> str | None:
    if POPPLER_PATH:
        candidate = os.path.join(POPPLER_PATH, "pdftotext.exe")
        if os.path.isfile(candidate):
            return candidate
        candidate = os.path.join(POPPLER_PATH, "pdftotext")
        if os.path.isfile(candidate):
            return candidate
    return shutil.which("pdftotext")


def _extract_pdf_digital(file_bytes: bytes) -> str | None:
    """Coba ekstrak teks via pdftotext. Return None jika bukan PDF Digital."""
    bin_path = _pdftotext_bin()
    if not bin_path:
        return None
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name
    try:
        out = subprocess.check_output(
            [bin_path, "-raw", tmp_path, "-"],
            stderr=subprocess.DEVNULL,
            timeout=30,
        )
        text = out.decode("utf-8", errors="replace").strip()
        if len(text) > PDF_DIGITAL_TEXT_THRESHOLD:
            return text
        return None
    except Exception as e:
        logger.warning(f"pdftotext gagal: {e}")
        return None
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


# ── Orientation + Skew correction ───────────────────────────────────────────


def _correct_orientation_and_skew(pil_img: Image.Image, dpi: int) -> Image.Image:
    rotation_applied = False
    rotation_angle = 0
    rotation_conf = 0.0
    osd_err = None

    # OSD: deteksi rotasi dari Tesseract
    try:
        osd = pytesseract.image_to_osd(pil_img)
        for line in osd.split("\n"):
            if "Rotate:" in line:
                rotation_angle = int(line.split(":")[-1].strip())
            if "Orientation confidence:" in line:
                rotation_conf = float(line.split(":")[-1].strip())
    except pytesseract.TesseractError as e:
        osd_err = str(e)

    if osd_err is None and rotation_angle != 0 and rotation_conf > OSD_MIN_CONFIDENCE:
        pil_img = pil_img.rotate(-rotation_angle, expand=True, fillcolor=(255, 255, 255))
        rotation_applied = True

    # Fallback: bandingkan confidence normal vs 180°
    osd_trusted_zero = (
        osd_err is None and rotation_angle == 0 and rotation_conf > OSD_MIN_CONFIDENCE
    )
    if not rotation_applied and not osd_trusted_zero:
        try:
            img_np_temp = np.array(pil_img)
            h, w = img_np_temp.shape[:2]
            center_crop = img_np_temp[h // 4 : 3 * h // 4, w // 4 : 3 * w // 4]

            data_normal = pytesseract.image_to_data(
                Image.fromarray(center_crop),
                lang=TESSERACT_LANG,
                config=f"--psm {OSD_FALLBACK_PSM} --oem {TESSERACT_OEM} --dpi {dpi}",
                output_type=pytesseract.Output.DICT,
            )
            conf_normal = [int(c) for c in data_normal["conf"] if int(c) > 0]
            avg_conf_normal = sum(conf_normal) / len(conf_normal) if conf_normal else 0

            rotated_180 = np.rot90(img_np_temp, 2)
            center_crop_180 = rotated_180[h // 4 : 3 * h // 4, w // 4 : 3 * w // 4]
            data_rotated = pytesseract.image_to_data(
                Image.fromarray(center_crop_180),
                lang=TESSERACT_LANG,
                config=f"--psm {OSD_FALLBACK_PSM} --oem {TESSERACT_OEM} --dpi {dpi}",
                output_type=pytesseract.Output.DICT,
            )
            conf_rotated = [int(c) for c in data_rotated["conf"] if int(c) > 0]
            avg_conf_rotated = sum(conf_rotated) / len(conf_rotated) if conf_rotated else 0

            if avg_conf_rotated > avg_conf_normal + ROTATION_CONF_DIFF:
                pil_img = Image.fromarray(rotated_180)
        except Exception:
            pass

    # Skew correction via projection profile
    img_np = np.array(pil_img)
    gray_temp = (
        cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY) if len(img_np.shape) == 3 else img_np
    )
    _, binary = cv2.threshold(
        gray_temp, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
    )

    h_b, w_b = binary.shape
    small = cv2.resize(binary, (w_b // 4, h_b // 4), interpolation=cv2.INTER_NEAREST)
    sh, sw = small.shape

    best_angle = 0.0
    best_score = float(small.sum(axis=1).var())
    for a in np.arange(-SKEW_MAX_ANGLE, SKEW_MAX_ANGLE + 0.5, 0.5):
        if a == 0:
            continue
        M_skew = cv2.getRotationMatrix2D((sw / 2, sh / 2), float(a), 1.0)
        rotated = cv2.warpAffine(
            small, M_skew, (sw, sh),
            flags=cv2.INTER_NEAREST,
            borderMode=cv2.BORDER_CONSTANT,
            borderValue=0,
        )
        score = float(rotated.sum(axis=1).var())
        if score > best_score:
            best_score = score
            best_angle = float(a)

    if abs(best_angle) >= SKEW_MIN_ANGLE:
        h, w = img_np.shape[:2]
        M = cv2.getRotationMatrix2D((w // 2, h // 2), best_angle, 1.0)
        border = (255, 255, 255) if len(img_np.shape) == 3 else 255
        img_np = cv2.warpAffine(
            img_np, M, (w, h),
            flags=cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_CONSTANT,
            borderValue=border,
        )
        pil_img = Image.fromarray(img_np)

    return pil_img


# ── Adaptive resize ─────────────────────────────────────────────────────────


def _estimate_char_height(img_gray: np.ndarray) -> float:
    try:
        data = pytesseract.image_to_data(
            img_gray,
            lang=TESSERACT_LANG_PROBE,
            config=f"--psm {RESIZE_PROBE_PSM} --oem {TESSERACT_OEM}",
            output_type=pytesseract.Output.DICT,
        )
    except pytesseract.TesseractError:
        return 0.0
    heights = [
        h
        for h, c, t in zip(data["height"], data["conf"], data["text"])
        if str(c).strip() not in ("", "-1")
        and int(float(c)) >= RESIZE_PROBE_CONF_MIN
        and t.strip()
    ]
    return float(np.median(heights)) if heights else 0.0


def _adaptive_resize(img_gray: np.ndarray) -> np.ndarray:
    h_char = _estimate_char_height(img_gray)
    if h_char <= 0:
        return img_gray
    if h_char >= MIN_CHAR_HEIGHT_PX:
        return img_gray
    lap_var = float(cv2.Laplacian(img_gray, cv2.CV_64F).var())
    if h_char >= H_CHAR_MARGINAL_MIN and lap_var > HIGH_LAP_VAR_THRESHOLD:
        return img_gray
    factor = min(TARGET_CHAR_HEIGHT_PX / h_char, MAX_UPSCALE_FACTOR)
    new_w = int(img_gray.shape[1] * factor)
    new_h = int(img_gray.shape[0] * factor)
    return cv2.resize(img_gray, (new_w, new_h), interpolation=cv2.INTER_CUBIC)


# ── Watermark suppression (Black Top-Hat) ───────────────────────────────────


def _suppress_watermark_blackhat(gray: np.ndarray) -> np.ndarray:
    """Tekan watermark/background gelap besar via morphological closing.

    Closing dengan kernel besar mengisi stroke teks tipis tetapi
    mempertahankan watermark besar. Selisih (background - gray)
    menghasilkan citra dengan watermark ditekan; di-invert agar
    teks tetap gelap (foreground = hitam). Residue-floor threshold
    sengaja tidak dipakai supaya Otsu bekerja pada distribusi alami.
    """
    kernel = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE, (TOPHAT_KERNEL, TOPHAT_KERNEL)
    )
    background = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, kernel)
    diff = cv2.subtract(background, gray)
    return cv2.bitwise_not(diff)


# ── Tesseract extraction + confidence filter ────────────────────────────────


def _ocr_with_conf_filter(img: np.ndarray, lang: str, config: str) -> str:
    """OCR + normalisasi + scrub whitelist + drop token simbol low-confidence.

    Pipeline per token:
      1. Normalisasi smart-quote (curly) -> ASCII via SMART_QUOTE_MAP.
      2. Scrub karakter di luar OCR_CHAR_WHITELIST (closed-world dari GT).
      3. Drop token non-alnum dengan conf < OCR_TOKEN_CONF_MIN.
      4. Susun ulang baris berdasarkan (block_num, par_num, line_num).
    """
    data = pytesseract.image_to_data(
        img, lang=lang, config=config, output_type=pytesseract.Output.DICT
    )
    lines: dict[tuple[int, int, int], list[str]] = {}
    for i_t, raw in enumerate(data["text"]):
        normalized = raw.strip().translate(SMART_QUOTE_MAP)
        token = "".join(c for c in normalized if c in OCR_CHAR_WHITELIST)
        if not token:
            continue
        try:
            conf = float(data["conf"][i_t])
        except (TypeError, ValueError):
            conf = -1.0
        has_alnum = any(c.isalnum() for c in token)
        if not has_alnum and conf < OCR_TOKEN_CONF_MIN:
            continue
        key = (data["block_num"][i_t], data["par_num"][i_t], data["line_num"][i_t])
        lines.setdefault(key, []).append(token)
    return "\n".join(" ".join(lines[k]) for k in sorted(lines.keys()))


def _extract_text_tesseract(img: np.ndarray, psm: int, dpi: int) -> str:
    """OCR dengan PSM dinamis + fallback PSM 3 berbasis count alnum."""
    config_primary = f"--psm {psm} --oem {TESSERACT_OEM} --dpi {dpi}"
    config_fallback = f"--psm {PSM_DEFAULT} --oem {TESSERACT_OEM} --dpi {dpi}"

    text = _ocr_with_conf_filter(img, TESSERACT_LANG, config_primary)
    if sum(c.isalnum() for c in text) < OCR_MIN_ALNUM:
        text_alt = _ocr_with_conf_filter(img, TESSERACT_LANG, config_fallback)
        if sum(c.isalnum() for c in text_alt) > sum(c.isalnum() for c in text):
            text = text_alt
    return text


# ── Full per-page pipeline ──────────────────────────────────────────────────


def _process_page(pil_img: Image.Image, psm: int, dpi: int) -> str:
    pil_img = _correct_orientation_and_skew(pil_img, dpi)

    img_np = np.array(pil_img)
    if len(img_np.shape) == 3:
        gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
    else:
        gray = img_np

    gray = _adaptive_resize(gray)
    gray = _suppress_watermark_blackhat(gray)
    _, binarized = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    return _extract_text_tesseract(binarized, psm=psm, dpi=dpi)


# ── Post-processing whitespace ──────────────────────────────────────────────


def _normalize_whitespace(text: str) -> str:
    text = re.sub(r" +", " ", text)
    text = re.sub(r" +\n", "\n", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text)
    return text.strip()


# ── Public entrypoint ───────────────────────────────────────────────────────


def extract_text_from_file(
    file_bytes: bytes,
    filename: str,
    kategori: str | None = None,
) -> dict:
    """Ekstrak teks dari PDF/gambar.

    Return dict sesuai Tabel IV-10 (output untuk modul NER):
      - nama_dokumen: str
      - metode_ekstraksi: "Teks PDF" | "OCR"
      - teks_ekstraksi: str (teks bersih, halaman di-join "\\n")
      - waktu_pemrosesan: float (detik, total dari awal sampai akhir)

    PDF text-extractable di-bypass via pdftotext ("Teks PDF").
    Sisanya jalan pipeline OCR penuh (OSD/skew/resize/BlackHat/Otsu/Tesseract).
    PSM dipilih dari `kategori` (form) atau di-deteksi dari nama file.
    """
    t_start = time.perf_counter()
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    # Pilih PSM dari kategori (form) -> fallback ke deteksi nama file
    cat = _normalize_kategori(kategori)
    if cat == "unknown":
        cat = detect_category(filename)
    psm = CATEGORY_PSM.get(cat, PSM_DEFAULT)
    logger.info(f"Processing {filename}: kategori={cat}, psm={psm}")

    metode_ekstraksi = "OCR"
    pages_text: list[str] = []

    if ext == "pdf":
        # Coba PDF Digital path dulu
        digital_text = _extract_pdf_digital(file_bytes)
        if digital_text is not None:
            logger.info(f"{filename}: PDF Digital (pdftotext), {len(digital_text)} chars")
            cleaned = _normalize_whitespace(digital_text)
            return {
                "nama_dokumen": filename,
                "metode_ekstraksi": "Teks PDF",
                "teks_ekstraksi": cleaned,
                "waktu_pemrosesan": round(time.perf_counter() - t_start, 3),
            }

        logger.info(f"Converting PDF to images (DPI={PDF_DPI})...")
        pil_images = convert_from_bytes(
            file_bytes, dpi=PDF_DPI, poppler_path=POPPLER_PATH
        )
        logger.info(f"PDF has {len(pil_images)} page(s)")

        for i, pil_img in enumerate(pil_images):
            text = _process_page(pil_img.convert("RGB"), psm=psm, dpi=PDF_DPI)
            pages_text.append(text)
            logger.debug(f"Page {i + 1}: extracted {len(text)} chars")
    else:
        pil_img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
        text = _process_page(pil_img, psm=psm, dpi=IMAGE_DPI)
        pages_text.append(text)

    raw_text = "\n".join(pages_text)
    cleaned = _normalize_whitespace(raw_text)
    logger.info(f"OCR complete: {len(raw_text)} chars raw -> {len(cleaned)} chars cleaned")

    return {
        "nama_dokumen": filename,
        "metode_ekstraksi": metode_ekstraksi,
        "teks_ekstraksi": cleaned,
        "waktu_pemrosesan": round(time.perf_counter() - t_start, 3),
    }
