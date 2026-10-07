# Cara Deploy ocrnerverify ke Online

Panduan menghosting aplikasi supaya bisa diakses lewat internet (untuk demo sidang / dibagikan ke dosen).

## Arsitektur Hosting

| Bagian | Layanan | Status |
|---|---|---|
| Frontend React (Vite) | **Vercel** | gratis, sudah ada `vercel.json` |
| Backend Laravel (API) | **Render** | free tier, sudah ada `backend/Dockerfile` + `render.yaml` |
| OCR-NER FastAPI | — | **belum di-host**, backend pakai mode mock |
| Source code | **GitHub** | https://github.com/InDragovich/SIM-LPU |

Urutan deploy: **Render dulu** (karena frontend butuh URL backend), baru Vercel.

> **Catatan free tier Render:** web service gratis *sleep* setelah ~15 menit tanpa trafik, jadi akses pertama setelah idle butuh ~30-50 detik untuk "bangun" (cold start). Ini normal, bukan error. Render juga tidak kasih persistent disk di free tier, jadi perilaku SQLite sama seperti di Railway dulu: reset ke seeder tiap redeploy/restart (disengaja, lihat catatan di Langkah 1.5).

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

## Langkah 1 — Deploy Backend ke Render

### 1.1 Buat Web Service

1. Buka https://render.com → login pakai akun GitHub
2. **New → Web Service** → connect repo `InDragovich/SIM-LPU`
3. Render akan mendeteksi `render.yaml` di root dan menawarkan **Apply Blueprint** — pilih itu (lebih cepat daripada isi manual). Kalau tidak muncul, lanjut isi manual di langkah berikut.

### 1.2 Set Root Directory & Runtime (kalau isi manual)

Repo ini monorepo (frontend di root, Laravel di `backend/`):

- **Root Directory** → `backend`
- **Runtime** → `Docker` (Render otomatis pakai `backend/Dockerfile`, tidak ada runtime PHP native)
- **Plan** → `Free`

### 1.3 Set Environment Variables

Buka tab **Environment**, tambahkan:

```
APP_NAME=ocrnerverify
APP_ENV=production
APP_DEBUG=false
APP_KEY=<generate, lihat di bawah>
APP_URL=https://<nama-service>.onrender.com

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

### 1.4 Catat domain publik

Render otomatis kasih domain `https://<nama-service>.onrender.com` begitu deploy pertama selesai — lihat di bagian atas halaman service. Tidak perlu generate manual seperti Railway.

### 1.5 Cek deploy berhasil

Render build image dari `backend/Dockerfile`, lalu jalankan `CMD`-nya:

```
touch /app/storage/database.sqlite && php artisan migrate --force && php artisan db:seed --force && php artisan serve --host=0.0.0.0 --port=$PORT
```

Lihat tab **Logs** — harus muncul build Docker selesai, migrasi jalan, seeder jalan, lalu server listening. Tes di browser:

```
https://<url-render>/api/...
```

> **Catatan penting soal database:** SQLite di-`touch` saat container start dan **tidak** di-mount ke persistent disk (free tier Render tidak menyediakan itu). Artinya setiap redeploy atau restart, **semua data hilang** dan kembali ke data seeder. Ini disengaja supaya akun demo selalu tersedia. Kalau butuh data persisten, perlu upgrade ke paid plan Render yang mendukung **Persistent Disk** di-mount ke `/app/storage`, lalu hapus `db:seed` dari start command.
>
> **Catatan cold start:** free tier Render *sleep* otomatis setelah ~15 menit tanpa trafik. Request pertama setelah idle akan lambat (~30-50 detik) sebelum container "bangun" — ini normal untuk free tier, bukan bug.

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
VITE_API_BASE_URL=https://<url-render>/api
```

Jangan lupa akhiran `/api`, dan jangan pakai trailing slash.

> Vite membaca env **saat build**, bukan saat runtime. Kalau nilai ini diubah, wajib **Redeploy** — reload browser saja tidak cukup.

### 2.3 Deploy

Klik **Deploy**. Setelah selesai, catat URL-nya, misal `https://sim-lpu.vercel.app`.

