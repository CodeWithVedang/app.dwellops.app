# Deployment guide

```text
Browser
   │
   ▼
Vercel ── Next.js app: pages, server actions, /api/health, /api/files
   │ SQL (TLS)
   ▼
Render ── PostgreSQL (nivaso-plus-db)
   ▲
Render ── Worker (nivaso-plus-worker): scheduled jobs + /health, runs migrations on deploy
```

| Host | What runs there | Config |
| --- | --- | --- |
| Vercel | Frontend: the Next.js app. It serves every user request. | `vercel.json` |
| Render | Backend: PostgreSQL + worker service | `render.yaml` |
| Render worker | Overdue-complaint alerts every 15 min, `GET/HEAD /health`, `prisma migrate deploy` on each deploy | `src/worker/index.ts` |
| Render Postgres | Uploaded files (complaint photos), table `file_blobs` | default; no setup |
| Resend | Email (invites, password reset) | env vars on Vercel |

Why the pages still run server code on Vercel: every page and server action reads the database
directly through `src/server/services`. Moving that behind a REST API on Render would mean rewriting
every page and action and switching auth to cross-site cookies. This layout keeps one codebase,
keeps same-site session cookies, and puts all always-on backend work on Render.

**Deploy order:** Render first (creates the DB and runs migrations), then Vercel.

---

## 0. Before you start

Accounts: GitHub, Render, Vercel, and Gmail or Resend for email.

Check locally:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run worker:dev        # worker against .env.local; open http://localhost:10000/health
```

Push `main` to GitHub. Never commit `.env`, `.env.local` or real secrets.

Generate `AUTH_SECRET` for Vercel:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

---

## 1. File storage

No setup needed. In production, with no bucket configured, uploaded photos are stored in the
Render database (`file_blobs` table). Downloads still go through `/api/files/[id]`, which checks
permissions first, so files are never public.

Photos count toward the database size (free: 1 GB for data and files together). The browser
compresses photos before upload, so one photo is usually a few hundred KB.

To move to a bucket later (Cloudflare R2, AWS S3), set `STORAGE_ENDPOINT`, `STORAGE_BUCKET`,
`STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` and `STORAGE_REGION` on Vercel. New uploads then go to the
bucket. Existing photos stay in `file_blobs` and must be copied over before you switch.

## 2. Email

The app picks the first configured provider: `EMAIL_PROVIDER=console` (logs only) → SMTP → Resend.

### Option A: Gmail SMTP (no domain needed)

1. Google Account → Security → turn on **2-Step Verification**.
2. Google Account → Security → **App passwords** (https://myaccount.google.com/apppasswords) →
   create one named `Nivaso Plus`. Copy the 16-character password.
3. Vercel env vars (Production): `SMTP_USER` = your Gmail address, `SMTP_PASSWORD` = the app password.
   Optional: `SMTP_HOST` (default `smtp.gmail.com`), `SMTP_PORT` (default `465`), `EMAIL_FROM`
   (default `Nivaso Plus <SMTP_USER>`; Gmail always sends from the signed-in address).
4. Remove `EMAIL_PROVIDER` if it is set to `console`, then redeploy.

Limits: about 500 recipients a day; emails show your Gmail address as the sender.

### Option B: Resend (needs a domain you own)

1. Resend → **Domains** → add and verify your domain (DNS records).
2. Resend → **API keys** → create → `EMAIL_API_KEY`.
3. `EMAIL_FROM` = `Nivaso Plus <no-reply@your-domain>` (verified domain only).

Unset `SMTP_USER`/`SMTP_PASSWORD` when you switch, since SMTP wins when both are set.

In production, sending fails (and is logged as `email send failed`) when no provider is configured.

---

## 3. Render: database + worker

### 3.1 Create from the Blueprint

1. Render → **New → Blueprint** → connect GitHub → pick this repo. Render reads `render.yaml`.
2. Click **Apply**. Render creates:
   - `nivaso-plus-db`: PostgreSQL 16, Singapore
   - `nivaso-plus-worker`: Node web service, Singapore
3. Worker build: `npm ci --include=dev && npx prisma migrate deploy`. The first deploy creates all tables.
4. Worker start: `npm run worker:start`. It runs the overdue-complaint job at startup and every 15 minutes.

The worker is a Render **web** service, not a background worker, because background workers have no free plan.
It gets `DATABASE_URL`, `DIRECT_DATABASE_URL` (internal URL) and a generated `AUTH_SECRET` automatically.
It needs no email or storage keys: overdue alerts are in-app notifications.

The worker redeploys only when backend paths change (`buildFilter` in `render.yaml`).
UI-only commits do not restart it.

### 3.2 Check the worker

```bash
curl https://nivaso-plus-worker.onrender.com/health
```

```json
{
  "data": {
    "status": "ok",
    "database": { "ok": true, "latencyMs": 2 },
    "version": "<commit>",
    "uptimeSeconds": 120,
    "time": "...",
    "service": "worker",
    "jobs": [{ "name": "overdue-complaints", "lastRunAt": "...", "lastOk": true }]
  },
  "requestId": "..."
}
```

- `200` → worker and DB are up.
- `503`, `"status":"degraded"` → the worker is up but the DB is unreachable.
- `jobs[].lastOk: false` → last job run failed; see the worker logs in Render (`worker.job_failed`).

Render calls `/health` on every deploy. A deploy that fails the check is not promoted.

### 3.3 Staying awake (free plan)

Free Render web services sleep after 15 minutes without inbound traffic. While asleep, jobs stop.

- **Primary:** the worker sends `HEAD /health` to its own public URL (`RENDER_EXTERNAL_URL`, set by Render)
  every 10 minutes. That request goes through Render's proxy, so it counts as traffic.
- **Backup:** `.github/workflows/keep-alive.yml` pings `/health` every 14 minutes.
  Set repo → Settings → Secrets and variables → Actions → **Variables** → `RENDER_WORKER_URL` =
  `https://nivaso-plus-worker.onrender.com`. Test it with Actions → **Keep Render worker awake** → **Run workflow**.
  Leave the variable unset to disable it.
