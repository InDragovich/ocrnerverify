from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    tesseract_cmd: str = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    poppler_path: str = r"C:\Program Files\poppler-25.07.0\Library\bin"
    host: str = "0.0.0.0"
    port: int = 5001
    ner_model_name: str = "cahya/bert-base-indonesian-NER"
    ocr_dpi: int = 300
    ocr_lang: str = "ind+eng"
    max_file_size_mb: int = 10
    log_level: str = "INFO"

    class Config:
        env_file = ".env"
        env_prefix = "OCR_NER_"


settings = Settings()
