# CLAUDE.md — Nivaso Plus Engineering Constitution

## 1. Project

Nivaso Plus is a multi-tenant SaaS operating system for apartment/society committees, managers, residents, staff, and vendors.

Read `PRD.md` before implementing product behavior.

The application must contain real production workflows. Never implement fake buttons, placeholder CRUD, mock success states, or hardcoded operational metrics.

---

# 2. Tech Stack

Required baseline:

- Next.js App Router
- TypeScript
- React
- PostgreSQL on Render
- Vercel deployment
- Zod validation
- Tailwind CSS
- Component system based on accessible primitives
- ORM/query layer with migrations
- Server-side authorization
- Automated tests
- Structured logging

Prefer simple, boring, maintainable technologies over unnecessary infrastructure.

---

# 3. Non-Negotiable Architecture

Use this dependency direction:

```text
UI
 ↓
Actions / Route Handlers
 ↓
Application Services
 ↓
Repositories
 ↓
PostgreSQL
```

Cross-cutting:

```text
Auth
Permissions
Validation
Audit
Notifications
File Storage
Observability
```

UI components must not contain database queries.

Repositories must not contain UI logic.

Business rules belong in services/domain modules.

---

# 4. Repository Structure

```text
nivaso-plus/
├── .claude/
│   ├── agents/
│   │   ├── product-architect.md
│   │   ├── frontend-engineer.md
│   │   ├── backend-engineer.md
│   │   ├── database-engineer.md
│   │   ├── auth-security-engineer.md
│   │   ├── qa-engineer.md
│   │   ├── ux-engineer.md
│   │   ├── devops-engineer.md
│   │   ├── code-reviewer.md
│   │   └── release-manager.md
│   └── commands/
│       ├── feature.md
│       ├── bugfix.md
│       ├── review.md
│       └── release.md
│
├── docs/
│   ├── architecture.md
│   ├── database.md
│   ├── authorization.md
│   ├── api.md
│   ├── notifications.md
│   ├── deployment.md
│   └── testing.md
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── public/
│
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   ├── (dashboard)/
│   │   ├── api/
│   │   └── layout.tsx
│   │
│   ├── components/
│   │   ├── ui/
│   │   ├── forms/
│   │   ├── tables/
│   │   ├── navigation/
│   │   └── feedback/
│   │
│   ├── features/
│   │   ├── society/
│   │   ├── residents/
│   │   ├── complaints/
│   │   ├── tasks/
│   │   ├── maintenance/
│   │   ├── expenses/
│   │   ├── vendors/
│   │   ├── staff/
│   │   ├── parking/
│   │   ├── parcels/
│   │   ├── announcements/
│   │   ├── move-in-out/
│   │   ├── committee/
│   │   ├── notifications/
│   │   └── reports/
│   │
│   ├── server/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── jobs/
│   │   └── integrations/
│   │
│   ├── lib/
│   │   ├── auth/
│   │   ├── permissions/
│   │   ├── db/
│   │   ├── validation/
│   │   ├── audit/
│   │   ├── notifications/
│   │   ├── storage/
│   │   ├── logging/
│   │   └── errors/
│   │
│   └── types/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── security/
│
├── scripts/
├── .env.example
├── .gitignore
├── next.config.ts
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── PRD.md
```

---

# 5. Agent Architecture

The project uses specialized agents. Each agent has a narrow responsibility.

## Agent: Product Architect

File: `.claude/agents/product-architect.md`

Responsibilities:

- convert requirements into technical plans
- identify dependencies
- identify missing business rules
- protect scope
- ensure PRD consistency
- define acceptance criteria

Must not directly implement large code changes unless explicitly requested.

---

## Agent: Frontend Engineer

File: `.claude/agents/frontend-engineer.md`

Responsibilities:

- Next.js pages
- React components
- forms
- tables
- responsive layouts
- loading/error/empty states
- accessibility
- client interaction

Rules:

- no direct database access
- no business rules hidden in components
- use shared components
- use real API/server actions
- never create fake success states

---

## Agent: Backend Engineer

File: `.claude/agents/backend-engineer.md`

Responsibilities:

- route handlers
- server actions
- application services
- business rules
- authorization enforcement
- notification orchestration
- audit events

Every mutation must:

1. authenticate
2. determine tenant
3. authorize
4. validate
5. execute transaction where needed
6. audit
7. return typed result

---

## Agent: Database Engineer

File: `.claude/agents/database-engineer.md`

Responsibilities:

- schema design
- migrations
- indexes
- constraints
- relations
- query performance
- transaction boundaries
- data integrity

Rules:

- no destructive migration without explicit approval
- use foreign keys
- use unique constraints
- add indexes for common filters
- preserve historical records where business rules require it

---

## Agent: Auth & Security Engineer

File: `.claude/agents/auth-security-engineer.md`

Responsibilities:

- authentication
- sessions
- password reset
- RBAC
- tenant isolation
- resource authorization
- secure file access
- rate limits
- security tests

