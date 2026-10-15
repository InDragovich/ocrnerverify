# Changelog

Version history of ocrnerverify (formerly SIM-LPU).

## Unreleased

- Added two public demo accounts (`demo_operator`, `demo_verifikator`) with one-click fill on the login page.
- Staff account passwords are now read from `SEED_PASSWORD`; the default `password` works only in a local environment.
- Limited login to 5 attempts per minute.
- Rewrote the README in English; guides renamed to `RUNNING.md`, `DEPLOYMENT.md` and `DEPLOYMENT-CLOUDFLARE.md` (formerly `CARA-*.md`) and translated.
- Added the MIT license.

## v1.8.0 — Regional Master Data, Verifier Placement, "Needs Review" Status (2026-07-25)

**"Needs Review" status (`menunggu_review`):**
- Automatic verification results are **no longer finalized unilaterally** when there is a mismatch. All fields match → `selesai` + `sesuai` (auto-approved); any field differs → `menunggu_review` + `tidak_sesuai`, which a verifier must review.
- `verifikator_id` and `verified_at` are left empty for system decisions; human attribution is filled only on a manual decision.
- Table badges and the status filter follow the combination of `status_verifikasi` + `hasil_kesesuaian`: Waiting, Processing, **Needs Review**, Matched, Not Matched, Undetermined, Failed.
- Technical errors (OCR service down, unreadable file) remain `gagal`, separate from data mismatches.

**Pos Indonesia regional master data:**
- `backend/config/wilayah.php`: the 6 official regionals (Medan, Jakarta, Bandung, Semarang, Surabaya, Makassar) plus an alias table for old names.
- The verification dashboard **always shows all six regionals**, including those without documents (value 0, grey "No Documents" badge). Previously the list came from a `GROUP BY`, so empty regionals were missing.
- Migration `2026_07_25_000001_normalize_regional_names` normalizes old data (`I. MEDAN`→Medan, `Banten`→Jakarta, `kediri`→Surabaya, capitalization fixes) in both the document table **and** user profiles.
- The Region field in user management is now a dropdown, enforced on the server with `Rule::in`, so free text is no longer accepted.

**Verifier placement:**
- A super admin can place verifiers by **Region / KCU / KPC**. An empty field means "all" at that level (all empty = cross-region access).
- `User::wilayahScope()` is the single source of the restriction. It is applied in `index()`, `summary()` and `stats()`, and as a 403 rejection in `show()` and `keputusan()`.
- `BatchVerifikasiController::store()` and `status()` are filtered too, so the restriction cannot be bypassed by posting IDs directly.
- The regional level of `summary()` automatically narrows to the verifier's placement.

**Verifier dashboard UX:**
- Filters appear only at the document level. The regional, KCU and KPC levels no longer show a filter bar.
- **Automatic verification without ticking rows:** with no selection, the button processes all unverified documents within the current scope and filters (across pages). With a selection, the old behavior still applies.

**Changed files:**
- `backend/config/wilayah.php`, `backend/database/migrations/2026_07_25_000001_normalize_regional_names.php`: new.
- `backend/app/Models/User.php`: `wilayahScope()`.
- `backend/app/Http/Controllers/VerifikasiController.php`, `BatchVerifikasiController.php`: regional scoping and master regional list.
- `backend/app/Http/Requests/StoreUserRequest.php`, `UpdateUserRequest.php`: region validation.
- `backend/app/Jobs/ProcessVerifikasiJob.php`: `menunggu_review` status.
- `backend/database/seeders/VerifikasiSeeder.php`, `UserSeeder.php`: canonical regional names.
- `src/data/constants.ts`: `REGIONALS`.
- `src/pages/VerifierDashboard.tsx`, `src/pages/AdminUsersPage.tsx`, `src/services/verifikasiService.ts`.
- Run and deploy guides (now `RUNNING.md`, `DEPLOYMENT.md`, `DEPLOYMENT-CLOUDFLARE.md`).

## v1.7.0 — Real OCR Pipeline, Fine-tuned NER, Rebrand to "ocrnerverify" (2026-06-12)

**Rebranding:**
- The application was renamed from "SIM-LPU" to **ocrnerverify** everywhere it is visible: navbar (`Header.tsx`), browser tab title (`index.html`), FastAPI Swagger docs (`main.py`) and the README title.

