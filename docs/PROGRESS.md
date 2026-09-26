# DwellOps build progress

Source of truth for the `/loop` build. Each iteration picks the first unchecked item.

## Milestone 1 — Vertical slice (CLAUDE.md §28)

- [x] Project setup: Next.js 16 App Router, TypeScript strict, Tailwind v4 tokens, Prisma 7 + `@prisma/adapter-pg`, Zod 4, Vitest
- [x] Schema + migrations: users, sessions, societies, society_members, invitations, buildings, units, unit_members, complaints, complaint_activities, notifications, audit_logs
- [x] Audit log append-only (DB trigger blocks UPDATE)
- [x] Auth: email/password (argon2id), DB sessions (hashed opaque token, httpOnly cookie), logout, rate limit on auth actions
- [x] Tenant context + centralized RBAC (`resource.action`)
- [x] Create society → building → unit
- [x] Invite member (one-time hashed token link, 7-day expiry) → accept → membership + unit link
- [x] Resident creates complaint (per-society number, SLA due time)
- [x] Manager sees, acknowledges, assigns staff
- [x] Staff starts / waits / resolves (cost in paise)
- [x] Resident confirms or reopens (reason required)
- [x] Complaint history timeline + audit log page
- [x] In-app notifications (idempotent adapter) + unread badge
- [x] Unit tests (state machine, SLA, money, permissions)
- [x] Integration test for full slice (real Postgres test DB)
- [x] Security tests: cross-society access
- [x] E2E test (Playwright, `npm run test:e2e`, test DB, installed Chrome): signup → society → building → unit → invites → complaint → assign → resolve → confirm → audit; plus resident 404 on admin/foreign pages
- [x] Browser check at 390px phone + 1440px desktop (Playwright on installed Chrome, no horizontal overflow)

## Known gaps in the slice

- Invite links are still shown to the admin to share; invite emails via the new email adapter not wired yet.
- Complaint photos/attachments need file storage adapter (PRD §30).
- SLA hours are defaults; per-society SLA config not built.
- Rate limiter is in-memory (per instance).
- Session cookie refresh: `lastSeenAt` updates daily; no sliding expiry yet.

## Next (PRD §44 order)

Next loop item: **Email invites** (send invite link through the email adapter; keep copy-link fallback), then Sprint 2 — complaint photos (file storage adapter).

### Done: CSV unit import (2026-09-26)

- Setup page → "Import flats from CSV": template download, upload, preview with Ready / Invalid / Duplicate / Missing counts and per-row reasons, "show only problems" filter.
- Pure parser/validator (`src/features/society/csv-import.ts`): quotes, CRLF, BOM, flexible headers; checks building code (this society only), floor range, area, in-file and in-DB duplicates; 1 MB / 2000-row caps.
- Import re-validates on the server, inserts valid rows in one transaction (`skipDuplicates` guards races), one audit entry. Server action body limit raised to 2 MB for this.
- Tests: 54 unit/integration + 3 E2E (includes real file upload).

### Done: account security (2026-09-26)

- `EmailToken` table: hashed, single-use, purpose-bound; a newer link cancels the older one. Verify link 24 h, reset link 1 h.
- Email adapter `src/lib/email`: Resend in prod (`EMAIL_API_KEY`, `EMAIL_FROM`), console in dev, memory in tests, `EMAIL_PROVIDER=console` opt-in for E2E/previews. Prod without a key logs a loud error.
- Signup sends verification; banner with "Resend link" until confirmed. Confirmation is a button press (POST), so mail scanners that pre-open links cannot burn tokens.
- Forgot password gives the same response for unknown emails; reset signs out every session and also verifies the email.
- "Sign out everywhere" on the account page; "Set up a new society" collapses for existing members.
- Auth rate limits keyed by IP + email/token.
- Tests: 45 unit/integration + 2 E2E passing.


1. ~~Finish slice~~ ✅ Milestone 1 complete (2026-09-26)
2. Sprint 1 remainder: ~~password reset + email verification~~ ✅, ~~CSV unit import~~ ✅, email invites
3. Sprint 2: complaint comments ✔, attachments, email notification provider
4. Sprint 3: tasks, vendors, staff attendance, announcements
5. Sprint 4: maintenance invoices, payments, receipts
6. Sprint 5: expenses, approvals, reports
7. Sprint 6: parking, parcels, move-in/out, committee
8. Sprint 7: subscriptions, usage limits, onboarding, hardening, observability

## Local dev

```bash
cp .env.example .env.local   # then set AUTH_SECRET
cp .env.local .env           # Prisma CLI reads .env
npm install
npx prisma migrate dev
npm run dev
```

Tests use `TEST_DATABASE_URL` (must contain `_test`):

```bash
DIRECT_DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy
npm test
```

## UI refresh (2026-09-26)

- Visual language modeled on auctionpro.app structure (Inter, bold/black headings, rounded-xl ringed cards, dark ink sidebar, 11px uppercase eyebrows, big numeric stat cards, dot pills). Palette deliberately different: ink `#0B1020` + indigo `#4F46E5`.
- Tokens in `src/app/globals.css`; shared chrome in `src/components/ui/feedback.tsx` (`StatCard`, `Panel`, `Eyebrow`, `table`).
- CLAUDE.md §20 still lists the old navy/blue palette — update it if the indigo palette is final.
- Dev seed: `npm run db:seed` (development data only; credentials in `prisma/seed.ts` header).
- Mobile (≤390px) not yet verified in a real viewport.

## Brand + PWA + community features (2026-09-26)

- Brand: Harbor teal + saffron on warm paper, Bricolage Grotesque headings (CLAUDE.md §20 updated). Custom roof/window mark used for logo, favicon, PWA icons.
- Phone: top bar + bottom tab bar (Home, Complaints, Notices, Parcels, Alerts); desktop grouped sidebar.
- Home is action-first: "Needs you" feed (parcels with pickup code, complaints to confirm, notices to acknowledge) and "Needs attention" for managers.
- PWA: `app/manifest.ts`, generated icons (`/icons/192|512|maskable`), `/sw.js` route embedding build id, offline page, "New version available → Update" prompt (checks every 15 min + on tab focus; activates only on tap).
- Notice board: targeted audience (all / building / owners / tenants / committee / staff), pin, priority, expiry, templates, "Got it" confirmation, read/confirm tracking per resident, in-app fan-out.
- Parcel desk: gate logs parcel → residents notified with 4-digit pickup code (hidden from gate) → handover requires matching code (rate-limited) → resident notified who collected. Stale (>48h) flagged. Returns tracked.
- Tests: 39 passing (notice audience rules, ack flow, parcel code/handover/rate limit/cross-tenant).

### Next ideas (pain-point driven)
- Maintenance dues + UPI payment tracking (biggest committee pain) — Sprint 4
- Visitor pre-approval / gate pass
- Amenity booking (clubhouse, hall)
- Complaint photos (needs storage adapter)
- Email/WhatsApp providers for notices and parcels
- Guard phone view: collapse "New delivery" form behind a button so the waiting list is first

- Pages use `requirePageContext` (404 for non-members) so parallel page renders never log unhandled FORBIDDEN.