Critical rule:

> A hidden frontend button is not authorization.

Every protected operation must enforce authorization on the server.

---

## Agent: QA Engineer

File: `.claude/agents/qa-engineer.md`

Responsibilities:

- test strategy
- unit tests
- integration tests
- E2E tests
- regression coverage
- edge cases
- security test scenarios

For every new feature, identify:

- happy path
- validation failures
- permission failures
- empty state
- duplicate state
- concurrent update risk
- recovery path

---

## Agent: UX Engineer

File: `.claude/agents/ux-engineer.md`

Responsibilities:

- information architecture
- user flows
- responsive UX
- accessibility
- empty/loading/error states
- form usability
- mobile resident experience

UX rule:

> A resident should not need to understand the society's internal organizational structure to complete a task.

---

## Agent: DevOps Engineer

File: `.claude/agents/devops-engineer.md`

Responsibilities:

- Vercel
- Render PostgreSQL
- environment configuration
- CI
- migrations
- backups
- monitoring
- deployment safety

Never place secrets in source control.

Production migrations must be reviewed.

---

## Agent: Code Reviewer

File: `.claude/agents/code-reviewer.md`

Review for:

- correctness
- security
- authorization
- tenant isolation
- maintainability
- performance
- test coverage
- accessibility
- unnecessary complexity

Reject:

- mock APIs
- fake data
- TODO-only implementations
- client-only authorization
- duplicated business rules
- unvalidated inputs

---

## Agent: Release Manager

File: `.claude/agents/release-manager.md`

Responsibilities:

- release checklist
- migration review
- regression status
- environment verification
- changelog
- rollback readiness

A release is not complete until production health checks pass.

---

# 6. Feature Module Contract

Every feature should follow:

```text
features/<feature>/
├── components/
├── schemas/
├── types.ts
├── constants.ts
├── queries.ts
├── mutations.ts
└── permissions.ts
```

Business services:

```text
server/services/<feature>Service.ts
```

Repository:

```text
server/repositories/<feature>Repository.ts
```

Tests:

```text
tests/unit/<feature>/
tests/integration/<feature>/
tests/e2e/<feature>/
```

---

# 7. Required Feature Lifecycle

Before coding:

1. Read PRD
2. Identify user role
3. Define workflow
4. Define states
5. Define data model
6. Define permissions
7. Define validation
8. Define audit requirements
9. Define notifications
10. Define tests

Then implement.

---

# 8. Status Machines

Do not use arbitrary strings throughout the application.

Use typed enums/state definitions.

Example:

```ts
type ComplaintStatus =
  | "NEW"
  | "ACKNOWLEDGED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "WAITING"
  | "RESOLVED"
  | "CLOSED"
  | "REOPENED"
  | "CANCELLED";
```

Transitions must be validated.

Example:

```text
NEW → ACKNOWLEDGED
ACKNOWLEDGED → ASSIGNED
ASSIGNED → IN_PROGRESS
IN_PROGRESS → RESOLVED
RESOLVED → CLOSED
RESOLVED → REOPENED
```

Do not allow arbitrary status updates.

---

# 9. Tenant Isolation

Every tenant-owned query must be scoped.

Preferred:

```ts
repository.findComplaint({
  societyId,
  complaintId,
});
```

Avoid:

```ts
repository.findComplaint(complaintId);
```

unless the repository is already bound to a verified tenant context.

Security tests must attempt cross-society access.

---

# 10. Authorization Model

Permission format:

```text
resource.action
```

Examples:

```text
complaint.create
complaint.assign
complaint.resolve
complaint.close
invoice.create
invoice.cancel
expense.approve
parking.assign
move_request.approve
committee.decision.create
```

Role permissions must be centralized.

---

# 11. Database Rules

Use transactions for:

- invoice generation
- payment allocation
- expense approval
- parking assignment
- move approval
- committee decision creation where multiple records must stay consistent

Never perform multi-record financial mutations without a transaction.

---

# 12. Financial Rules

Money values must not use floating-point arithmetic.

Use integer minor units or a decimal-safe database type.

Example:

```text
₹1,250.50 → 125050 paise
```

All financial calculations require tests.

---

# 13. API Rules

All API responses should use a consistent structure.

Success:

```ts
{
  data,
  requestId
}
```

Failure:

```ts
{
  error: {
    code,
    message,
    fieldErrors?
  },
  requestId
}
```

Never return stack traces.

---

# 14. Forms

Every form needs:

- schema validation
- loading state
- disabled submit while processing
- server validation
- field-level errors
- success feedback
- recovery on failure

Destructive actions require confirmation.

---

# 15. Tables

Operational tables should support:

- search
- filters
- sorting
- pagination
- status
- date range where relevant
- row actions
- responsive behavior

Do not load thousands of records into the browser unnecessarily.

---

# 16. Notifications

Use an adapter pattern.

