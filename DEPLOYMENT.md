# Deploying ocrnerverify Online

A guide to hosting the application so it can be reached over the internet, for demos or for sharing with others.

## Hosting Overview

| Part | Service | Notes |
|---|---|---|
| React frontend (Vite) | **Vercel** | free; `vercel.json` is included |
| Laravel backend (API) | **Render** | free tier; `backend/Dockerfile` and `render.yaml` are included |
| OCR/NER service (FastAPI) | not hosted | the backend runs in mock mode |
| Source code | **GitHub** | https://github.com/InDragovich/ocrnerverify |

Deploy order: **Render first** (the frontend needs the backend URL), then Vercel.

> **Render free tier:** a free web service goes to *sleep* after about 15 minutes without traffic, so the first request after idle takes about 30 to 50 seconds to wake up (cold start). This is normal, not an error. The free tier also has no persistent disk, so SQLite is reset to the seeder data on every redeploy or restart (intentional; see the note in Step 1.5).

> **Important:** because the OCR/NER service is not online, the hosted version runs with `OCR_NER_USE_MOCK=true`. Real OCR can only be demonstrated locally. See the last section if you want to host OCR as well.

---

## Step 0: Push the Latest Code to GitHub

Both platforms deploy from GitHub, so anything not pushed will not be deployed.

```powershell
git push origin master
```

---

## Step 1: Deploy the Backend to Render

### 1.1 Create the web service

1. Go to https://render.com and sign in with GitHub
2. **New → Web Service**, then connect the `InDragovich/ocrnerverify` repository
3. Render detects `render.yaml` in the root and offers **Apply Blueprint**. Choose it (faster than filling in the form). If it does not appear, continue manually with the next step.

### 1.2 Root directory and runtime (manual setup only)

This repository is a monorepo (frontend in the root, Laravel in `backend/`):

- **Root Directory**: `backend`
- **Runtime**: `Docker` (Render uses `backend/Dockerfile` automatically; there is no native PHP runtime)
- **Plan**: `Free`

### 1.3 Environment variables

Open the **Environment** tab and add:

```
APP_NAME=ocrnerverify
APP_ENV=production
APP_DEBUG=false
APP_KEY=<generate it, see below>
APP_URL=https://<service-name>.onrender.com

DB_CONNECTION=sqlite
DB_DATABASE=/app/storage/database.sqlite

SESSION_DRIVER=database
CACHE_STORE=database
QUEUE_CONNECTION=sync

OCR_NER_USE_MOCK=true

FRONTEND_URL=https://<project-name>.vercel.app
SEED_PASSWORD=<a strong password for the staff accounts>
```

**Getting `APP_KEY`**: run this locally and copy the result, including the `base64:` prefix:

```powershell
cd backend
php artisan key:generate --show
```

Never reuse a key that has been committed or shared.

**`SEED_PASSWORD`** is the password for the staff accounts (`verificator`, `superadmin`, and the regional operators). Keep it private. If it is left empty, those accounts are not created. The two public demo accounts (`demo_operator` and `demo_verifikator`) are always created.

`FRONTEND_URL` is not known yet at this point. Put anything for now and update it after Step 2. `config/cors.php` uses it as the only allowed origin, so **if it is wrong, the frontend gets a CORS error**.

### 1.4 Note the public domain

Render gives you `https://<service-name>.onrender.com` once the first deploy finishes. It is shown at the top of the service page.

### 1.5 Check that the deploy worked

Render builds an image from `backend/Dockerfile` and runs its `CMD`:

```
touch /app/storage/database.sqlite && php artisan migrate --force && (php artisan db:seed --force || echo 'seed skipped') && php artisan serve --host=0.0.0.0 --port=${PORT:-10000}
```

Check the **Logs** tab. You should see the Docker build finish, migrations run, the seeder run, and the server start listening.

> **Database note:** SQLite is created when the container starts and is **not** mounted on a persistent disk (the Render free tier does not offer one). Every redeploy or restart **erases all data** and returns to the seeder data. This is intentional, so that the demo accounts are always available. If you need persistent data, upgrade to a paid Render plan with a **Persistent Disk** mounted at `/app/storage`, and remove `db:seed` from the start command.

---

## Step 2: Deploy the Frontend to Vercel

### 2.1 Import the project

