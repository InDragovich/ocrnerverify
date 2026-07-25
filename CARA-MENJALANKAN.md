# Cara Menjalankan ocrnerverify (Lokal)

Panduan ringkas menjalankan aplikasi di laptop sendiri. Aplikasi terdiri dari **3 service** yang harus jalan bersamaan di 3 terminal terpisah.

| Terminal | Service | Folder | Port |
|---|---|---|---|
| 1 | Backend Laravel (API) | `backend/` | 8000 |
| 2 | Frontend React (Vite) | root project | 5173 |
| 3 | OCR-NER FastAPI | `ocr-ner-service/` | 5001 |

> Kalau cuma mau demo UI tanpa OCR asli, Terminal 3 bisa dilewati — set `OCR_NER_USE_MOCK=true` di `backend/.env`.

---

## 0. Prasyarat

Pastikan sudah terinstall:

- **PHP >= 8.2** dengan extension `pdo_sqlite` aktif (bawaan Laragon/XAMPP)
- **Composer**
- **Node.js 18+** dan npm
- **Python 3.10+** (khusus untuk OCR-NER service)
- **Tesseract OCR** — `C:/Program Files/Tesseract-OCR/tesseract.exe`, dengan language pack `ind` + `eng`
- **Poppler** — `C:/Program Files/poppler-25.07.0/Library/bin`

Cek cepat:

```powershell
php -v         # >= 8.2
composer -V
node -v
python --version
```

### PHP tidak terbaca?

PATH PHP Laragon harus di-set manual **setiap buka terminal baru**:

```powershell
$env:PATH = "C:\laragon\bin\php\php-8.2.22-Win32-vs16-x64;" + $env:PATH
```

Kalau pakai XAMPP: `$env:PATH = "C:\xampp\php;" + $env:PATH`

Kalau `composer` tidak ketemu:

```powershell
$env:PATH = "C:\laragon\bin\composer;" + $env:PATH
```

---

## 1. Terminal 1 — Backend Laravel

### Setup (sekali saja, pertama kali)

```powershell
$env:PATH = "C:\laragon\bin\php\php-8.2.22-Win32-vs16-x64;" + $env:PATH
cd backend

composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
```

Pastikan isi `backend/.env` untuk OCR:

```
OCR_NER_API_URL=http://localhost:5001/extract
OCR_NER_USE_MOCK=false
```

### Jalankan

```powershell
$env:PATH = "C:\laragon\bin\php\php-8.2.22-Win32-vs16-x64;" + $env:PATH
cd backend
php artisan serve
```

Server: http://localhost:8000

> Queue worker **tidak perlu** dijalankan — sejak v1.3.0 batch verifikasi diproses sinkron di dalam request.

---

## 2. Terminal 2 — Frontend React

### Setup (sekali saja)

```powershell
npm install
```

Pastikan `.env` di root berisi:

```
VITE_API_BASE_URL=http://localhost:8000/api
```

### Jalankan

```powershell
npm run dev
```

Frontend: **http://localhost:5173** ← ini yang dibuka di browser.

---

## 3. Terminal 3 — OCR-NER Service (FastAPI)

### Siapkan model NER (sekali saja)

Model fine-tuned (~495MB) **tidak ikut di git**. Salin manual ke:

```
ocr-ner-service/models/ner_indobert/
├── config.json
├── model.safetensors
├── tokenizer.json
└── tokenizer_config.json
```

Sumber: hasil training `Notebook 1 — Fine-tuning IndoBERT`.

### Setup & jalankan

```powershell
cd ocr-ner-service
pip install -r requirements.txt   # pertama kali saja
python main.py
```

Service: http://localhost:5001 (Swagger docs di `/docs`)

Saat startup akan mencetak path Tesseract/Poppler, load model NER, lalu warm-up inference. Tunggu sampai selesai sebelum mencoba verifikasi.

Untuk GPU (RTX 4060):

```powershell
pip install torch --index-url https://download.pytorch.org/whl/cu121
```

---

## 4. Login

Buka http://localhost:5173. Semua akun demo passwordnya `password`:

| Username | Role | Wilayah |
|---|---|---|
| `input_jkt` | Operator | Jakarta |
| `input_medan` | Operator | I. MEDAN |
| `input_sby` | Operator | Surabaya |
| `input_mks` | Operator | Makassar |
| `verificator` | Verifikator | — |
| `superadmin` | Super Admin | — |

Alur demo: login sebagai **operator** → upload dokumen → logout → login sebagai **verificator** → batch verifikasi (OCR/NER jalan di sini) → buka detail → ambil keputusan.

---

## Troubleshooting

**`could not find driver`** — extension `pdo_sqlite` belum aktif. Buka `php.ini` (mis. `C:\laragon\bin\php\php-8.2.22-Win32-vs16-x64\php.ini`), hapus `;` di depan `extension=pdo_sqlite`, restart terminal.

**`php` / `composer` not recognized** — PATH belum di-set di terminal itu. Lihat bagian Prasyarat di atas.

**Verifikasi gagal / timeout** — cek Terminal 3 sudah jalan dan model selesai di-load. Kalau sedang tidak butuh OCR asli, set `OCR_NER_USE_MOCK=true` di `backend/.env` lalu restart Terminal 1.

**Model NER tidak ditemukan** — pastikan 4 file ada di `ocr-ner-service/models/ner_indobert/`. Default `NER_MODEL_NAME=./models/ner_indobert`.

**Frontend jalan tapi data kosong / error login** — pastikan Terminal 1 hidup dan `VITE_API_BASE_URL` menunjuk ke `http://localhost:8000/api`. Ubah `.env` frontend butuh **restart** `npm run dev`.

---

## Catatan Versi Hosting

Versi online: frontend di **Vercel**, backend di **Railway** (SQLite ephemeral, data reset tiap redeploy). OCR-NER service belum di-host — pipeline OCR asli hanya jalan saat demo lokal. Detail konfigurasi ada di `vercel.json` dan `railway.json`.