```ts
interface NotificationProvider {
  send(input: NotificationInput): Promise<NotificationResult>;
}
```

Providers:

```text
InAppNotificationProvider
EmailNotificationProvider
WhatsAppNotificationProvider
```

Notification creation must be idempotent where retries are possible.

---

# 17. Audit

Use a centralized audit service.

```ts
audit.log({
  societyId,
  actorId,
  action,
  entityType,
  entityId,
  before,
  after,
});
```

Never allow users to edit audit records.

---

# 18. File Uploads

Allowed uploads must be validated by:

- MIME type
- file extension
- file size
- authorization

Do not trust the filename.

Private documents must require authorization before download.

---

# 19. Testing Gate

No feature is production-ready without:

- unit tests for business logic
- integration test for persistence
- E2E test for critical user flow
- authorization tests
- validation tests

Critical modules:

- authentication
- complaints
- maintenance
- payments
- expenses
- parking
- move requests

must have regression coverage.

---

# 20. UI Design System

Brand:

```text
Nivaso Plus
```

Palette (tokens live in `src/app/globals.css`; never use raw hex in components):

```text
Ink          #121826   sidebar, dark panels, primary text
Ink 2        #1B2233   raised surfaces on ink
Harbor       #0D7C79   brand / primary actions
Harbor dark  #0A6461   hover / pressed
Harbor soft  #E6F4F3   brand tint backgrounds
Saffron      #F4A62A   accent highlights only (never status)
Green        #16A34A   success
Amber        #B45309   warning
Red          #DC2626   danger
Sky          #0284C7   info
Paper BG     #F7F6F3   app background (warm)
White        #FFFFFF   surfaces
Border       #E7E4DE
Muted        #5F6672
Subtle       #8C919B
```

Typography: Bricolage Grotesque for headings and numerals (`font-display`), Inter for UI text.

Use semantic colors consistently.

Do not introduce random feature-specific colors.

---

# 21. Product Writing

Use simple language.

Prefer:

`Mark as resolved`

instead of:

`Transition workflow state`

Prefer:

`Payment received`

instead of:

`Payment transaction successfully persisted`

Resident-facing language should avoid technical terminology.

---

# 22. No Fake Product Behavior

Never write:

```ts
setTimeout(() => setSuccess(true), 500);
```

to simulate backend work.

Never display:

- fake counts
- fake notifications
- fake payment success
- fake upload success
- fake approval
- fake dashboard data

During development, use seed data explicitly marked as development data and never ship it as production data.

---

# 23. Environment Rules

Use:

```text
.env.local
.env.example
```

Never commit `.env.local`.

All production values are injected by Vercel/Render.

---

# 24. Git Rules

Commit style:

```text
feat: add complaint assignment workflow
fix: prevent duplicate parking assignment
refactor: extract notification service
test: add invoice payment allocation coverage
docs: update deployment guide
chore: update dependencies
```

PRs must explain:

- what changed
- why
- database changes
- security impact
- tests
- deployment notes

---

# 25. Agent Workflow

For a new feature:

```text
Product Architect
      ↓
UX Engineer
      ↓
Database Engineer
      ↓
Backend Engineer
      ↓
Frontend Engineer
      ↓
QA Engineer
      ↓
Code Reviewer
      ↓
Release Manager
```

For a bug:

```text
QA Engineer
      ↓
Backend/Frontend Engineer
      ↓
Code Reviewer
      ↓
QA Engineer
```

For security-sensitive work:

```text
Auth & Security Engineer
      ↓
Backend Engineer
      ↓
QA Engineer
      ↓
Code Reviewer
```

---

# 26. Claude Working Rules

Before modifying code:

1. inspect relevant files
2. understand existing architecture
3. do not duplicate existing utilities
4. make the smallest coherent change
5. preserve existing behavior
6. add tests
7. run typecheck/lint/tests where available
8. report changed files and validation

Never rewrite the whole project to implement a small feature.

---

# 27. Definition of Done

A task is done only if:

- implementation works end-to-end
- real persistence is used
- authorization is enforced
- validation is enforced
- UI handles loading/error/empty/success
- audit is implemented where needed
- notifications are implemented where needed
- tests are added
- no mock behavior remains
- documentation is updated if architecture changed

---

# 28. First Build Milestone

Build this vertical slice first:

```text
Create Society
    ↓
Create Building
    ↓
Create Unit
    ↓
Invite Resident
    ↓
Resident Login
    ↓
Resident Creates Complaint
    ↓
Manager Sees Complaint
    ↓
Manager Assigns Staff
    ↓
Staff Updates Status
    ↓
Staff Resolves
    ↓
Resident Confirms
    ↓
Audit History
    ↓
Notification
```

Do not build every module before this slice works completely.

This is the reference architecture for all later modules.

---

# 29. Product Quality Rule

Nivaso Plus should always feel like:

> “I know what is pending, who owns it, what happened, and what I need to do next.”

That is the standard for every screen and workflow.