---

## Langkah 3 — Sambungkan Keduanya (CORS)

Kembali ke Render → **Environment** → perbarui:

```
FRONTEND_URL=https://sim-lpu.vercel.app
```

Render akan otomatis redeploy. Tanpa langkah ini, login akan gagal dengan error CORS di console browser.

Kalau nanti pakai custom domain atau URL preview Vercel, URL itu juga harus ditambahkan — `config/cors.php` saat ini hanya menerima **satu** origin dari `FRONTEND_URL`.

---

## Langkah 4 — Tes End-to-End

1. Buka URL Vercel
2. Login `verificator` / `password`
3. Buka DevTools → tab Network, pastikan request menuju domain Render dan berstatus 200
4. Coba batch verifikasi — akan jalan dengan hasil mock

Akun demo (semua password `password`): `input_jkt`, `input_medan`, `input_sby`, `input_mks`, `verificator`, `superadmin`.

---

## Update Setelah Deploy

Keduanya auto-deploy dari branch `master`:

```powershell
git push origin master
```

Vercel dan Render akan build ulang otomatis. Ingat, setiap redeploy Render **mereset database** ke data seeder (free tier, tidak ada persistent disk).

---

## Troubleshooting

**CORS error / "blocked by CORS policy"** — `FRONTEND_URL` di Render tidak persis sama dengan URL Vercel. Harus sama termasuk `https://` dan tanpa trailing slash.

**Frontend loading tapi semua API gagal** — cek `VITE_API_BASE_URL` di Vercel. Salah ketik hanya kelihatan setelah redeploy karena nilainya di-bake saat build. Bisa juga karena Render sedang cold start (lihat poin berikutnya).

**Request pertama lambat / timeout** — free tier Render *sleep* setelah idle. Tunggu ~30-50 detik lalu coba lagi; request berikutnya akan cepat selama service masih "awake".

**Refresh halaman jadi 404** — seharusnya sudah tertangani rewrite di `vercel.json`. Kalau muncul, pastikan `vercel.json` ikut ter-commit.

**Render gagal build** — Root Directory belum diisi `backend`, atau Runtime belum di-set ke `Docker`. Pastikan `backend/Dockerfile` ikut ter-commit (cek juga tidak ke-exclude oleh `.dockerignore`).

**500 Internal Server Error** — `APP_KEY` kosong atau salah format. Harus diawali `base64:`. Untuk melihat detail error, set `APP_DEBUG=true` sementara, lalu kembalikan ke `false`.

**Login berhasil tapi data kosong** — seeder gagal jalan. Cek Deploy Logs; start command sengaja pakai `|| echo 'seed skipped'` sehingga kegagalan seeder tidak menghentikan server.

---

## Opsional — Menghosting OCR-NER Service

Ini bagian tersulit dan **tidak wajib** untuk demo. Hambatannya:

1. **Model ~495MB di-gitignore.** Opsi distribusi: upload ke HuggingFace Hub private repo lalu set `NER_MODEL_NAME=<user>/<repo>` + `HF_TOKEN=hf_xxx`, atau mount volume, atau download dari cloud bucket di entrypoint.
2. **Butuh Tesseract + Poppler system-level.** Perlu Dockerfile custom dengan `apt-get install tesseract-ocr tesseract-ocr-ind poppler-utils`.
3. **RAM.** Load IndoBERT butuh ~1–2GB, di atas jatah free tier kebanyakan platform.

Kalau tetap ingin: buat Web Service kedua di Render dengan Root Directory `ocr-ner-service` + Dockerfile custom (RAM ~1-2GB kemungkinan di atas limit free tier 512MB, jadi perlu paid plan), lalu di service backend ubah `OCR_NER_USE_MOCK=false` dan `OCR_NER_API_URL=https://<url-ocr-service>.onrender.com/extract`.

Untuk sidang, rekomendasi saya: **demo OCR asli dari laptop lokal**, dan pakai versi online hanya untuk menunjukkan aplikasi bisa diakses publik.
