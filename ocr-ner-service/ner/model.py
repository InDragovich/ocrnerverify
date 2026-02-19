"""
Singleton NER model loader.
Loads cahya/bert-base-indonesian-NER once at startup via FastAPI lifespan.
"""

import logging

import torch
from transformers import AutoModelForTokenClassification, AutoTokenizer, pipeline

from config import settings

logger = logging.getLogger(__name__)

_ner_pipeline = None


def load_model() -> None:
    """Load NER model into GPU/CPU. Called once at application startup."""
    global _ner_pipeline

    model_name = settings.ner_model_name
    device = 0 if torch.cuda.is_available() else -1

    logger.info(f"Loading NER model: {model_name}")
    logger.info(f"Device: {'GPU (CUDA)' if device == 0 else 'CPU'}")

    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForTokenClassification.from_pretrained(model_name)

    _ner_pipeline = pipeline(
        "token-classification",
        model=model,
        tokenizer=tokenizer,
        aggregation_strategy="simple",
        device=device,
    )

    # Warm-up inference
    test_text = "PT PLN menerbitkan tagihan bulan Oktober 2024 sebesar Rp 200000"
    test_result = _ner_pipeline(test_text)
    logger.info(f"Model loaded. Warm-up test: {len(test_result)} entities detected")


def get_pipeline():
    """Get the loaded NER pipeline. Raises if not initialized."""
    if _ner_pipeline is None:
        raise RuntimeError("NER pipeline not initialized. Call load_model() first.")
    return _ner_pipeline
