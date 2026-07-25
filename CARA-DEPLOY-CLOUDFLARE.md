# Menyambungkan OCR-NER Lokal ke Backend Online (Cloudflare Tunnel)

Masalahnya: OCR-NER service tidak bisa di-host di cloud (model ~495MB di-gitignore, butuh Tesseract + Poppler system-level, RAM 1–2GB di atas free tier). Solusinya: **OCR tetap jalan di laptop**, lalu diekspos ke internet lewat Cloudflare Tunnel supaya backend di Railway bisa memanggilnya.

## Arsitektur

```
Browser dosen
    ↓
Vercel            (frontend React)
    ↓  VITE_API_BASE_URL
Railway           (backend Laravel — online 24 jam)
    ↓  OCR_NER_API_URL
Cloudflare Tunnel
    ↓
laptop:5001       (OCR-NER FastAPI — Tesseract, Poppler, model NER, GPU)
```

Hanya OCR service yang di-tunnel. Frontend dan backend sudah punya URL publik sendiri.

**Konsekuensi:** laptop harus menyala dan kedua terminal hidup selama demo. Kalau laptop mati, verifikasi gagal — tapi login dan browsing data tetap jalan karena backend ada di Railway.

---

## Persiapan (sekali saja)

Install cloudflared:

```powershell
winget install --id Cloudflare.cloudflared
```

Tutup dan buka ulang terminal, lalu cek:

```powershell
cloudflared --version
```

---

## Rutinitas Setiap Mau Demo

Ini yang harus diulang **setiap kali laptop restart atau tunnel ditutup**.

### Terminal 1 — Jalankan OCR Service

```powershell
cd ocr-ner-service
python main.py
```

Tunggu sampai model NER selesai di-load dan warm-up inference selesai. Service listening di port **5001**.

### Terminal 2 — Buka Tunnel

```powershell
cloudflared tunnel --url http://localhost:5001
```

Output akan menampilkan URL acak:

```
+--------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at:                  |
|  https://kata-acak-baru.trycloudflare.com                          |
+--------------------------------------------------------------------+
```

**Salin URL itu.** Biarkan terminal terbuka — menutupnya berarti tunnel mati dan URL-nya hilang selamanya.

Tes tembus atau tidak: buka `https://kata-acak-baru.trycloudflare.com/docs` di browser. Kalau muncul Swagger FastAPI, tunnel sudah jalan.

### Langkah 3 — Update Env di Railway

Buka dashboard Railway → project → tab **Variables** → ubah:

```
OCR_NER_API_URL=https://kata-acak-baru.trycloudflare.com/extract
OCR_NER_USE_MOCK=false
```

Dua hal yang sering keliru:

- **Akhiran `/extract` wajib ada.** Nilai ini dibaca [backend/config/ocr_ner.php:4](backend/config/ocr_ner.php:4) sebagai URL endpoint penuh, bukan base URL.
- **Ubah di Railway, bukan di `backend/.env` lokal.** File `.env` lokal harus tetap `http://localhost:5001/extract` — itu dipakai saat kamu menjalankan backend di laptop.

Railway akan redeploy otomatis. Tunggu sampai selesai sebelum mencoba verifikasi.

### Langkah 4 — Tes

Buka URL Vercel → login `verificator` / `password` → jalankan batch verifikasi. Log OCR akan terlihat mengalir di Terminal 1.

---

## Kalau Muncul Error `Could not resolve host`

```
API connection error: cURL error 6: Could not resolve host:
xxxxx.trycloudflare.com
```

Artinya `OCR_NER_API_URL` di Railway masih menunjuk tunnel lama yang sudah mati. **Ini akan terjadi setiap kali laptop restart** — bukan bug, memang sifat quick tunnel.

Perbaikannya: ulangi Rutinitas di atas dari Terminal 1, lalu update URL baru ke Railway.

Kalau butuh demo mendadak dan tunnel bermasalah, set sementara di Railway:

```
OCR_NER_USE_MOCK=true
```

Aplikasi tetap jalan penuh dengan hasil OCR mock — cukup untuk menunjukkan alur, meski bukan hasil asli.

---

## Menghindari URL Berubah Terus

Quick tunnel (`trycloudflare.com`) selalu memberi subdomain acak. Kalau punya domain yang di-manage Cloudflare, URL bisa dibuat permanen:

```powershell
cloudflared tunnel login
cloudflared tunnel create ocrnerverify
cloudflared tunnel route dns ocrnerverify ocr.domainkamu.com
cloudflared tunnel run --url http://localhost:5001 ocrnerverify
```

Setelah itu `https://ocr.domainkamu.com` selalu sama, dan `OCR_NER_API_URL` di Railway cukup di-set sekali seumur hidup. Tanpa domain sendiri, named tunnel tidak bisa dipakai.

---

## Troubleshooting Lain

**`/docs` tidak bisa dibuka lewat URL tunnel** — OCR service belum jalan atau belum selesai load model. Cek Terminal 1.

**Verifikasi timeout** — file dokumen ikut melewati jaringan, jadi lebih lambat dari lokal. Naikkan `OCR_NER_TIMEOUT` di Variables Railway (default 120 detik).

**Tunnel putus di tengah demo** — quick tunnel tidak dijamin stabil. Terminal 2 akan menampilkan error koneksi; jalankan ulang, tapi URL-nya berubah dan Railway harus di-update lagi.

**Hasil OCR kosong padahal tunnel hidup** — kemungkinan Tesseract/Poppler tidak terbaca. Saat startup, `main.py` mencetak path keduanya — periksa output Terminal 1.

---

## Checklist Sebelum Sidang

1. [ ] Terminal 1 jalan, model NER selesai load
2. [ ] Terminal 2 jalan, URL tunnel disalin
3. [ ] `https://<tunnel>/docs` bisa dibuka di browser
4. [ ] `OCR_NER_API_URL` di Railway sudah URL baru **+ `/extract`**
5. [ ] Railway selesai redeploy
6. [ ] Tes satu verifikasi sampai muncul hasil OCR asli
7. [ ] Laptop di-set jangan sleep

Lakukan minimal 30 menit sebelum mulai — redeploy Railway butuh waktu dan kamu tidak mau mengejar ini saat dosen sudah menunggu.
