# SIM-LPU — Sistem Verifikasi Biaya Rutin

Web application untuk verifikasi dokumen laporan subsidi operasional (biaya rutin) dengan integrasi OCR dan NER.

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4
- **Backend**: Laravel 11 + Sanctum
- **Database**: SQLite (development) / MySQL (production)

---

## Changelog

### v1.0.0 — Initial Frontend (2025-02-05)
- Setup project React + Vite + Tailwind CSS
- Halaman Login, Input Operator, Verifier Dashboard (tampilan awal)
- Komponen Header
- README awal dengan panduan setup

### v1.1.0 — Full-Stack Integration (2025-02-08)
**Frontend (modifikasi):**
- Integrasi autentikasi via Laravel Sanctum (Bearer token)
- Service layer: `api.ts`, `authService.ts`, `verifikasiService.ts`, `userService.ts`
- Halaman baru: `DashboardPage` (statistik), `AdminUsersPage` (kelola user)
- Komponen baru: `DetailModal` (detail data + hasil OCR/NER + keputusan manual)
- Data constants: kategori, bulan, warna status
- Update `LoginPage`: navigasi berdasarkan role
- Update `InputDashboard`: form input + CRUD data operator + upload lampiran
- Update `VerifierDashboard`: filter, batch verifikasi otomatis, progress bar, polling
- Update `Header`: badge role, navigasi per role
- Update `App.tsx`: routing lengkap dengan role-based access

**Backend (baru):**
- Laravel 11 project dengan Sanctum authentication
- 3 Model: `User`, `VerifikasiBiayaRutin`, `AuditLog`
- 6 Controller: `AuthController`, `VerifikasiController`, `BatchVerifikasiController`, `MockOcrNerController`, `AuditLogController`, `Admin/UserController`
- 5 Form Request: validasi input terstruktur
- 2 Middleware: `EnsureRole` (role-based access), `AuthenticateFromQuery` (token query param)
- 1 Queue Job: `ProcessVerifikasiJob` (OCR-NER + matching otomatis)
- 3 Service: `OcrNerService`, `MatchingService`, `AuditService`
- Mock OCR-NER API untuk prototype (70% sukses, 20% partial, 10% gagal)
- Database migration: users, verifikasi_biaya_rutin, audit_logs, jobs, cache, personal_access_tokens
- Seeder: 6 user demo + 5 data verifikasi sample
- Queue berbasis database dengan retry 3x dan timeout 120 detik
- Audit trail: login, logout, CRUD, verifikasi otomatis/manual

### v1.2.0 — UI/UX Revision & Audit Logs (2025-02-09)
**Frontend:**
- Rename kolom tabel: "Kategori" -> "Nama Rekening", "Nominal" -> "Pelaporan"
- Tambah kolom "Verifikasi" (hasil NER nominal) dengan warna status:
  - Abu-abu: belum diverifikasi
  - Hijau: Pelaporan == Verifikasi (nominal cocok)
  - Merah: Pelaporan != Verifikasi (nominal tidak cocok)
- Hapus kolom "Lampiran", "Status", dan "Kesesuaian" dari tabel (info tersedia di detail modal)
- Gabung kategori "Air" dan "Gas" menjadi "Air/Gas"
- Halaman baru: `AuditLogPage` — riwayat aktivitas user (super_admin only)
- Update `Header`: navigasi role-based dengan active state, responsive mobile nav
- DataTable-style layout: Show entries, search, pagination di semua tabel
- Fix preview lampiran (gambar & PDF) di detail modal

**Backend:**
- Tambah `AuditLogController` — list audit logs dengan filter & pagination
- Tambah middleware `AuthenticateFromQuery` — fix preview lampiran (token via query param)
- Update seeder: kategori "Air" -> "Air/Gas"

