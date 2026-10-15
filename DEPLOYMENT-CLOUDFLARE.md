# Connecting a Local OCR/NER Service to the Online Backend (Cloudflare Tunnel)

The problem: the OCR/NER service cannot easily be hosted in the cloud (the roughly 495 MB model is git-ignored, it needs Tesseract and Poppler at system level, and it needs 1 to 2 GB of RAM, above most free tiers). The solution: **keep OCR running on your laptop** and expose it to the internet through a Cloudflare Tunnel, so the backend on Render can call it.

## Architecture

```
Visitor's browser
    ↓
Vercel            (React frontend)
    ↓  VITE_API_BASE_URL
Render            (Laravel backend, online all the time)
    ↓  OCR_NER_API_URL
Cloudflare Tunnel
    ↓
laptop:5001       (OCR/NER FastAPI: Tesseract, Poppler, NER model, GPU)
```

Only the OCR service goes through the tunnel. The frontend and backend already have their own public URLs.

**Consequence:** the laptop must stay on, with both terminals running, for the whole demo. If the laptop is off, verification fails, but logging in and browsing data still work because the backend is on Render.

---

## Preparation (once)

Install cloudflared:

```powershell
winget install --id Cloudflare.cloudflared
```

Close and reopen the terminal, then check:

```powershell
cloudflared --version
```

---

## Routine Before Each Demo

Repeat this **every time the laptop restarts or the tunnel is closed**.

### Terminal 1: Start the OCR service

```powershell
cd ocr-ner-service
python main.py
```

Wait until the NER model has loaded and the warm-up inference has finished. The service listens on port **5001**.

### Terminal 2: Open the tunnel

```powershell
cloudflared tunnel --url http://localhost:5001
```

The output shows a random URL:

```
+--------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at:                  |
|  https://random-words-here.trycloudflare.com                       |
+--------------------------------------------------------------------+
```

**Copy that URL.** Keep the terminal open: closing it stops the tunnel and the URL is gone for good.

To check that it works, open `https://random-words-here.trycloudflare.com/docs` in a browser. If the FastAPI Swagger page appears, the tunnel is up.

### Step 3: Update the environment on Render

Open the Render dashboard, go to the service, open **Environment**, and change:

```
OCR_NER_API_URL=https://random-words-here.trycloudflare.com/extract
OCR_NER_USE_MOCK=false
```

Two things are often gotten wrong:

- **The `/extract` ending is required.** The backend reads this value as the full endpoint URL, not a base URL (see [backend/config/ocr_ner.php:4](backend/config/ocr_ner.php:4)).
- **Change it on Render, not in the local `backend/.env`.** The local `.env` should stay `http://localhost:5001/extract`, which is what you use when running the backend on your laptop.

Render redeploys automatically. Wait for it to finish before trying a verification. Note that a redeploy also resets the database to the seeder data.

### Step 4: Test

Open the Vercel URL, log in as `demo_verifikator` (password `demo1234`), and run a batch verification. The OCR log should scroll by in Terminal 1.

---

## If You See `Could not resolve host`

```
API connection error: cURL error 6: Could not resolve host:
xxxxx.trycloudflare.com
```

This means `OCR_NER_API_URL` on Render still points to an old tunnel that is gone. **It happens every time the laptop restarts.** It is not a bug; it is how quick tunnels work.

The fix: repeat the routine above from Terminal 1, then put the new URL on Render.

If you need a demo right away and the tunnel is not cooperating, temporarily set this on Render:

```
OCR_NER_USE_MOCK=true
```

The application keeps working with mock OCR results. That is enough to show the flow, although the results are not real.

---

## Avoiding a Changing URL

Quick tunnels (`trycloudflare.com`) always get a random subdomain. If you own a domain managed by Cloudflare, you can make the URL permanent:

```powershell
cloudflared tunnel login
cloudflared tunnel create ocrnerverify
cloudflared tunnel route dns ocrnerverify ocr.yourdomain.com
cloudflared tunnel run --url http://localhost:5001 ocrnerverify
```

After that, `https://ocr.yourdomain.com` never changes, and `OCR_NER_API_URL` on Render only needs to be set once. A named tunnel cannot be used without your own domain.

---

## Other Troubleshooting

**`/docs` does not open through the tunnel URL**: the OCR service is not running yet or is still loading the model. Check Terminal 1.

**Verification times out**: the document travels over the network, so it is slower than local. Increase `OCR_NER_TIMEOUT` in the Render environment (default 120 seconds).

**The tunnel drops during a demo**: quick tunnels are not guaranteed to be stable. Terminal 2 shows a connection error; restart it, but the URL will change and Render must be updated again.

**OCR results are empty although the tunnel is up**: Tesseract or Poppler may not be found. At startup `main.py` prints both paths, so check the Terminal 1 output.

---

## Checklist Before a Presentation

1. [ ] Terminal 1 is running and the NER model has finished loading
2. [ ] Terminal 2 is running and the tunnel URL is copied
3. [ ] `https://<tunnel>/docs` opens in a browser
4. [ ] `OCR_NER_API_URL` on Render is the new URL **plus `/extract`**
5. [ ] Render has finished redeploying
6. [ ] One verification has been tested until a real OCR result appears
7. [ ] The laptop is set not to sleep

Do this at least 30 minutes beforehand. A Render redeploy takes time, and you do not want to be racing it while people are waiting.