- **Alternative backup:** a free UptimeRobot or cron-job.org monitor on the same URL. It also emails you when the worker is down.

On a paid Render plan the service never sleeps; you can delete the workflow.

### 3.4 Copy the database URL for Vercel

Render → `nivaso-plus-db` → **Connect** → **External Database URL**. Add `?sslmode=require`:

```
postgresql://nivaso_plus:<password>@<host>.singapore-postgres.render.com/nivaso_plus?sslmode=require
```

This URL gives full database access. Store it only in Vercel env vars and your password manager.

### 3.5 Free plan limits

| Limit | Effect | Fix |
| --- | --- | --- |
| Free Postgres expires 30 days after creation (14-day grace, then deleted) | **All data lost** | Upgrade to `basic-256mb` or higher before real users; change `plan:` in `render.yaml` |
| Free Postgres has no backups | No recovery | Paid plans include backups |
| 750 free instance hours / workspace / month | Enough for one always-on service | Keep only the worker on free |
| Free Postgres connection limit is low | Many Vercel function instances can exhaust it | Upgrade the DB plan, or add a pooler |

---

## 4. Vercel: frontend

### 4.1 Import

1. Vercel → **Add New → Project** → import the repo.
2. Framework: **Next.js** (auto-detected). Keep default build/install commands. `postinstall` runs `prisma generate`.
3. **Settings → Environment Variables**, scope **Production**:

| Name | Value |
| --- | --- |
| `DATABASE_URL` | Render external URL + `?sslmode=require` (3.4) |
| `DIRECT_DATABASE_URL` | same value |
| `AUTH_SECRET` | 32+ random chars (section 0) |
| `NEXT_PUBLIC_APP_URL` | `https://<project>.vercel.app` or your custom domain, no trailing slash |
| `SMTP_USER`, `SMTP_PASSWORD` (or `EMAIL_API_KEY`, `EMAIL_FROM`) | section 2 |