### v1.2.1 — Inline Attachment Viewer (2025-02-09)
- Komponen baru `LampiranViewer` — preview lampiran langsung di modal tanpa buka tab baru
- Dukungan format: PDF (iframe), gambar JPG/PNG/GIF/WebP (`<img>`), DOCX (`docx-preview`), XLSX/XLS (SheetJS → tabel HTML)
- File diambil via axios dengan auth token, ditampilkan dari blob
- Fallback "Buka di tab baru" untuk format yang tidak didukung
- Dependensi baru: `docx-preview`, `xlsx` (SheetJS)
- Styling docx-preview dan tabel XLSX di `index.css`

### v1.3.0 — Fix Verifikasi Otomatis, Keputusan Manual & Koreksi Nominal (2025-02-09)
**Bug Fix:**
- Fix deadlock verifikasi otomatis: mock OCR sekarang diproses langsung in-process (bukan HTTP request ke server sendiri yang menyebabkan hang di Windows single-threaded dev server)
- Fix batch verify: `dispatchSync` dengan try-catch per job, sehingga 1 item gagal tidak menghentikan seluruh batch
- Fix data seeder tidak bisa diverifikasi karena file lampiran tidak ada di storage — mock mode sekarang skip pengecekan file
- Fix item stuck di status "diproses": sekarang bisa di-select dan di-proses ulang
- Fix keputusan manual tidak bereaksi: error message sekarang ditampilkan dari response backend
- Tambah teks "Proses..." di kolom Verifikasi saat batch berjalan

**Fitur Baru:**
- Koreksi nominal OCR: verifikator dapat mengedit nominal hasil OCR/NER di tab Keputusan sebelum menyimpan keputusan (via field `koreksi_entitas`)
- Ringkasan perbandingan nominal (Pelaporan vs OCR) ditampilkan di tab Keputusan dengan indikator cocok/tidak cocok
- Pesan sukses/error ditampilkan setelah batch verifikasi selesai

**Peningkatan Mock OCR:**
- Nominal: 70% cocok persis, 20% selisih kecil (±1-10%), 10% beda total
- Kategori: selalu cocok dengan data input
- Periode: 80% cocok, 20% bulan berbeda

**Perubahan Arsitektur:**
- Queue worker (`php artisan queue:listen`) **tidak diperlukan lagi** — batch verifikasi diproses secara sinkron dalam request
- Mock OCR logic dipindah dari `MockOcrNerController` (HTTP) ke `OcrNerService` (in-process) saat `OCR_NER_USE_MOCK=true`
- Polling interval dihapus dari frontend (hasil langsung dikembalikan setelah proses selesai)

### v1.4.0 — Real OCR-NER Microservice (2026-02-19)
**Fitur Baru — FastAPI OCR-NER Microservice:**
- Ganti mock OCR-NER dengan implementasi asli menggunakan **Tesseract OCR** dan **IndoBERT NER**
- Microservice terpisah di `ocr-ner-service/` (FastAPI, port 5001)
- Microservice berjalan lokal di `localhost:5001`

**OCR Pipeline (Tesseract):**
- Konversi PDF → gambar (pdf2image, DPI 300)
- Preprocessing: orientation/skew correction, grayscale, adaptive noise removal
- Ekstraksi teks: Tesseract OCR (PSM 3, OEM 3, bahasa Indonesia + English)
- Post-processing: garbage line removal

**NER Pipeline (IndoBERT):**
- Model: `cahya/bert-base-indonesian-NER` (HuggingFace)
- Ekstraksi entitas: ORG → kategori, DAT → periode, MON → nominal
- Preprocessing: reorder nominal lines ke atas untuk akurasi MON
- Similarity scoring nominal terhadap input user
- Support GPU (CUDA) untuk inferensi cepat

**Perubahan Backend:**
- `OcrNerService.php`: forward user input (kategori, periode, nominal) ke FastAPI
- `config/ocr_ner.php`: default URL ke `localhost:5001/extract`, timeout 120s
- `.env`: `OCR_NER_USE_MOCK=false`, `OCR_NER_API_URL=http://localhost:5001/extract`