1. Go to https://vercel.com and sign in with GitHub
2. **Add New → Project**, then import `InDragovich/ocrnerverify`
3. Leave the Root Directory as the **repository root** (the frontend lives there)
4. The `Vite` framework is detected automatically from `vercel.json`

`.vercelignore` already excludes `backend/`, `ocr-ner-service/` and `*.md`, so the build contains only the frontend.

### 2.2 Environment variable

Under **Settings → Environment Variables**, add this for all environments:

```
VITE_API_BASE_URL=https://<render-url>/api
```

Keep the `/api` ending and do not add a trailing slash.

> Vite reads env values **at build time**, not at runtime. If you change this value you must **Redeploy**; reloading the browser is not enough.

### 2.3 Deploy

Click **Deploy**. When it finishes, note the URL, for example `https://ocrnerverify.vercel.app`.

---

## Step 3: Connect Both Sides (CORS)

Go back to Render, open **Environment**, and update:

```
FRONTEND_URL=https://ocrnerverify.vercel.app
```

Render redeploys automatically. Without this step, login fails with a CORS error in the browser console.

If you later use a custom domain or a Vercel preview URL, that URL must be added as well, because `config/cors.php` currently accepts only **one** origin from `FRONTEND_URL`.

---

## Step 4: End-to-End Test

1. Open the Vercel URL
2. Log in as `demo_verifikator` (password `demo1234`)
3. Open DevTools → Network and confirm that requests go to the Render domain and return 200
4. Try a batch verification; it runs with mock results

---

## Updating After a Deploy

Both services deploy automatically from the `master` branch:

```powershell
git push origin master
```

Vercel and Render rebuild on their own. Remember that every Render redeploy **resets the database** to the seeder data.

---

## Troubleshooting

**CORS error / "blocked by CORS policy"**: `FRONTEND_URL` on Render does not exactly match the Vercel URL. It must be identical, including `https://`, with no trailing slash.

**The frontend loads but every API call fails**: check `VITE_API_BASE_URL` on Vercel. A typo only shows up after a redeploy because the value is baked in at build time. It may also be a Render cold start (see the next point).

**The first request is slow or times out**: the free Render tier sleeps after idling. Wait 30 to 50 seconds and try again; later requests are fast while the service is awake.

**Refreshing a page gives a 404**: the rewrite in `vercel.json` should handle this. If it happens, make sure `vercel.json` is committed.

**Render fails to build**: the Root Directory is not `backend`, or the runtime is not `Docker`. Also make sure `backend/Dockerfile` is committed and not excluded by `.dockerignore`.

**500 Internal Server Error**: `APP_KEY` is empty or malformed; it must start with `base64:`. To see the error details, set `APP_DEBUG=true` temporarily, then set it back to `false`.

**Login works but there is no data**: the seeder failed. Check the deploy logs. The start command deliberately uses `|| echo 'seed skipped'`, so a seeder failure does not stop the server.

**Staff accounts cannot log in**: `SEED_PASSWORD` was empty when the container started, so those accounts were not created. Set it and redeploy.

---

## Optional: Hosting the OCR/NER Service

This is the hardest part and is **not required** for a demo. The obstacles:

1. **The roughly 495 MB model is git-ignored.** Options: upload it to a private Hugging Face repository and set `NER_MODEL_NAME=<user>/<repo>` and `HF_TOKEN=hf_xxx`, mount a volume, or download it from a cloud bucket in the entrypoint.
2. **Tesseract and Poppler are needed at system level.** This requires a custom Dockerfile running `apt-get install tesseract-ocr tesseract-ocr-ind poppler-utils`.
3. **Memory.** Loading IndoBERT needs about 1 to 2 GB, above the free tier of most platforms.

If you still want to do it, create a second Render web service with Root Directory `ocr-ner-service` and a custom Dockerfile (the 1 to 2 GB of RAM is likely above the free 512 MB limit, so a paid plan is needed). Then on the backend service set `OCR_NER_USE_MOCK=false` and `OCR_NER_API_URL=https://<ocr-service-url>.onrender.com/extract`.

My recommendation for presentations: **demonstrate real OCR from a local laptop**, and use the online version only to show that the application is publicly reachable. [DEPLOYMENT-CLOUDFLARE.md](DEPLOYMENT-CLOUDFLARE.md) describes how to connect a local OCR service to the online backend.
