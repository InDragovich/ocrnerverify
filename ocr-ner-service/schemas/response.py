from pydantic import BaseModel
from typing import Optional


class EntitiesSchema(BaseModel):
    kategori: Optional[str] = None
    periode: Optional[str] = None
    nominal: Optional[str] = None


class OcrNerResponse(BaseModel):
    text_ocr: str
    entities: EntitiesSchema
    status: str  # "success" | "partial_success" | "failed"
    error_message: Optional[str] = None