**File Baru:**
- `ocr-ner-service/main.py` — FastAPI endpoint `POST /extract`
- `ocr-ner-service/ocr/preprocessor.py` — Image preprocessing pipeline
- `ocr-ner-service/ocr/extractor.py` — Tesseract OCR extraction
- `ocr-ner-service/ner/model.py` — Singleton IndoBERT model loader
- `ocr-ner-service/ner/extractor.py` — NER entity extraction & verification
- `ocr-ner-service/start.bat` — Windows startup script

### v1.5.0 — Fix Periode Matching, Auto-Sync Triwulan, Koreksi Entitas Verifier (2026-02-24)
**Bug Fix:**
- Fix periode matching OCR/NER: format data input sekarang "Bulan Tahun" (gabungan `periode` + `tahun`) agar cocok dengan hasil NER (sebelumnya input hanya "Oktober" vs NER "Oktober 2025" → selalu tidak cocok)

**Fitur Baru:**
- Auto-sync Periode → Triwulan di form operator: pilih bulan otomatis mengisi triwulan (Jan-Mar → TW1, Apr-Jun → TW2, Jul-Sep → TW3, Okt-Des → TW4). Triwulan di-disable untuk mencegah inkonsistensi input
- Verifier dapat mengoreksi **kategori** dan **periode** hasil OCR/NER via dropdown di tab Keputusan (sebelumnya hanya nominal yang bisa dikoreksi)

**Perubahan Teknis:**
- `constants.ts`: tambah helper `getTriwulan(month)` — hitung triwulan dari index bulan
- `InputDashboard.tsx`: posisi Periode dan Triwulan di-swap, triwulan auto-calculated & disabled
- `DetailModal.tsx`: tambah editable dropdown Kategori OCR/NER dan Periode OCR/NER di Ringkasan Hasil
- `ProcessVerifikasiJob.php`: gabung `periode + tahun` saat kirim ke matching service
- `KeputusanRequest.php`: tambah validasi `koreksi_entitas.kategori` dan `koreksi_entitas.periode`

### v1.6.0 — Drill-Down Dashboard & OCR-NER Refactoring (2026-03-10)
**Fitur Baru — Drill-Down Dashboard Verifier:**
- Dashboard verifier sekarang menampilkan **hierarki drill-down 4 level**: Regional → KCU → KPC → Dokumen
- Level 1-3 menampilkan **tabel ringkasan** (SummaryTable) dengan kolom: nama, jumlah sub-unit, total dokumen, total biaya, progress bar, dan status verifikasi
- Klik baris untuk masuk ke level berikutnya, navigasi via **breadcrumb** untuk kembali ke level atas
- Filter **Tahun** dan **Triwulan** bersifat global (berlaku semua level, reset ke level 1 saat diubah)
- Filter **Kategori** dan **Status** hanya muncul di level 4 (dokumen)

**Backend — Endpoint Baru:**
- `GET /api/verifikasi/summary` — aggregate data grouped by `regional` / `kcu` / `kpc` (total_dokumen, total_biaya, selesai, menunggu, gagal, jumlah_sub)
- Filter tambahan `regional`, `kcu`, `kpc` di endpoint list verifikasi

**Bug Fix:**
- Fix tampilan periode di tab OCR comparison: sekarang menampilkan "Bulan Tahun" (sebelumnya hanya bulan)

**OCR-NER Service — Refactoring v2.0.0:**
- Simplifikasi struktur: hapus `config.py`, `ner/model.py`, `ocr/preprocessor.py`, `schemas/`, `start.bat`
- Model loading dan NER extraction digabung ke `ner/extractor.py` (singleton pipeline)
- Preprocessing OCR digabung ke `ocr/extractor.py`
- Schema response di-inline ke `main.py`
- Config sekarang langsung via `os.environ` (tanpa pydantic settings)
- Env var disederhanakan: hapus prefix `OCR_NER_`, semua opsional (auto-detect)
- Jalankan service cukup dengan `python main.py` (tanpa `start.bat`)

---

## Prasyarat

Sebelum menjalankan aplikasi, pastikan software berikut sudah terinstall:

