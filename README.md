# SIM-LPU — Sistem Verifikasi Biaya Rutin

Web application untuk verifikasi dokumen laporan subsidi operasional (biaya rutin) dengan integrasi OCR dan NER.

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Laravel 11 + Sanctum + Queue
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
- 5 Controller: `AuthController`, `VerifikasiController`, `BatchVerifikasiController`, `MockOcrNerController`, `Admin/UserController`
- 5 Form Request: validasi input terstruktur
- 1 Middleware: `EnsureRole` (role-based access control)
- 1 Queue Job: `ProcessVerifikasiJob` (OCR-NER + matching otomatis)
- 3 Service: `OcrNerService`, `MatchingService`, `AuditService`
- Mock OCR-NER API untuk prototype (70% sukses, 20% partial, 10% gagal)
- Database migration: users, verifikasi_biaya_rutin, audit_logs, jobs, cache, personal_access_tokens
- Seeder: 6 user demo + 5 data verifikasi sample
- Queue berbasis database dengan retry 3x dan timeout 120 detik
- Audit trail: login, logout, CRUD, verifikasi otomatis/manual

---

## Prasyarat

1. **Node.js >= 18** + npm — [nodejs.org](https://nodejs.org/)
2. **PHP >= 8.2** + Composer — [getcomposer.org](https://getcomposer.org/)
3. **Git** — [git-scm.com](https://git-scm.com/)
4. **SQLite** (sudah built-in di PHP)

---

## Cara Menjalankan (Lokal)

### 1. Clone Repository

```bash
git clone https://github.com/InDragovich/SIM-LPU.git
cd SIM-LPU
```

### 2. Setup Backend (Laravel)

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
```

### 3. Jalankan Backend

```bash
# Terminal 1 — Laravel server
cd backend
php artisan serve

# Terminal 2 — Queue worker (wajib untuk batch verifikasi)
cd backend
php artisan queue:listen --tries=1
```

### 4. Setup & Jalankan Frontend

```bash
# Terminal 3 — di root project
npm install
npm run dev
```

### 5. Buka Aplikasi

Akses `http://localhost:5173` di browser.

### Akun Demo

| Username | Password | Role | Region |
|----------|----------|------|--------|
| `input_medan` | `password` | Operator | I. MEDAN |
| `input_jkt` | `password` | Operator | Jakarta |
| `input_sby` | `password` | Operator | Surabaya |
| `input_mks` | `password` | Operator | Makassar |
| `verificator` | `password` | Verifikator | — |
| `superadmin` | `password` | Super Admin | — |

---

## Script yang Tersedia

**Frontend:**
- `npm run dev` — Development server (port 5173)
- `npm run build` — Build produksi ke folder `dist`
- `npm run preview` — Preview hasil build
- `npm run lint` — Lint kode dengan ESLint

**Backend:**
- `php artisan serve` — Laravel server (port 8000)
- `php artisan queue:listen` — Queue worker untuk batch processing
- `php artisan migrate --seed` — Jalankan migrasi + data demo

---

## Struktur Project

```
SIM-LPU/
├── src/                              # Frontend React + TypeScript
│   ├── App.tsx                       # Router utama
│   ├── main.tsx                      # Entry point
│   ├── components/
│   │   ├── Header.tsx                # Navbar global
│   │   └── DetailModal.tsx           # Modal detail + keputusan
│   ├── pages/
│   │   ├── LoginPage.tsx             # Halaman login
│   │   ├── DashboardPage.tsx         # Dashboard statistik
│   │   ├── InputDashboard.tsx        # Form input operator
│   │   ├── VerifierDashboard.tsx     # Tabel verifikasi + batch
│   │   └── AdminUsersPage.tsx        # Kelola user (super admin)
│   ├── services/
│   │   ├── api.ts                    # Axios HTTP client
│   │   ├── authService.ts            # Login/logout
│   │   ├── verifikasiService.ts      # CRUD verifikasi + batch
│   │   └── userService.ts            # CRUD user admin
│   ├── data/
│   │   └── constants.ts              # Kategori, bulan, warna status
│   └── utils/
│       └── storage.ts                # Helper localStorage
│
├── backend/                          # Backend Laravel 11
│   ├── app/
│   │   ├── Http/
│   │   │   ├── Controllers/
│   │   │   │   ├── AuthController.php
│   │   │   │   ├── VerifikasiController.php
│   │   │   │   ├── BatchVerifikasiController.php
│   │   │   │   ├── MockOcrNerController.php
│   │   │   │   └── Admin/UserController.php
│   │   │   ├── Middleware/
│   │   │   │   └── EnsureRole.php
│   │   │   └── Requests/              # 5 Form Request validasi
│   │   ├── Jobs/
│   │   │   └── ProcessVerifikasiJob.php
│   │   ├── Models/
│   │   │   ├── User.php
│   │   │   ├── VerifikasiBiayaRutin.php
│   │   │   └── AuditLog.php
│   │   └── Services/
│   │       ├── OcrNerService.php      # Integrasi API OCR-NER
│   │       ├── MatchingService.php    # Pencocokan data
│   │       └── AuditService.php       # Audit trail
│   ├── config/
│   │   └── ocr_ner.php               # Konfigurasi API OCR-NER
│   ├── database/
│   │   ├── migrations/                # 6 migration files
│   │   └── seeders/                   # User + data demo
│   └── routes/
│       └── api.php                    # 15+ API endpoints
│
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md
```

---

## Konfigurasi Environment

**Frontend** (`.env` di root):
```
VITE_API_BASE_URL=http://localhost:8000/api
```

**Backend** (`.env` di `backend/`):
```
OCR_NER_API_URL=http://localhost:8000/api/mock/ocr-ner
OCR_NER_USE_MOCK=true
QUEUE_CONNECTION=database
FRONTEND_URL=http://localhost:5173
```