**OCR pipeline, full rewrite (ported from the research notebook):**
- **Digital PDF bypass:** PDFs with a text layer are extracted directly with `pdftotext` (Poppler). OCR is skipped entirely, giving about 0% error and much faster processing.
- **Dynamic PSM per category:** `listrik=4`, `air=3`, `telepon=4` (from the `kategori` form field). Automatic fallback to PSM 3 when the main result has fewer than 100 alphanumeric characters.
- **OSD and skew correction:** Tesseract orientation detection with a fallback that compares normal versus 180° confidence, then skew correction by projection profile (search −15° to +15°).
- **Adaptive resize:** a Tesseract probe estimates the median character height; images are upscaled when it is under 25 px (target 30 px, max 3×).
- **Bilateral filter denoising** (edge-preserving, replacing Gaussian).
- **Black Top-Hat watermark suppression** with a scale-adaptive elliptical kernel (7/9/15/25/21 px depending on resolution).
- **Otsu binarization** after BlackHat.
- **Per-token confidence filter:** drops non-alphanumeric tokens with confidence under 50 and scrubs blacklisted characters (`$`, `@`, `¢`, and so on).
- **Garbage line removal** with 4 rules (previously 3).

**OCR output, new schema (per Table IV-10):**
- The OCR module now returns a 4-field dict: `nama_dokumen`, `metode_ekstraksi` (`"OCR"` / `"Teks PDF"`), `teks_ekstraksi`, `waktu_pemrosesan`.
- The `/extract` API response gains an `ocr` field (OCR details) and `waktu_total` (OCR + NER).
- The top-level `text_ocr` is kept as an alias of `ocr.teks_ekstraksi` for backward compatibility.

**NER, switched to a fine-tuned model:**
- The old generic model `cahya/bert-base-indonesian-NER` (labels ORG/DAT/MON) was **replaced** by the fine-tuned `ner_indobert_p2_best` (BertForTokenClassification, labels `B/I-KATEGORI`, `B/I-PERIODE`, `B/I-NOMINAL`).
- Extraction logic is simpler: aggregation strategy "simple" directly yields `KATEGORI` / `PERIODE` / `NOMINAL` entity groups, with no ORG→category mapping.
- Normalization ported from `Notebook 2 — Demo (rev2)`: `_normalize_period` (supports `MEI 2025`, `10/2025`, `15-10-2025`, `OKT24`, and the typo `OKOTBER`→`OKTOBER`), `_normalize_rupiah` (digit extraction), and `_map_category_from_text` via `CATEGORY_PATTERNS` regexes.
- The model file (about 495 MB safetensors) lives in `ocr-ner-service/models/ner_indobert/` and is **git-ignored** because of its size.
- Default `NER_MODEL_NAME=./models/ner_indobert` (local). Override with a Hugging Face Hub repo id for cloud deployment.

**Categories, simplified:**
- Removed the **"Kebersihan"** category (unused).
- Renamed **"Air/Gas"** to **"Air dan Gas"** (matches the NER output).
- Final list: `Listrik`, `Telepon`, `Air dan Gas`.
- Updated files: `constants.ts`, `mockData.ts`, `KeputusanRequest.php`, `OcrNerService.php`, `MockOcrNerController.php`, `VerifikasiSeeder.php`.

**Operator, read-only detail:**
- `DetailModal` gains a `readOnly?: boolean` prop. When true, the "Keputusan" tab is hidden.
- The "My Data" table in `InputDashboard` gains an **Eye** button in the Actions column that opens the detail in read-only mode: attachment, OCR text and NER entity comparison, without saving decisions or correcting entities.

**Changed files:**
- `ocr-ner-service/ocr/extractor.py`: full OCR pipeline rewrite.
- `ocr-ner-service/ner/extractor.py`: rewrite for the fine-tuned model and notebook normalization.
- `ocr-ner-service/main.py`: new response schema (`OcrOutputSchema`, `waktu_ocr`, `waktu_total`).
- `ocr-ner-service/.gitignore`: excludes `models/`.
- `src/components/Header.tsx`, `index.html`, `README.md`: rebrand title.
- `src/components/DetailModal.tsx`: `readOnly` prop.
- `src/pages/InputDashboard.tsx`: Eye button and read-only DetailModal.

## v1.6.1 — Verification Status Badge in the Verifier Table (2026-04-15)

**UI change:**
- The "Verifikasi" column (previously showing the NER amount) in the VerifierDashboard document-level table was replaced by a **"Status Verifikasi"** colored badge column.
- Statuses: **Matched** (green), **Not Matched** (red), **Undetermined** (grey), **Processing** (indigo, spinner), **Failed** (red), **Waiting** (yellow).
- Purpose: let verifiers see each document's status at a glance without opening the detail.

**Changed files:**
- `src/pages/VerifierDashboard.tsx`: the NER amount column now renders the verification status badge.

## v1.6.0 — Dashboard Drill-Down and OCR/NER Refactoring (2026-03-10)

**New feature, verifier drill-down dashboard:**
- The verifier dashboard now shows a **4-level drill-down hierarchy**: Regional → KCU → KPC → Document.
- Levels 1 to 3 show a **summary table** (SummaryTable) with name, number of sub-units, total documents, total cost, progress bar and verification status.
- Click a row to go one level down; use the **breadcrumb** to go back up.
- The **Year** and **Quarter** filters are global (applied at every level) and reset to level 1 when changed.
- The **Category** and **Status** filters appear only at level 4 (documents).

