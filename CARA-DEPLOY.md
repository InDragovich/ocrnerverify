# Cara Deploy ocrnerverify ke Online

Panduan menghosting aplikasi supaya bisa diakses lewat internet (untuk demo sidang / dibagikan ke dosen).

## Arsitektur Hosting

| Bagian | Layanan | Status |
|---|---|---|
| Frontend React (Vite) | **Vercel** | gratis, sudah ada `vercel.json` |
| Backend Laravel (API) | **Railway** | gratis (trial credit), sudah ada `railway.json` |
| OCR-NER FastAPI | — | **belum di-host**, backend pakai mode mock |
| Source code | **GitHub** | https://github.com/InDragovich/SIM-LPU |

Urutan deploy: **Railway dulu** (karena frontend butuh URL backend), baru Vercel.

> **Penting:** karena OCR-NER service belum online, versi web ini jalan dengan `OCR_NER_USE_MOCK=true`. OCR asli hanya bisa didemokan lokal. Lihat bagian terakhir kalau mau menghosting OCR juga.

---

## Langkah 0 — Push kode terbaru ke GitHub

Kedua platform deploy dari GitHub, jadi apa pun yang belum di-push tidak akan ikut ter-deploy.

```powershell
git add .
git commit -m "chore: siap deploy"
git push origin master
```

---

## Langkah 1 — Deploy Backend ke Railway

### 1.1 Buat project

1. Buka https://railway.app → login pakai akun GitHub
2. **New Project** → **Deploy from GitHub repo** → pilih `InDragovich/SIM-LPU`
3. Railway akan otomatis membaca `railway.json` di root

### 1.2 Set Root Directory ke `backend`

Repo ini monorepo (frontend di root, Laravel di `backend/`), jadi Railway harus diarahkan:

**Settings → Source → Root Directory** → isi `backend`

### 1.3 Set Environment Variables

Buka tab **Variables**, tambahkan:

```
APP_NAME=ocrnerverify
APP_ENV=production
APP_DEBUG=false
APP_KEY=<generate, lihat di bawah>
APP_URL=https://<nama-project>.up.railway.app

DB_CONNECTION=sqlite
DB_DATABASE=/app/storage/database.sqlite

SESSION_DRIVER=database
CACHE_STORE=database
QUEUE_CONNECTION=sync

OCR_NER_USE_MOCK=true

FRONTEND_URL=https://<nama-project>.vercel.app
```

**Cara dapat `APP_KEY`** — jalankan di lokal, salin hasilnya (termasuk prefix `base64:`):

```powershell
cd backend
php artisan key:generate --show
```

`FRONTEND_URL` belum diketahui di tahap ini — isi sementara apa saja, nanti diperbarui setelah Langkah 2. Variabel ini dipakai `config/cors.php` sebagai satu-satunya origin yang diizinkan, jadi **kalau salah, frontend akan kena CORS error**.

### 1.4 Generate domain publik

**Settings → Networking → Generate Domain**. Catat URL-nya, misal `https://sim-lpu-production.up.railway.app`.

### 1.5 Cek deploy berhasil

Railway menjalankan start command dari `railway.json`:

```
touch /app/storage/database.sqlite && php artisan migrate --force && php artisan db:seed --force && php artisan serve --host=0.0.0.0 --port=$PORT
```

Lihat tab **Deploy Logs** — harus muncul migrasi jalan, seeder jalan, lalu server listening. Tes di browser:

```
https://<url-railway>/api/...
```

> **Catatan penting soal database:** SQLite di-`touch` saat container start dan **tidak** di-mount ke volume. Artinya setiap redeploy atau restart, **semua data hilang** dan kembali ke data seeder. Ini disengaja supaya akun demo selalu tersedia. Kalau butuh data persisten, tambahkan Railway Volume di-mount ke `/app/storage` lalu hapus `db:seed` dari start command.

---

## Langkah 2 — Deploy Frontend ke Vercel

### 2.1 Import project

1. Buka https://vercel.com → login pakai GitHub
2. **Add New → Project** → import `InDragovich/SIM-LPU`
3. Root Directory biarkan **root repo** (jangan diubah) — frontend memang ada di root
4. Framework otomatis terdeteksi `Vite` dari `vercel.json`

