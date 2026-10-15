# ocrnerverify

A web application that checks routine operational cost reports (electricity, telephone, water and gas) by reading the attached document and comparing it with what was entered. It was built as an undergraduate thesis project.

**Live demo:** https://ocrnerverify.vercel.app (uses sample data and a simulated reader)

**Try it:** the login page has two demo accounts, `demo_operator` and `demo_verifikator` (password `demo1234`). Log in as the operator to add a report with an attachment, then as the verifier to run the verification.

<!-- Add 2-3 screenshots here: login, verifier dashboard, document detail -->

## What it does

Staff upload a cost report together with its scanned document. The system reads the document, extracts the key details, and compares them with the entered data. Reviewers then focus only on documents that do not match.

| Role | What they can do |
|---|---|
| Operator | Enter cost reports and upload attachments; view the verification result of their own documents |
| Verifier | Browse reports by region, run automatic verification, review mismatches, and make the final decision |
| Super Admin | Everything a verifier can do, plus manage users and view the audit log |

## How it works

```
React (Vercel)  -->  Laravel API (Render)  -->  OCR/NER service (FastAPI)
```

1. The operator enters the category, period and amount, and attaches the document.
2. The verifier starts automatic verification. The OCR step reads the text from the document, and the NER step (an Indonesian language model) picks out the category, period and amount.
3. The system compares the extracted values with the entered ones. A full match is approved automatically; any difference is marked "Needs review".
4. The verifier makes the final decision and may correct the extracted values. Every action is recorded in the audit log.

## Tech stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Backend:** Laravel 11, Laravel Sanctum, SQLite
- **OCR/NER service:** Python, FastAPI, Tesseract, IndoBERT

## Run it locally

Requirements: PHP 8.2+, Composer, Node.js 18+. Python, Tesseract and Poppler are only needed for real OCR.

```bash
# Backend (http://localhost:8000)
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

```bash
# Frontend (http://localhost:5173), from the project root
cp .env.example .env
npm install
npm run dev
```

Seeding always creates the two public demo accounts above. It also creates staff accounts (`operator`, `verificator`, `superadmin`, and regional operators) with the password `password` in a local environment; elsewhere, set `SEED_PASSWORD` first or they are skipped.

To try the app without the OCR/NER service, set `OCR_NER_USE_MOCK=true` in `backend/.env`. For real OCR, see [CARA-MENJALANKAN.md](CARA-MENJALANKAN.md) (in Indonesian), which also covers common problems.

## Security measures

- Token-based login (Sanctum) with a limit of 5 attempts per minute
- Access limited by role and by assigned region, checked on the server
- Uploads restricted to PDF, JPG and PNG up to 5 MB
- Passwords stored as hashes; no default password outside local development
- Audit log of logins, edits and decisions

## Notes and limitations

- The fine-tuned NER model (about 495 MB) is not included in this repository.
- The live demo uses the simulated reader; real OCR/NER runs only on a local machine.
- Documentation for deployment ([CARA-DEPLOY.md](CARA-DEPLOY.md)) and the version history ([CHANGELOG.md](CHANGELOG.md)) are written in Indonesian.

## License

[MIT](LICENSE)
