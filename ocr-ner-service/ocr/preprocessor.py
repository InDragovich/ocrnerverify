"""
Image preprocessing pipeline for OCR.
Ported from Colab notebook cells 10-12:
  - Orientation & skew correction (Tesseract OSD)
  - Grayscaling
  - Adaptive noise removal
"""

import cv2
import numpy as np
import pytesseract
from PIL import Image

from config import settings

pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd


def correct_orientation(img: np.ndarray) -> np.ndarray:
    """
    Detect and correct page rotation using Tesseract OSD.
    Falls back to 180-degree check if OSD fails.
    """
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
            lang=settings.ocr_lang,
            config="--psm 6 --oem 3",
            output_type=pytesseract.Output.DICT,
        )
        conf_normal = [int(c) for c in data_normal["conf"] if int(c) > 0]
        avg_conf_normal = sum(conf_normal) / len(conf_normal) if conf_normal else 0

        rotated_180 = np.rot90(img, 2)
        center_crop_180 = rotated_180[h // 4 : 3 * h // 4, w // 4 : 3 * w // 4]
        data_rotated = pytesseract.image_to_data(
            Image.fromarray(center_crop_180),
            lang=settings.ocr_lang,
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


def to_grayscale(img: np.ndarray) -> np.ndarray:
    """Convert to grayscale if image has color channels."""
    if len(img.shape) == 3:
        return cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    return img


def adaptive_denoise(img: np.ndarray) -> np.ndarray:
    """
    Apply adaptive noise removal based on estimated noise level.
    Uses Laplacian variance to estimate noise.
    """
    noise_level = cv2.Laplacian(img, cv2.CV_64F).var()

    if noise_level > 1500:
        return cv2.GaussianBlur(img, (5, 5), 0)
    elif noise_level > 500:
        return cv2.GaussianBlur(img, (3, 3), 0)
    else:
        return img


def preprocess(img: np.ndarray) -> np.ndarray:
    """Full preprocessing pipeline: orientation → grayscale → denoise."""
    img = correct_orientation(img)
    img = to_grayscale(img)
    img = adaptive_denoise(img)
    return img