1. **Node.js >= 18** + npm — [https://nodejs.org/](https://nodejs.org/)
2. **PHP >= 8.2** — Bisa via Laragon, XAMPP, atau install manual
3. **Composer** — [https://getcomposer.org/](https://getcomposer.org/)
4. **Git** — [https://git-scm.com/](https://git-scm.com/)
5. **SQLite** — Sudah built-in di PHP (pastikan extension `pdo_sqlite` aktif)
6. **Python >= 3.10** — [https://www.python.org/](https://www.python.org/) (untuk OCR-NER service)
7. **Tesseract OCR** — [https://github.com/tesseract-ocr/tesseract](https://github.com/tesseract-ocr/tesseract) (dengan bahasa Indonesia)
8. **Poppler** — [https://github.com/osadl/poppler](https://github.com/osadl/poppler) (untuk konversi PDF)

> **Catatan:** Prasyarat 6-8 diperlukan untuk OCR-NER service. Jika hanya ingin testing dengan mock, cukup prasyarat 1-5.

---

## Cara Menjalankan (Lokal) — Panduan Lengkap

### Opsi A: Menggunakan Laragon (Direkomendasikan untuk Windows)

#### 1. Install Laragon

1. Download Laragon Full dari [https://laragon.org/download/](https://laragon.org/download/)
2. Install dan buka Laragon
3. Laragon sudah menyediakan PHP, MySQL, Apache, Node.js, dan Composer

#### 2. Konfigurasi PATH PHP di Terminal

> **PENTING**: Jika terminal (PowerShell/CMD) tidak mengenali `php` atau `composer`, Anda perlu menambahkan PATH PHP Laragon secara manual.

**PowerShell (Terminal bawaan VS Code / Windows Terminal):**
```powershell
# Sesuaikan path dengan lokasi instalasi Laragon Anda
$env:PATH = "C:\laragon\bin\php\php-8.2.22-Win32-vs16-x64;" + $env:PATH

# Atau jika Laragon di lokasi lain (contoh):
$env:PATH = "E:\Softwares\laragon\bin\php\php-8.4.9-Win32-vs17-x64;" + $env:PATH
```

**CMD (Command Prompt):**
```cmd
set PATH=C:\laragon\bin\php\php-8.2.22-Win32-vs16-x64;%PATH%
```

> **Catatan**: Perintah `set $env:PATH` di atas hanya berlaku untuk sesi terminal yang aktif saja. Setiap kali membuka terminal baru, Anda perlu menjalankan ulang perintah ini. Jika ingin permanen, tambahkan ke System Environment Variables Windows.

**Cara cek apakah PHP sudah terbaca:**
```bash
php -v
# Harus muncul versi PHP >= 8.2

composer -V
# Harus muncul versi Composer
```

#### 3. Clone Repository

```bash
git clone https://github.com/InDragovich/SIM-LPU.git
cd SIM-LPU
```

#### 4. Setup Backend (Laravel)

Buka **Terminal 1** (untuk backend):

```bash
cd backend
composer install
```

Jika `composer` tidak ditemukan:
```powershell
# Tambahkan path Composer ke PATH (PowerShell)
$env:PATH = "C:\laragon\bin\composer;" + $env:PATH
# Atau jika Composer di lokasi lain:
$env:PATH = "C:\Users\NAMAUSER\AppData\Roaming\Composer\vendor\bin;" + $env:PATH
```

Lanjutkan setup:
```bash
# Copy file environment
cp .env.example .env

# Generate application key
php artisan key:generate

# Jalankan migrasi database + data demo
php artisan migrate --seed
```

> **Jika error "could not find driver"**: Pastikan extension `pdo_sqlite` aktif di `php.ini` Laragon. Buka file `php.ini` (biasanya di `C:\laragon\bin\php\php-x.x.x\php.ini`), cari baris `;extension=pdo_sqlite` dan hapus tanda titik koma (`;`) di depannya.

#### 5. Jalankan Backend

**Terminal 1 — Laravel Server:**
```powershell
# Jangan lupa set PATH dulu jika terminal baru
$env:PATH = "C:\laragon\bin\php\php-8.2.22-Win32-vs16-x64;" + $env:PATH

cd backend
php artisan serve
# Server berjalan di http://localhost:8000
```

> **Catatan:** Sejak v1.3.0, Queue Worker **tidak diperlukan lagi**. Batch verifikasi diproses secara sinkron dalam request.

#### 6. Setup & Jalankan OCR-NER Service

Sejak v1.4.0, verifikasi otomatis menggunakan OCR-NER asli (bukan mock).

Buka **Terminal 3**:
```bash
cd ocr-ner-service

# Install dependencies (pertama kali saja)
pip install -r requirements.txt

# Jalankan service
python main.py
# Service berjalan di http://localhost:5001
# Pertama kali: download model IndoBERT ~443MB
```

Pastikan `.env` di `backend/` sudah diset:
```
OCR_NER_API_URL=http://localhost:5001/extract
OCR_NER_USE_MOCK=false
```

> **Catatan:** Jika ingin testing tanpa OCR-NER, set `OCR_NER_USE_MOCK=true` di `backend/.env`.

#### 7. Setup & Jalankan Frontend

**Terminal 2 — React Dev Server:**
```bash
# Di root folder project (bukan di folder backend)
cd SIM-LPU
npm install
npm run dev
# Frontend berjalan di http://localhost:5173
```

#### 8. Buka Aplikasi

Buka browser dan akses: **http://localhost:5173**

---

### Opsi B: Menggunakan XAMPP

#### 1. Install XAMPP

1. Download dari [https://www.apachefriends.org/](https://www.apachefriends.org/)
2. Install dengan komponen PHP (minimal) tercentang
3. XAMPP biasanya terinstall di `C:\xampp`

#### 2. Konfigurasi PATH PHP di Terminal

**PowerShell:**
```powershell
$env:PATH = "C:\xampp\php;" + $env:PATH
```

**CMD:**
```cmd
set PATH=C:\xampp\php;%PATH%
```

**Verifikasi:**
```bash
php -v
```

#### 3. Install Composer (jika belum)

1. Download installer dari [https://getcomposer.org/download/](https://getcomposer.org/download/)
2. Jalankan installer, pilih PHP dari XAMPP (`C:\xampp\php\php.exe`)
3. Verifikasi: `composer -V`

#### 4. Aktifkan Extension SQLite

1. Buka file `C:\xampp\php\php.ini`
2. Cari dan uncomment (hapus `;`) baris berikut:
   ```
   extension=pdo_sqlite
   extension=sqlite3
   extension=fileinfo
   ```
3. Simpan file

#### 5. Clone dan Setup (sama seperti Laragon)

```bash
git clone https://github.com/InDragovich/SIM-LPU.git
cd SIM-LPU

# Setup backend
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed

# Jalankan backend (Terminal 1)
php artisan serve

# Setup & jalankan frontend (Terminal 2 — baru, di root project)
cd ..
npm install
npm run dev
```

#### 6. Buka Aplikasi

Akses **http://localhost:5173** di browser.

---

### Opsi C: Tanpa Laragon / XAMPP (Install Manual)

1. Install PHP 8.2+ dari [https://windows.php.net/download](https://windows.php.net/download)
2. Install Composer dari [https://getcomposer.org/](https://getcomposer.org/)
3. Install Node.js 18+ dari [https://nodejs.org/](https://nodejs.org/)
4. Tambahkan semua ke PATH environment variable
5. Ikuti langkah clone dan setup yang sama seperti di atas

---

## Troubleshooting (Masalah Umum)

### `php` tidak ditemukan di terminal
```
'php' is not recognized as an internal or external command
```
**Solusi:** Tambahkan PATH PHP sesuai lokasi instalasi Anda:
```powershell
$env:PATH = "LOKASI_PHP_ANDA;" + $env:PATH
```

### `composer` tidak ditemukan
```
'composer' is not recognized as an internal or external command
```
**Solusi:** Install Composer atau tambahkan ke PATH:
```powershell
$env:PATH = "C:\ProgramData\ComposerSetup\bin;" + $env:PATH
```

### Error "could not find driver" saat migrasi
**Solusi:** Aktifkan extension `pdo_sqlite` di `php.ini`:
1. Cari file `php.ini` (jalankan `php --ini` untuk melihat lokasinya)
2. Uncomment: `extension=pdo_sqlite`
3. Restart terminal

### Error "SQLSTATE[HY000]: General error: 1 no such table"
**Solusi:** Jalankan ulang migrasi:
```bash
cd backend
php artisan migrate:fresh --seed
```

### Verifikasi otomatis tidak berjalan (stuck di "Memproses...")
**Solusi:** Pastikan OCR-NER service berjalan (cek `http://localhost:5001/health`). Jika ingin testing tanpa OCR-NER, set `OCR_NER_USE_MOCK=true` di `backend/.env`. Jika masih stuck, restart backend server (`php artisan serve`).

### OCR-NER service error "Model not loaded"
**Solusi:** Pastikan `python main.py` berhasil download model IndoBERT (~443MB). Cek koneksi internet dan pastikan dependencies terinstall (`pip install -r requirements.txt`). Untuk GPU support: `pip install torch --index-url https://download.pytorch.org/whl/cu121`.

### Port 8000 sudah digunakan
**Solusi:** Gunakan port lain:
```bash
php artisan serve --port=8001
```
Lalu update `VITE_API_BASE_URL` di file `.env` root project:
```
VITE_API_BASE_URL=http://localhost:8001/api
```

### npm error saat install
**Solusi:** Hapus `node_modules` dan install ulang:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Preview lampiran error "Route [login] not defined"
**Solusi:** Sudah diperbaiki di v1.2.0. Pastikan middleware `AuthenticateFromQuery` sudah terdaftar di `backend/bootstrap/app.php`.

---

## Akun Demo

| Username | Password | Role | Region |
|----------|----------|------|--------|
| `input_medan` | `password` | Operator | I. MEDAN |
| `input_jkt` | `password` | Operator | Jakarta |
| `input_sby` | `password` | Operator | Surabaya |
| `input_mks` | `password` | Operator | Makassar |
| `verificator` | `password` | Verifikator | - |
| `superadmin` | `password` | Super Admin | - |

### Panduan Singkat per Role:
- **Operator** (`input_medan`, dll): Input data verifikasi biaya rutin + upload lampiran
- **Verifikator** (`verificator`): Lihat semua data, jalankan verifikasi otomatis (batch), beri keputusan manual
- **Super Admin** (`superadmin`): Semua fitur Verifikator + kelola user + lihat audit logs + dashboard statistik

---

## Script yang Tersedia

**Frontend:**
- `npm run dev` — Development server (port 5173)
- `npm run build` — Build produksi ke folder `dist`
- `npm run preview` — Preview hasil build
- `npm run lint` — Lint kode dengan ESLint

**Backend:**
- `php artisan serve` — Laravel server (port 8000)
- `php artisan migrate --seed` — Jalankan migrasi + data demo
- `php artisan migrate:fresh --seed` — Reset database + data demo (HATI-HATI: hapus semua data)

---

## Struktur Project

```
SIM-LPU/
│
├── src/                                    # Frontend (React + TypeScript)
│   ├── App.tsx                             # Router utama
│   ├── main.tsx                            # Entry point
│   ├── components/
│   │   ├── Header.tsx                      # Navbar global + navigasi role-based
│   │   ├── DetailModal.tsx                 # Modal detail + OCR/NER + keputusan + koreksi entitas
│   │   └── LampiranViewer.tsx              # Inline preview lampiran (PDF, DOCX, XLSX, gambar)
│   ├── pages/
│   │   ├── LoginPage.tsx                   # Halaman login
│   │   ├── DashboardPage.tsx               # Dashboard statistik
│   │   ├── InputDashboard.tsx              # Form input operator
│   │   ├── VerifierDashboard.tsx           # Drill-down dashboard (Regional→KCU→KPC→Dokumen)
│   │   ├── AdminUsersPage.tsx              # Kelola user (super admin)
│   │   └── AuditLogPage.tsx                # Riwayat aktivitas (super admin)
│   ├── services/
│   │   ├── api.ts                          # Axios HTTP client
│   │   ├── authService.ts                  # Login/logout
│   │   ├── verifikasiService.ts            # CRUD verifikasi + batch + summary
│   │   └── userService.ts                  # CRUD user admin
│   ├── data/
│   │   └── constants.ts                    # Nama rekening, bulan, warna status, getTriwulan()
│   └── utils/
│       └── storage.ts                      # Helper localStorage
│
├── backend/                                # Backend (Laravel 11)
│   ├── app/
│   │   ├── Http/
│   │   │   ├── Controllers/
│   │   │   │   ├── AuthController.php
│   │   │   │   ├── VerifikasiController.php
│   │   │   │   ├── BatchVerifikasiController.php
│   │   │   │   ├── MockOcrNerController.php
│   │   │   │   ├── AuditLogController.php
│   │   │   │   └── Admin/UserController.php
│   │   │   ├── Middleware/
│   │   │   │   ├── EnsureRole.php          # Role-based access control
│   │   │   │   └── AuthenticateFromQuery.php # Token via query param (lampiran)
│   │   │   └── Requests/                   # 5 Form Request validasi
│   │   ├── Jobs/
│   │   │   └── ProcessVerifikasiJob.php
│   │   ├── Models/
│   │   │   ├── User.php
│   │   │   ├── VerifikasiBiayaRutin.php
│   │   │   └── AuditLog.php
│   │   └── Services/
│   │       ├── OcrNerService.php           # Integrasi API OCR-NER
│   │       ├── MatchingService.php         # Pencocokan data
│   │       └── AuditService.php            # Audit trail
│   ├── config/
│   │   └── ocr_ner.php                     # Konfigurasi API OCR-NER
│   ├── database/
│   │   ├── migrations/                     # 6 migration files
│   │   └── seeders/                        # User + data demo
│   └── routes/
│       └── api.php                         # 15+ API endpoints
│
├── ocr-ner-service/                       # OCR-NER Microservice (FastAPI)
│   ├── main.py                            # FastAPI app + schemas + config
│   ├── ocr/
│   │   └── extractor.py                   # Tesseract OCR + preprocessing
│   ├── ner/
│   │   └── extractor.py                   # IndoBERT NER + model loader
│   ├── requirements.txt                   # Python dependencies
│   └── .env.example                       # Env vars opsional
│
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md
```

---

## Konfigurasi Environment

**Frontend** (`.env` di root project):
```
VITE_API_BASE_URL=http://localhost:8000/api
```

**Backend** (`backend/.env`):
```
OCR_NER_API_URL=http://localhost:5001/extract
OCR_NER_USE_MOCK=false
QUEUE_CONNECTION=database
FRONTEND_URL=http://localhost:5173
```

**OCR-NER Service** (`ocr-ner-service/` — semua env var opsional, auto-detect):
```
# TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe
# POPPLER_PATH=C:\Program Files\poppler-25.07.0\Library\bin
# NER_MODEL_NAME=cahya/bert-base-indonesian-NER
# HOST=0.0.0.0
# PORT=5001
```

---

## Ringkasan Terminal yang Dibutuhkan

Untuk menjalankan aplikasi secara lokal, Anda membutuhkan **2-3 terminal terpisah**:

| Terminal | Perintah | Keterangan |
|----------|----------|------------|
| Terminal 1 | `cd backend && php artisan serve` | Laravel API server (port 8000) |
| Terminal 2 | `npm run dev` | React dev server (port 5173) |
| Terminal 3 | `cd ocr-ner-service && python main.py` | OCR-NER service (port 5001, opsional jika mock) |

> **Penting:** Setiap terminal baru yang dibuka perlu menjalankan `$env:PATH = "LOKASI_PHP;" + $env:PATH` jika PHP belum tersedia secara global di system PATH.