**Backend, new endpoint:**
- `GET /api/verifikasi/summary`: aggregate data grouped by `regional` / `kcu` / `kpc` (total_dokumen, total_biaya, selesai, menunggu, gagal, jumlah_sub).
- Extra `regional`, `kcu` and `kpc` filters on the verification list endpoint.

**Bug fix:**
- Fixed the period display in the OCR comparison tab: it now shows "Month Year" (previously only the month).

**OCR/NER service, refactoring v2.0.0:**
- Simpler structure: removed `config.py`, `ner/model.py`, `ocr/preprocessor.py`, `schemas/` and `start.bat`.
- Model loading and NER extraction merged into `ner/extractor.py` (singleton pipeline).
- OCR preprocessing merged into `ocr/extractor.py`.
- Response schemas inlined into `main.py`.
- Configuration now comes directly from `os.environ` (no pydantic settings).
- Simpler env vars: dropped the `OCR_NER_` prefix; all are optional (auto-detected).
- The service now starts with just `python main.py` (no `start.bat`).

## v1.5.0 — Period Matching Fix, Quarter Auto-Sync, Verifier Entity Correction (2026-02-24)

**Bug fix:**
- Fixed OCR/NER period matching: input data is now "Month Year" (combined `periode` + `tahun`) so it matches the NER result. Before, the input was only "Oktober" versus NER "Oktober 2025", so it never matched.

**New features:**
- Period → quarter auto-sync in the operator form: choosing a month fills the quarter automatically (Jan–Mar → Q1, Apr–Jun → Q2, Jul–Sep → Q3, Oct–Dec → Q4). The quarter field is disabled to prevent inconsistent input.
- Verifiers can correct the OCR/NER **category** and **period** through dropdowns in the Keputusan tab (previously only the amount could be corrected).

**Technical changes:**
- `constants.ts`: added the `getTriwulan(month)` helper, which computes the quarter from the month index.
- `InputDashboard.tsx`: Period and Quarter fields swapped; the quarter is auto-calculated and disabled.
- `DetailModal.tsx`: added editable OCR/NER Category and Period dropdowns in the summary.
- `ProcessVerifikasiJob.php`: combines `periode + tahun` when sending to the matching service.
- `KeputusanRequest.php`: added validation for `koreksi_entitas.kategori` and `koreksi_entitas.periode`.

## v1.4.0 — Real OCR/NER Microservice (2026-02-19)

**New feature, FastAPI OCR/NER microservice:**
- Replaced the mock OCR/NER with a real implementation using **Tesseract OCR** and **IndoBERT NER**.
- Separate microservice in `ocr-ner-service/` (FastAPI, port 5001).
- The microservice runs locally at `localhost:5001`.

**OCR pipeline (Tesseract):**
- PDF → image conversion (pdf2image, 300 DPI).
- Preprocessing: orientation/skew correction, grayscale, adaptive noise removal.
- Text extraction: Tesseract OCR (PSM 3, OEM 3, Indonesian + English).
- Post-processing: garbage line removal.

**NER pipeline (IndoBERT):**
- Model: `cahya/bert-base-indonesian-NER` (Hugging Face).
- Entity extraction: ORG → category, DAT → period, MON → amount.
- Preprocessing: move amount lines to the top for better MON accuracy.
- Similarity scoring of the amount against the user's input.
- GPU (CUDA) support for fast inference.

**Backend changes:**
- `OcrNerService.php`: forwards the user's input (category, period, amount) to FastAPI.
- `config/ocr_ner.php`: default URL `localhost:5001/extract`, 120 s timeout.
- `.env`: `OCR_NER_USE_MOCK=false`, `OCR_NER_API_URL=http://localhost:5001/extract`.

**New files:**
- `ocr-ner-service/main.py`: FastAPI `POST /extract` endpoint.
- `ocr-ner-service/ocr/preprocessor.py`: image preprocessing pipeline.
- `ocr-ner-service/ocr/extractor.py`: Tesseract OCR extraction.
- `ocr-ner-service/ner/model.py`: singleton IndoBERT model loader.
- `ocr-ner-service/ner/extractor.py`: NER entity extraction and verification.
- `ocr-ner-service/start.bat`: Windows startup script.

## v1.3.0 — Automatic Verification Fix, Manual Decision, Amount Correction (2025-02-09)

**Bug fixes:**
- Fixed an automatic verification deadlock: mock OCR is now processed in-process instead of through an HTTP request to the server itself, which hung on the single-threaded Windows dev server.
- Fixed batch verify: `dispatchSync` with a try/catch per job, so one failed item no longer stops the whole batch.
- Fixed seeded data that could not be verified because the attachment file was missing from storage: mock mode now skips the file check.
- Fixed items stuck in the "processing" status: they can now be selected and processed again.
- Fixed the manual decision not reacting: error messages from the backend response are now displayed.
- Added a "Processing..." label in the Verification column while a batch runs.

