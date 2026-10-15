# Changelog

Riwayat perubahan ocrnerverify (sebelumnya SIM-LPU).

### v1.8.0 — Master Regional, Penempatan Wilayah Verifikator, Status "Perlu Ditinjau" (2026-07-25)

**Status "Perlu Ditinjau" (`menunggu_review`):**
- Hasil verifikasi otomatis **tidak lagi difinalkan sepihak** saat ada ketidaksesuaian. Cocok semua field → `selesai` + `sesuai` (auto-approve); ada field tidak cocok → `menunggu_review` + `tidak_sesuai`, wajib ditinjau verifikator.
- `verifikator_id` dan `verified_at` dikosongkan untuk keputusan hasil sistem — atribusi manusia hanya diisi saat keputusan manual.
- Badge tabel & filter status mengikuti kombinasi `status_verifikasi` + `hasil_kesesuaian`: Menunggu, Diproses, **Perlu Ditinjau**, Sesuai, Tidak Sesuai, Belum Ditentukan, Gagal.
- Error teknis (OCR service mati, file tak terbaca) tetap `gagal`, terpisah dari ketidaksesuaian data.

**Master Regional Pos Indonesia:**
- `backend/config/wilayah.php` — daftar 6 regional resmi (Medan, Jakarta, Bandung, Semarang, Surabaya, Makassar) + tabel alias nama lama.
- Dashboard verifikasi **selalu menampilkan keenam regional**, termasuk yang belum punya dokumen (nilai 0, badge abu-abu "Belum Ada Dokumen"). Sebelumnya daftar hanya hasil `GROUP BY` sehingga regional kosong tidak muncul.
- Migrasi `2026_07_25_000001_normalize_regional_names` menyeragamkan data lama (`I. MEDAN`→Medan, `Banten`→Jakarta, `kediri`→Surabaya, perbaikan kapitalisasi) di tabel dokumen **dan** profil user.
- Field Region pada manajemen user jadi dropdown, dikunci di server via `Rule::in` — tidak bisa lagi diisi teks bebas.

**Penempatan Wilayah Verifikator:**
- Super admin dapat menempatkan verifikator per **Region / KCU / KPC**. Kolom yang dikosongkan berarti "semua" pada level tersebut (kosong semua = akses lintas wilayah).
- `User::wilayahScope()` jadi sumber tunggal batasan; diterapkan di `index()`, `summary()`, `stats()`, serta sebagai penolakan 403 di `show()` dan `keputusan()`.
- `BatchVerifikasiController::store()` dan `status()` ikut tersaring agar tidak bisa ditembus lewat kiriman ID langsung.
- Level regional pada `summary()` otomatis menyusut ke wilayah penempatan verifikator.

**Dashboard Verifikator — UX:**
- Filter hanya tampil di level dokumen. Level regional/KCU/KPC tidak lagi menampilkan bar filter.
- **Verifikasi Otomatis tanpa perlu mencentang**: tanpa seleksi, tombol memproses seluruh dokumen yang belum terverifikasi pada scope + filter aktif (lintas halaman). Dengan seleksi, perilaku lama tetap berlaku.

**File Berubah:**
- `backend/config/wilayah.php`, `backend/database/migrations/2026_07_25_000001_normalize_regional_names.php` — baru.
- `backend/app/Models/User.php` — `wilayahScope()`.
- `backend/app/Http/Controllers/VerifikasiController.php`, `BatchVerifikasiController.php` — scoping wilayah + daftar master regional.
- `backend/app/Http/Requests/StoreUserRequest.php`, `UpdateUserRequest.php` — validasi region.
- `backend/app/Jobs/ProcessVerifikasiJob.php` — status `menunggu_review`.
- `backend/database/seeders/VerifikasiSeeder.php`, `UserSeeder.php` — nama regional kanonik.
- `src/data/constants.ts` — `REGIONALS`.
- `src/pages/VerifierDashboard.tsx`, `src/pages/AdminUsersPage.tsx`, `src/services/verifikasiService.ts`.
- `CARA-MENJALANKAN.md`, `CARA-DEPLOY.md`, `CARA-DEPLOY-CLOUDFLARE.md` — panduan menjalankan & deploy.

### v1.7.0 — Real OCR Pipeline, Fine-tuned NER, Rebrand "ocrnerverify" (2026-06-12)

**Rebranding:**
- Nama aplikasi diubah dari "SIM-LPU" menjadi **ocrnerverify** di seluruh tampilan: navbar (`Header.tsx`), title browser tab (`index.html`), FastAPI Swagger docs (`main.py`), dan judul README. Nama folder & repo GitHub tetap `SIM-LPU` (identifier teknis saja, tidak terlihat user).

