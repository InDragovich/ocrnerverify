# Running ocrnerverify Locally

A short guide to running the application on your own machine. The application has **3 services** that run side by side in 3 separate terminals.

| Terminal | Service | Folder | Port |
|---|---|---|---|
| 1 | Laravel backend (API) | `backend/` | 8000 |
| 2 | React frontend (Vite) | project root | 5173 |
| 3 | OCR/NER service (FastAPI) | `ocr-ner-service/` | 5001 |

> If you only want to try the interface without real OCR, you can skip Terminal 3 and set `OCR_NER_USE_MOCK=true` in `backend/.env`.

---

## 0. Requirements

Make sure the following are installed:

- **PHP 8.2 or newer** with the `pdo_sqlite` extension enabled (included in Laragon and XAMPP)
- **Composer**
- **Node.js 18+** and npm
- **Python 3.10+** (only for the OCR/NER service)
- **Tesseract OCR** with the `ind` and `eng` language packs, e.g. `C:/Program Files/Tesseract-OCR/tesseract.exe`
- **Poppler**, e.g. `C:/Program Files/poppler-25.07.0/Library/bin`

Quick check:

```powershell
php -v         # 8.2 or newer
composer -V
node -v
python --version
```

### PHP not found?

On Windows with Laragon, PHP must be added to PATH manually **in every new terminal**:

```powershell
$env:PATH = "C:\laragon\bin\php\php-8.2.22-Win32-vs16-x64;" + $env:PATH
```

With XAMPP: `$env:PATH = "C:\xampp\php;" + $env:PATH`

If `composer` is not found:

```powershell
$env:PATH = "C:\laragon\bin\composer;" + $env:PATH
```

---

## 1. Terminal 1: Laravel Backend

### Setup (first time only)

```powershell
cd backend

composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
```

For real OCR, make sure `backend/.env` contains:

```
OCR_NER_API_URL=http://localhost:5001/extract
OCR_NER_USE_MOCK=false
```

### Run

```powershell
cd backend
php artisan serve
```

Server: http://localhost:8000

> A queue worker is **not needed**. Batch verification runs synchronously inside the request.

---

## 2. Terminal 2: React Frontend

### Setup (first time only)

```powershell
cp .env.example .env
npm install
```

The root `.env` should contain:

```
VITE_API_BASE_URL=http://localhost:8000/api
```

### Run

```powershell
npm run dev
```

Frontend: **http://localhost:5173**. This is the address to open in the browser.

---

## 3. Terminal 3: OCR/NER Service (FastAPI)

### Prepare the NER model (first time only)

The fine-tuned model (about 495 MB) is **not in git**. Copy it manually to:

```
ocr-ner-service/models/ner_indobert/
├── config.json
├── model.safetensors
├── tokenizer.json
└── tokenizer_config.json
```

### Install and run

```powershell
cd ocr-ner-service
pip install -r requirements.txt   # first time only
python main.py
```

Service: http://localhost:5001 (Swagger docs at `/docs`)

On startup the service prints the Tesseract and Poppler paths, loads the NER model, and runs a warm-up inference. Wait until it finishes before trying a verification.

For GPU support:

```powershell
pip install torch --index-url https://download.pytorch.org/whl/cu121
```

---

## 4. Logging In

Open http://localhost:5173.

| Username | Role | Password |
|---|---|---|
| `demo_operator` | Operator (all regions) | `demo1234` |
| `demo_verifikator` | Verifier (all regions) | `demo1234` |
| `input_jkt`, `input_medan`, `input_sby`, `input_mks` | Operator (one region each) | `password` |
| `operator` | Operator (all regions) | `password` |
| `verificator` | Verifier | `password` |
| `superadmin` | Super Admin | `password` |

The staff accounts use the password `password` only in a local environment. In any other environment they are created only when `SEED_PASSWORD` is set.

Demo flow: log in as an **operator**, upload a document, log out, log in as a **verifier**, run the batch verification (OCR/NER runs here), open the detail view, and make a decision.

---

## Troubleshooting

**`could not find driver`**: the `pdo_sqlite` extension is not enabled. Open `php.ini` (e.g. `C:\laragon\bin\php\php-8.2.22-Win32-vs16-x64\php.ini`), remove the `;` in front of `extension=pdo_sqlite`, and restart the terminal.

**`php` or `composer` not recognized**: PATH is not set in that terminal. See the requirements section above.

**Verification fails or times out**: check that Terminal 3 is running and the model has finished loading. If you do not need real OCR, set `OCR_NER_USE_MOCK=true` in `backend/.env` and restart Terminal 1.

**NER model not found**: make sure the 4 files are in `ocr-ner-service/models/ner_indobert/`. The default is `NER_MODEL_NAME=./models/ner_indobert`.

**Frontend loads but data is empty, or login fails**: make sure Terminal 1 is running and `VITE_API_BASE_URL` points to `http://localhost:8000/api`. After changing the frontend `.env`, restart `npm run dev`.

---

## About the Hosted Version

The online version has the frontend on **Vercel** and the backend on **Render** (SQLite on a free plan; data resets on every redeploy). The OCR/NER service is not hosted, so real OCR runs only locally. See [DEPLOYMENT.md](DEPLOYMENT.md) for details.