**New features:**
- OCR amount correction: verifiers can edit the OCR/NER amount in the Keputusan tab before saving a decision (through the `koreksi_entitas` field).
- A comparison summary (reported vs OCR amount) with a match/mismatch indicator in the Keputusan tab.
- A success or error message is shown after a batch verification finishes.

**Mock OCR improvements:**
- Amount: 70% exact match, 20% small difference (±1–10%), 10% completely different.
- Category: always matches the input.
- Period: 80% match, 20% different month.

**Architecture changes:**
- A queue worker (`php artisan queue:listen`) is **no longer needed**: batch verification is processed synchronously within the request.
- Mock OCR logic moved from `MockOcrNerController` (HTTP) to `OcrNerService` (in-process) when `OCR_NER_USE_MOCK=true`.
- Frontend polling was removed (results are returned directly after processing).

## v1.2.1 — Inline Attachment Viewer (2025-02-09)

- New `LampiranViewer` component: preview attachments directly in the modal without opening a new tab.
- Supported formats: PDF (iframe), JPG/PNG/GIF/WebP images (`<img>`), DOCX (`docx-preview`), XLSX/XLS (SheetJS → HTML table).
- Files are fetched through axios with the auth token and shown from a blob.
- "Open in new tab" fallback for unsupported formats.
- New dependencies: `docx-preview`, `xlsx` (SheetJS).
- docx-preview and XLSX table styling in `index.css`.

## v1.2.0 — UI/UX Revision and Audit Logs (2025-02-09)

**Frontend:**
- Renamed table columns: "Kategori" → "Nama Rekening", "Nominal" → "Pelaporan".
- Added a "Verifikasi" column (NER amount result) with status colors:
  - Grey: not yet verified
  - Green: reported = verified (amount matches)
  - Red: reported ≠ verified (amount differs)
- Removed the "Lampiran", "Status" and "Kesesuaian" columns from the table (the information is in the detail modal).
- Merged the "Air" and "Gas" categories into "Air/Gas".
- New page: `AuditLogPage`, the user activity history (super admin only).
- `Header` update: role-based navigation with an active state and responsive mobile navigation.
- DataTable-style layout: show entries, search and pagination in all tables.
- Fixed attachment preview (images and PDF) in the detail modal.

**Backend:**
- Added `AuditLogController`: audit log list with filters and pagination.
- Added the `AuthenticateFromQuery` middleware: fixes attachment preview (token via query parameter).
- Seeder update: category "Air" → "Air/Gas".

## v1.1.0 — Full-Stack Integration (2025-02-08)

**Frontend (modified):**
- Authentication through Laravel Sanctum (Bearer token).
- Service layer: `api.ts`, `authService.ts`, `verifikasiService.ts`, `userService.ts`.
- New pages: `DashboardPage` (statistics), `AdminUsersPage` (user management).
- New component: `DetailModal` (data detail, OCR/NER results and manual decision).
- Data constants: categories, months, status colors.
- `LoginPage` update: navigation by role.
- `InputDashboard` update: input form, operator CRUD and attachment upload.
- `VerifierDashboard` update: filters, automatic batch verification, progress bar and polling.
- `Header` update: role badge and per-role navigation.
- `App.tsx` update: complete routing with role-based access.

**Backend (new):**
- Laravel 11 project with Sanctum authentication.
- 3 models: `User`, `VerifikasiBiayaRutin`, `AuditLog`.
- 6 controllers: `AuthController`, `VerifikasiController`, `BatchVerifikasiController`, `MockOcrNerController`, `AuditLogController`, `Admin/UserController`.
- 5 form requests: structured input validation.
- 2 middleware: `EnsureRole` (role-based access) and `AuthenticateFromQuery` (token as a query parameter).
- 1 queue job: `ProcessVerifikasiJob` (OCR/NER and automatic matching).
- 3 services: `OcrNerService`, `MatchingService`, `AuditService`.
- Mock OCR/NER API for the prototype (70% success, 20% partial, 10% failed).
- Database migrations: users, verifikasi_biaya_rutin, audit_logs, jobs, cache, personal_access_tokens.
- Seeder: 6 demo users and 5 sample verification records.
- Database-backed queue with 3 retries and a 120 s timeout.
- Audit trail: login, logout, CRUD, automatic and manual verification.

## v1.0.0 — Initial Frontend (2025-02-05)

- React + Vite + Tailwind CSS project setup.
- Login, Operator Input and Verifier Dashboard pages (initial look).
- `Header` component.
- Initial README with setup instructions.