`.vercelignore` sudah mengecualikan `backend/`, `ocr-ner-service/`, dan `*.md`, jadi build-nya bersih frontend saja.

### 2.2 Set Environment Variable

**Settings → Environment Variables**, tambahkan untuk semua environment:

```
VITE_API_BASE_URL=https://<url-railway>/api
```

Jangan lupa akhiran `/api`, dan jangan pakai trailing slash.

> Vite membaca env **saat build**, bukan saat runtime. Kalau nilai ini diubah, wajib **Redeploy** — reload browser saja tidak cukup.

### 2.3 Deploy

Klik **Deploy**. Setelah selesai, catat URL-nya, misal `https://sim-lpu.vercel.app`.

---

## Langkah 3 — Sambungkan Keduanya (CORS)

Kembali ke Railway → **Variables** → perbarui:

```
FRONTEND_URL=https://sim-lpu.vercel.app
```

Railway akan otomatis redeploy. Tanpa langkah ini, login akan gagal dengan error CORS di console browser.

Kalau nanti pakai custom domain atau URL preview Vercel, URL itu juga harus ditambahkan — `config/cors.php` saat ini hanya menerima **satu** origin dari `FRONTEND_URL`.

---

## Langkah 4 — Tes End-to-End

1. Buka URL Vercel
2. Login `verificator` / `password`
3. Buka DevTools → tab Network, pastikan request menuju domain Railway dan berstatus 200
4. Coba batch verifikasi — akan jalan dengan hasil mock

Akun demo (semua password `password`): `input_jkt`, `input_medan`, `input_sby`, `input_mks`, `verificator`, `superadmin`.

---

## Update Setelah Deploy

Keduanya auto-deploy dari branch `master`:

```powershell
git push origin master
```

Vercel dan Railway akan build ulang otomatis. Ingat, setiap redeploy Railway **mereset database** ke data seeder.

---

## Troubleshooting

**CORS error / "blocked by CORS policy"** — `FRONTEND_URL` di Railway tidak persis sama dengan URL Vercel. Harus sama termasuk `https://` dan tanpa trailing slash.

**Frontend loading tapi semua API gagal** — cek `VITE_API_BASE_URL` di Vercel. Salah ketik hanya kelihatan setelah redeploy karena nilainya di-bake saat build.

**Refresh halaman jadi 404** — seharusnya sudah tertangani rewrite di `vercel.json`. Kalau muncul, pastikan `vercel.json` ikut ter-commit.

**Railway gagal build** — Root Directory belum diisi `backend`. Railpack akan bingung melihat `package.json` di root.

**500 Internal Server Error** — `APP_KEY` kosong atau salah format. Harus diawali `base64:`. Untuk melihat detail error, set `APP_DEBUG=true` sementara, lalu kembalikan ke `false`.

**Login berhasil tapi data kosong** — seeder gagal jalan. Cek Deploy Logs; start command sengaja pakai `|| echo 'seed skipped'` sehingga kegagalan seeder tidak menghentikan server.

---

## Opsional — Menghosting OCR-NER Service

Ini bagian tersulit dan **tidak wajib** untuk demo. Hambatannya:

1. **Model ~495MB di-gitignore.** Opsi distribusi: upload ke HuggingFace Hub private repo lalu set `NER_MODEL_NAME=<user>/<repo>` + `HF_TOKEN=hf_xxx`, atau mount volume, atau download dari cloud bucket di entrypoint.
2. **Butuh Tesseract + Poppler system-level.** Perlu Dockerfile custom dengan `apt-get install tesseract-ocr tesseract-ocr-ind poppler-utils`.
3. **RAM.** Load IndoBERT butuh ~1–2GB, di atas jatah free tier kebanyakan platform.

Kalau tetap ingin: buat service kedua di Railway dengan Root Directory `ocr-ner-service` + Dockerfile custom, lalu di service backend ubah `OCR_NER_USE_MOCK=false` dan `OCR_NER_API_URL=https://<url-ocr-service>/extract`.

Untuk sidang, rekomendasi saya: **demo OCR asli dari laptop lokal**, dan pakai versi online hanya untuk menunjukkan aplikasi bisa diakses publik.
