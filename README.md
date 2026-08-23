# Taralaya Internal — Business OS

ERP / Operating System for Taralaya Studio (Digital Agency).

**Stack:** Turborepo monorepo · Express + Drizzle ORM + NeonDB (Postgres) · Vite + React + TanStack Query

---

## Fitur (12 Phase)

| #   | Fitur                                        |
| --- | -------------------------------------------- |
| 1   | Foundation — Auth (JWT), Settings perusahaan |
| 2   | Pricelist satuan & Paket layanan             |
| 3   | Quotation (penawaran) + PDF                  |
| 4   | Invoice (faktur) + PDF                       |
| 5   | Payment & Wallet / Kas                       |
| 6   | UI Polish                                    |
| 7   | Project Management (Kanban)                  |
| 8   | Team & Payroll                               |
| 9   | Expense Tracking                             |
| 10  | CRM / Lead Pipeline                          |
| 11  | Reporting Dashboard                          |
| 12  | Document Generator (Kontrak, BAST, dll)      |

---

## Struktur Folder

```
taralaya-internal/
├── apps/
│   ├── backend/          # Express API (Node.js + TypeScript + Drizzle)
│   └── frontend/         # Vite + React SPA
├── docs/
│   ├── 01_DB_SCHEMA.md
│   ├── 02_BLUEPRINT.md
│   └── progress.json
├── .env.example
├── pnpm-workspace.yaml
└── turbo.json
```

---

## Development Lokal

### Prasyarat

- Node.js >= 18
- pnpm >= 8 (`npm install -g pnpm`)
- Akun [Neon](https://neon.tech) (free tier cukup)

### Setup

```bash
# 1. Clone repo
git clone https://github.com/your-org/taralaya-internal.git
cd taralaya-internal

# 2. Install dependencies
pnpm install

# 3. Buat file .env dari contoh
cp .env.example .env
# Edit .env: isi DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD

# 4. Jalankan dev server (backend + frontend sekaligus)
pnpm dev
```

Frontend buka di `http://localhost:5173`, backend di `http://localhost:3001`.

---

## Deploy ke Vercel

> **Catatan:** Backend dan frontend di-deploy sebagai **dua Vercel project terpisah**.

### A. Deploy Backend

**1. Push ke GitHub**

Pastikan repo sudah di GitHub.

**2. Buat Vercel Project untuk backend**

- Di [vercel.com](https://vercel.com), klik **Add New → Project**
- Import repo yang sama
- **Root Directory:** `apps/backend`
- **Framework Preset:** Other
- **Build Command:** `pnpm run build`
- **Output Directory:** `dist`
- **Install Command:** `pnpm install`

**3. Set Environment Variables di Backend Project**

Pergi ke `Settings → Environment Variables`, tambahkan:

| Key              | Value                                                            |
| ---------------- | ---------------------------------------------------------------- |
| `DATABASE_URL`   | `postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require` |
| `JWT_SECRET`     | string random panjang (min 32 karakter)                          |
| `ADMIN_EMAIL`    | email admin pertama                                              |
| `ADMIN_PASSWORD` | password admin pertama                                           |
| `CLIENT_ORIGIN`  | URL frontend Vercel kamu (isi setelah frontend di-deploy)        |
| `NODE_ENV`       | `production`                                                     |
| `VERCEL`         | `1`                                                              |

**4. Deploy**

Klik Deploy. Catat URL backend kamu, contoh: `https://taralaya-backend.vercel.app`

---

### B. Deploy Frontend

**1. Buat Vercel Project untuk frontend**

- Klik **Add New → Project**, import repo yang sama
- **Root Directory:** `apps/frontend`
- **Framework Preset:** Vite
- **Build Command:** `pnpm run build`
- **Output Directory:** `dist`
- **Install Command:** `pnpm install`

**2. Set Environment Variables di Frontend Project**

| Key            | Value                                                                     |
| -------------- | ------------------------------------------------------------------------- |
| `VITE_API_URL` | URL backend dari langkah A, contoh: `https://taralaya-backend.vercel.app` |

**3. Deploy**

Catat URL frontend kamu, contoh: `https://taralaya.vercel.app`

---

### C. Update CORS Backend

Setelah frontend selesai di-deploy, balik ke **backend project** di Vercel:

- `Settings → Environment Variables`
- Update `CLIENT_ORIGIN` ke URL frontend kamu: `https://taralaya.vercel.app`
- Klik **Redeploy** (tanpa rebuild, cukup redeploy)

---

### D. Seed Admin User (Sekali saja)

Setelah backend live, jalankan migration/seed dari lokal:

```bash
# Pastikan DATABASE_URL di .env lokal mengarah ke Neon production
pnpm --filter @taralaya/backend exec tsx src/db/migrate-team.ts
```

> Ini akan membuat user admin pertama berdasarkan `ADMIN_EMAIL` dan `ADMIN_PASSWORD` di `.env` lokal.

---

## Checklist Deploy

- [ ] `DATABASE_URL` sudah benar (Neon production connection string)
- [ ] `JWT_SECRET` sudah di-set (jangan pakai nilai default!)
- [ ] `CLIENT_ORIGIN` di backend = URL frontend production
- [ ] `VITE_API_URL` di frontend = URL backend production
- [ ] `VERCEL=1` di-set di backend environment variables
- [ ] Admin user sudah di-seed
- [ ] Test login di URL frontend production
- [ ] Test generate PDF quotation/invoice

---

## Troubleshooting Vercel

### `FUNCTION_INVOCATION_FAILED` / 500 Error

Cek **Vercel → Functions → Runtime Logs**. Penyebab paling umum:

- `DATABASE_URL` tidak di-set atau salah format
- `JWT_SECRET` tidak di-set
- `VERCEL=1` belum di-set (menyebabkan `app.listen()` crash di serverless)

### CORS Error di browser

- Pastikan `CLIENT_ORIGIN` di backend = URL frontend exact (termasuk `https://`)
- Redeploy backend setelah update env var

### Cookies/session tidak tersimpan

- Pastikan backend dan frontend di domain yang sama, atau backend pakai `SameSite=None; Secure` di cookie config
- Untuk cross-domain Vercel deployment, perlu update cookie settings di `auth.router.ts`

---

## Update / Redeploy

Setiap push ke branch `main` akan auto-trigger deployment di Vercel (jika auto-deploy aktif).

Manual redeploy:

```bash
git add -A
git commit -m "feat: update fitur X"
git push origin main
```

---

## Local Dev Commands

```bash
pnpm dev                          # jalankan semua (backend + frontend)
pnpm --filter @taralaya/backend dev   # backend saja
pnpm --filter @taralaya/frontend dev  # frontend saja
pnpm build                        # build semua
```
