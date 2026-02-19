@echo off
echo [SIM-LPU] Starting OCR-NER FastAPI service...
echo.

:: Create virtual environment if not present
if not exist .venv (
    echo Creating virtual environment...
    python -m venv .venv
)

:: Activate virtual environment
call .venv\Scripts\activate

:: Install PyTorch with CUDA 12.1 support (RTX 4060)
echo Installing PyTorch with CUDA support...
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121 --quiet

:: Install remaining dependencies
echo Installing dependencies...
pip install -r requirements.txt --quiet

echo.
echo Starting FastAPI server on port 5001...
echo Press Ctrl+C to stop.
echo.
python -m uvicorn main:app --host 0.0.0.0 --port 5001 --reload