**OCR Pipeline — Total Rewrite (port dari notebook penelitian):**
- **PDF Digital bypass**: PDF dengan text-layer di-extract langsung via `pdftotext` (Poppler). Skip OCR penuh → ~0% error rate, jauh lebih cepat.
- **PSM dinamis per kategori**: `listrik=4`, `air=3`, `telepon=4` (dari `kategori` form). Fallback PSM 3 otomatis kalau hasil utama < 100 alnum.
- **OSD + Skew correction**: orientation detection Tesseract + fallback bandingkan confidence normal vs 180°, lalu skew correction via projection profile (search −15° s.d. +15°).
- **Adaptive resize**: probe Tesseract estimasi median tinggi karakter; upscale kalau < 25px (target 30px, max 3×).
- **Bilateral filter denoise** (edge-preserving, ganti Gaussian).
- **Black Top-Hat watermark suppression**: kernel ellipse skala-adaptif (7/9/15/25/21 px berdasarkan resolusi).
- **Otsu binarization** setelah BlackHat.
- **Confidence filter** per token: drop token non-alfanumerik dengan conf < 50, scrub karakter blacklist (`$`, `@`, `¢`, dll).
- **Garbage line removal** 4 aturan (sebelumnya 3).

**OCR Output — Schema Baru (sesuai Tabel IV-10):**
- Modul OCR sekarang return dict 4 field: `nama_dokumen`, `metode_ekstraksi` (`"OCR"` / `"Teks PDF"`), `teks_ekstraksi`, `waktu_pemrosesan`.
- Response API `/extract` tambah field `ocr` (detail OCR) + `waktu_total` (OCR + NER).
- Top-level `text_ocr` dipertahankan sebagai alias `ocr.teks_ekstraksi` (backward compat).

**NER — Ganti ke Model Fine-tuned:**
- Model lama `cahya/bert-base-indonesian-NER` (generic, label ORG/DAT/MON) **diganti** dengan model fine-tuned `ner_indobert_p2_best` (BertForTokenClassification, label `B/I-KATEGORI`, `B/I-PERIODE`, `B/I-NOMINAL`).
- Logika ekstraksi disederhanakan: aggregation_strategy "simple" langsung keluar entity group `KATEGORI` / `PERIODE` / `NOMINAL` — tidak perlu mapping ORG→kategori dll.
- Normalisasi port dari `Notebook 2 — Demo (rev2)`: `_normalize_period` (dukung `MEI 2025`, `10/2025`, `15-10-2025`, `OKT24`, typo `OKOTBER`→`OKTOBER`), `_normalize_rupiah` (extract digit), `_map_category_from_text` via `CATEGORY_PATTERNS` regex.
- Model file (~495MB safetensors) di `ocr-ner-service/models/ner_indobert/` — **di-gitignore** karena terlalu besar.
- Default `NER_MODEL_NAME=./models/ner_indobert` (lokal). Override dengan HuggingFace Hub repo id kalau mau deploy via cloud.

**Kategori — Simplifikasi:**
- Hapus kategori **"Kebersihan"** (tidak dipakai).
- Rename **"Air/Gas"** → **"Air dan Gas"** (match output NER).
- Daftar final: `Listrik`, `Telepon`, `Air dan Gas`.
- File ter-update: `constants.ts`, `mockData.ts`, `KeputusanRequest.php`, `OcrNerService.php`, `MockOcrNerController.php`, `VerifikasiSeeder.php`.

**Operator — View-Only Detail:**
- `DetailModal` tambah prop `readOnly?: boolean`. Saat true, tab "Keputusan" disembunyikan.
- Tabel "Daftar Data Saya" di `InputDashboard` tambah tombol **Eye** (👁) di kolom Aksi — buka detail dalam mode read-only: lihat lampiran + teks OCR + perbandingan entitas NER, tanpa bisa simpan keputusan atau koreksi entitas.

**File Berubah:**
- `ocr-ner-service/ocr/extractor.py` — rewrite pipeline OCR penuh.
- `ocr-ner-service/ner/extractor.py` — rewrite untuk model fine-tuned + normalisasi notebook.
- `ocr-ner-service/main.py` — schema response baru (`OcrOutputSchema`, `waktu_ocr`, `waktu_total`).
- `ocr-ner-service/.gitignore` — exclude `models/`.
- `ocr-ner-service/models/ner_indobert/` — folder baru (lokal, tidak di-commit).
- `src/components/Header.tsx`, `index.html`, `README.md` — rebrand title.
- `src/components/DetailModal.tsx` — prop `readOnly`.
- `src/pages/InputDashboard.tsx` — tombol Eye + DetailModal read-only.

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

### v1.6.1 — Badge Status Verifikasi di Tabel Verifier (2026-04-15)
**Perubahan UI:**
- Kolom "Verifikasi" (sebelumnya menampilkan nominal NER) di tabel VerifierDashboard level dokumen diganti menjadi kolom **"Status Verifikasi"** berupa badge berwarna
- Status yang ditampilkan: **Sesuai** (hijau), **Tidak Sesuai** (merah), **Belum Ditentukan** (abu), **Diproses** (indigo, spinner), **Gagal** (merah), **Menunggu** (kuning)
- Tujuan: memudahkan verifier melihat ringkasan status tiap dokumen tanpa perlu membuka detail

**File Berubah:**
- `src/pages/VerifierDashboard.tsx` — ganti render kolom nominal NER jadi badge status verifikasi