4. **Deploy**, then check `https://<project>.vercel.app/api/health` → `200`.

`vercel.json` pins functions to `sin1` (Singapore), next to the Render DB. A US region would add ~200 ms per query.

`NEXT_PUBLIC_*` values are baked in at build time. After you change one, redeploy.

### 4.2 Preview deployments

Do **not** give the Preview environment the production `DATABASE_URL`, or preview branches write to live data.
Leave Preview variables empty (previews then fail safely), or point them at a separate Render database.

### 4.3 Custom domain

Vercel → Settings → Domains → add `app.your-domain` → follow the DNS steps.
Update `NEXT_PUBLIC_APP_URL` and redeploy, otherwise invite and reset links use the old URL.

### 4.4 Cron

Vercel runs no cron jobs; the Render worker owns scheduled work.
`/api/jobs/overdue-complaints` still exists for a manual run: set `CRON_SECRET` (16+ chars) on Vercel
and call it with `Authorization: Bearer <CRON_SECRET>`. The job is idempotent, so a manual run next to the worker is safe.

---

## 5. Migrations

Only the Render worker runs migrations, in its build. For a release that changes `prisma/schema.prisma`:

1. Merge to `main`. Render and Vercel build at the same time.
2. Render applies the migration.
3. Make each migration backwards-compatible: add a column before code uses it, drop it in a later release.
   The old Vercel version then keeps working during the migration.

Manual run from your machine, if ever needed:

```powershell
$env:DIRECT_DATABASE_URL="<external url>?sslmode=require"; npx prisma migrate deploy
```

---

## 6. Health endpoints

| Endpoint | Host | DB check | Use |
| --- | --- | --- | --- |
| `GET /health` | Render worker | yes | Render health check, keep-alive, job status |
| `HEAD /health` | Render worker | no | cheap keep-alive ping |
| `GET /api/health` | Vercel | yes | uptime monitor for the frontend |
| `HEAD /api/health` | Vercel | no | cheap liveness |

All return `503` when the DB is unreachable or slower than 3 s. All are public, `Cache-Control: no-store`,
and expose no tenant data, config or secrets.

---

## 7. Release checklist

- [ ] `npm run typecheck && npm run lint && npm test` green
- [ ] Migration reviewed; nothing destructive without approval; backwards-compatible
- [ ] Render worker deploy live; `GET /health` → 200; `jobs[].lastOk` not `false`
- [ ] Vercel deploy live; `GET /api/health` → 200
- [ ] Sign in, create a complaint, upload a photo (storage), send an invite (email)
- [ ] Rollback ready: Vercel → Deployments → previous → **Promote**; Render → Deploys → previous → **Rollback**.
      A rollback does not undo a migration.

## 8. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Render build: `prisma: not found` / `tsx: not found` | devDependencies skipped | Keep `npm ci --include=dev` in the build command |
| Worker crash: `ZodError` on `AUTH_SECRET` | Env var missing | It is generated by the Blueprint; re-sync the Blueprint |
| Vercel runtime: `ZodError` on `DATABASE_URL` / `AUTH_SECRET` | Missing or short env var | Set it; `AUTH_SECRET` needs 32+ chars |
| Vercel `/api/health` 503, worker `/health` 200 | Wrong external URL, missing `sslmode=require`, or IP allow list | 3.4; Render DB → Networking → allow `0.0.0.0/0` |
| Photo upload fails, `relation "file_blobs" does not exist` | Migration not applied | Redeploy the Render worker (it runs migrations) |
| `Email is not configured` in logs | No SMTP or Resend env vars on Vercel | Section 2 |
| `Invalid login: 535` in logs | Wrong Gmail app password, or 2-Step Verification off | Create a new app password |
| Invite links point to `localhost` | `NEXT_PUBLIC_APP_URL` unset at build time | Set it and redeploy |
| Overdue alerts late by hours | Worker slept | Check worker logs for `worker.self_ping_failed`; enable the GitHub backup |
