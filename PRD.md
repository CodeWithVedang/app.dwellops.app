# DwellOps — Product Requirements Document

**Product:** DwellOps  
**Tagline:** Simple operations for better-managed societies.  
**Document:** Full SaaS PRD  
**Version:** 1.0  
**Status:** Build-ready specification  
**Primary stack:** Next.js + TypeScript + PostgreSQL  
**Deployment:** Vercel (web) + Render PostgreSQL  
**Authentication:** Secure session-based authentication with email/password; OTP can be added later  
**UI:** Responsive web app / PWA-ready

---

# 1. Product Vision

DwellOps is a simple operating system for apartment/society committees, managers, staff, vendors, and residents.

The product replaces fragmented WhatsApp messages, spreadsheets, paper registers, phone calls, and manual follow-ups with a single operational workspace.

The core principle is:

> **Every issue, payment, expense, task, vendor, vehicle, parcel, announcement, movement request, and committee decision should have a clear owner, status, history, and next action.**

DwellOps must not feel like enterprise ERP software. It should feel like a modern, simple operations tool that a society committee can start using without training.

---

# 2. Target Customers

## Primary

- Apartment societies
- Housing societies
- Residential communities
- Gated communities
- Apartment association committees
- Property/society managers

## Secondary

- Facility management companies
- Property management companies managing multiple societies

## User roles

### Platform roles

- `PLATFORM_OWNER`
- `PLATFORM_ADMIN`
- `SUPPORT`

### Society roles

- `SOCIETY_ADMIN`
- `COMMITTEE_MEMBER`
- `SOCIETY_MANAGER`
- `ACCOUNTANT`
- `SECURITY_MANAGER`
- `STAFF`
- `VENDOR`
- `RESIDENT`
- `TENANT`

A user can have different roles in different societies.

---

# 3. Product Principles

1. **Simple before powerful**
2. **One screen should answer “what needs attention?”**
3. **Every operational record has a status**
4. **Every actionable item has an owner**
5. **Every important change is auditable**
6. **Mobile-first for residents and staff**
7. **Desktop-efficient for managers and committees**
8. **No fake/demo workflows in production**
9. **No silent destructive actions**
10. **Permission checks must happen server-side**
11. **Tenant data must be isolated**
12. **WhatsApp/email integrations must be replaceable adapters, not hardcoded business logic**

---

# 4. MVP Scope

All modules below are included in the product architecture, but implementation should be phased.

## Phase 1 — Core operations

- Society setup
- Buildings / wings / floors / units
- Residents / tenants
- User roles and permissions
- Complaint & repair management
- Society task management
- Vendor management
- Staff attendance
- Announcements
- Notifications
- Dashboard
- Audit log

## Phase 2 — Money and assets

- Maintenance billing
- Payment tracking
- Expense management
- Expense approvals
- Vendor payments
- Financial reports
- Receipts

## Phase 3 — Community operations

- Parking
- Parcel management
- Move-in / move-out
- Committee meetings and decisions

## Phase 4 — SaaS scale

- Multiple societies per account
- Subscription/billing
- Automated reminders
- WhatsApp provider integration
- Email provider integration
- Advanced reporting
- Multi-society management for facility companies

---

# 5. Global Navigation

Desktop:

- Dashboard
- Complaints
- Tasks
- Maintenance
- Expenses
- Vendors
- Staff
- Parking
- Parcels
- Announcements
- Move In / Out
- Committee
- Reports
- Settings

Resident navigation should be simplified:

- Home
- My Complaints
- Maintenance
- Parking
- Parcels
- Announcements
- Profile

Security/staff navigation should show only relevant operational modules.

---

# 6. Dashboard

## Society Admin Dashboard

Show:

- Open complaints
- Overdue complaints
- Tasks due today
- Overdue tasks
- Pending approvals
- Maintenance collection
- Unpaid maintenance
- Today's staff attendance
- Active vendors
- Recent expenses
- Recent announcements
- Upcoming move-ins/move-outs
- Parking issues
- Recent activity

## Dashboard behavior

Every metric is clickable and leads to filtered records.

Example:

`23 Open Complaints` → `/complaints?status=OPEN`

No hardcoded dashboard values.

All values come from PostgreSQL queries.

## Resident dashboard

Show:

- My open complaints
- Latest announcements
- Maintenance due
- Recent payments
- Parcel awaiting pickup
- My parking information
- Pending move request

---

# 7. Society Setup

A society admin creates:

- Society name
- Logo
- Address
- City
- State
- Country
- Contact email
- Contact phone
- Timezone
- Currency
- Financial year
- Maintenance billing settings

Then configure:

### Buildings

- Building/Wing name
- Code
- Floors

### Units

- Unit number
- Floor
- Unit type
- Area
- Owner
- Tenant
- Occupancy status

Import units through CSV.

CSV validation must show:

- valid rows
- invalid rows
- duplicate rows
- missing fields

Only validated rows can be imported.

---

# 8. Complaint & Repair Manager

This is the primary operational module.

## Resident creates complaint

Fields:

- Category
- Subcategory
- Title
- Description
- Location
- Priority
- Photos
- Preferred access time

Categories:

- Plumbing
- Electrical
- Civil
- Lift
- Cleaning
- Security
- Water
- Parking
- Common Area
- Other

## Status lifecycle

`NEW → ACKNOWLEDGED → ASSIGNED → IN_PROGRESS → WAITING → RESOLVED → CLOSED`

Additional:

`REOPENED`
`CANCELLED`

## Assignment

A manager can assign:

- Staff
- Vendor
- Committee member

Record:

- assignee
- assigned date
- expected completion
- notes

## SLA

Each category can have an SLA.

Example:

- Critical: 4 hours
- High: 12 hours
- Normal: 48 hours
- Low: 72 hours

SLA configuration must be editable.

## Resolution

Resolver must provide:

- Resolution note
- Cost, if applicable
- Attachment/invoice
- Completion timestamp

Resident can:

- Confirm resolution
- Reopen issue

## Complaint history

Every state change creates an activity record.

---

# 9. Society Task Manager

Used for recurring and one-off operational work.

Examples:

- Clean water tank
- Check fire extinguishers
- Inspect lift
- Generator maintenance
- Garden maintenance
- Monthly meter reading

Fields:

- Title
- Description
- Category
- Assignee
- Priority
- Due date
- Recurrence
- Checklist
- Attachments
- Status

Statuses:

`TODO`
`IN_PROGRESS`
`BLOCKED`
`DONE`
`CANCELLED`

Recurring tasks generate future task instances.

---

# 10. Vendor Manager

Vendor profile:

- Company/name
- Contact person
- Phone
- Email
- Address
- Service category
- GST/tax ID
- Bank details
- Contract start/end
- Payment terms
- Documents
- Rating/feedback

Vendor can be linked to:

- complaints
- tasks
- expenses
- contracts

## Vendor status

`ACTIVE`
`INACTIVE`
`BLACKLISTED`

Contract expiry reminders are generated automatically.

---

# 11. Staff Attendance

Staff profile:

- Name
- Role
- Phone
- Joining date
- Employment type
- Shift
- Salary
- Documents
- Active status

Attendance:

- Present
- Absent
- Half day
- Leave
- Holiday

Attendance record:

- date
- check-in
- check-out
- source
- notes

Source can be:

- manager entry
- staff self-entry
- future QR/device integration

Monthly report:

- working days
- present
- absent
- leave
- overtime

No biometric integration in MVP.

---

# 12. Society Announcement Manager

Create announcement:

- Title
- Message
- Audience
- Priority
- Publish date
- Expiry date
- Attachment

Audience:

- all residents
- specific building
- specific floor
- owners
- tenants
- committee
- staff

Status:

`DRAFT`
`PUBLISHED`
`SCHEDULED`
`EXPIRED`

Read tracking:

- delivered
- opened/read

Notifications use an adapter architecture:

`NotificationService → EmailProvider / WhatsAppProvider / InAppProvider`

---

# 13. Maintenance Billing

## Configuration

Society defines:

- billing frequency
- due date
- late fee
- tax
- billing rules
- invoice numbering

Billing models:

- fixed amount
- area-based
- unit type based
- custom charge

Additional charges:

- parking
- water
- sinking fund
- repair fund
- penalties
- other charges

## Invoice lifecycle

`DRAFT → GENERATED → ISSUED → PARTIALLY_PAID → PAID → OVERDUE → CANCELLED`

## Invoice contents

- invoice number
- unit
- resident
- billing period
- line items
- taxes
- previous balance
- current amount
- late fee
- total
- due date

PDF receipt/invoice generation must be real.

---

# 14. Payment Tracking

Payment record:

- invoice
- unit
- amount
- payment date
- payment method
- transaction/reference ID
- received by
- notes

Methods:

- bank transfer
- UPI
- cash
- cheque
- online gateway

For manual payments, manager records the transaction.

For future payment gateway support, webhook processing must update payment status idempotently.

## Reconciliation

Payments must be matched against invoices.

Partial payments are supported.

Overpayments create credit balance.

---

# 15. Society Expense Manager

Create expense:

- category
- vendor
- amount
- tax
- date
- description
- payment method
- invoice attachment
- created by

Categories:

- electricity
- water
- security
- housekeeping
- repairs
- lift
- gardening
- admin
- vendor
- other

## Approval

Configurable approval threshold.

Example:

- <= ₹5,000: manager approval
- > ₹5,000: committee approval

Statuses:

`DRAFT`
`PENDING_APPROVAL`
`APPROVED`
`REJECTED`
`PAID`
`CANCELLED`

Approval history is immutable.

---

# 16. Parking Manager

Parking entity:

- slot number
- building
- floor/area
- slot type
- status

Slot types:

- car
- bike
- visitor
- reserved
- accessible

Assignment:

- resident
- unit
- vehicle

Vehicle:

- registration number
- type
- make/model
- owner

Rules:

- one slot cannot be actively assigned to conflicting units
- vehicle registration number must be unique within a society
- historical assignments remain available

Visitor parking can track:

- visitor name
- vehicle
- slot
- start/end
- host unit

---

# 17. Parcel Manager

Security/staff creates parcel:

- resident/unit
- courier
- tracking number
- received date/time
- photo
- storage location

Statuses:

`RECEIVED`
`NOTIFIED`
`COLLECTED`
`RETURNED`

Resident receives notification.

Collection requires:

- collected by
- collected timestamp

Optional OTP can be added for verification.

---

# 18. Move-In / Move-Out

Request:

- resident
- unit
- movement type
- date
- time slot
- vehicle
- vendor/movers
- documents

Statuses:

`REQUESTED`
`UNDER_REVIEW`
`APPROVED`
`REJECTED`
`COMPLETED`
`CANCELLED`

Rules:

- date must be valid
- configurable time slots
- approval required
- duplicate overlapping requests should be prevented

Document upload:

- ID proof
- rental agreement
- owner authorization
- other required documents

Documents should be private and permission-controlled.

---

# 19. Committee Decision Manager

Meeting:

- title
- date/time
- location
- attendees
- agenda

Agenda item:

- title
- description
- proposer

Decision:

- decision text
- decision status
- responsible person
- deadline

Statuses:

`OPEN`
`IN_PROGRESS`
`COMPLETED`
`CANCELLED`

Minutes can be generated as PDF.

Every decision should be searchable.

---

# 20. Notifications

Notification types:

- complaint assigned
- complaint status changed
- complaint overdue
- task due
- maintenance invoice generated
- payment received
- payment overdue
- expense approval requested
- announcement published
- parcel received
- move request approved/rejected
- vendor contract expiring

Channels:

- in-app
- email
- WhatsApp adapter

Notification records:

- recipient
- template
- channel
- delivery status
- sent timestamp
- provider message ID
- failure reason

Retries must be safe and idempotent.

---

# 21. Search

Global search across authorized records.

Search:

- unit number
- resident
- complaint
- vendor
- invoice
- expense
- parking slot
- vehicle number
- parcel tracking number

Search must respect permissions and society tenant boundaries.

---

# 22. Reports

Reports:

- complaint SLA report
- complaint category report
- task completion report
- maintenance collection report
- outstanding dues
- expense report
- vendor expense report
- staff attendance
- parking allocation
- parcel report
- move-in/out report
- committee decisions

Export:

- CSV
- PDF where applicable

Exports must be generated from actual data.

---

# 23. Audit Log

Audit every important mutation:

- login/security events
- role changes
- unit changes
- complaint changes
- invoice changes
- payment changes
- expense approvals
- parking assignments
- move approvals
- committee decisions

Audit fields:

- actor
- action
- entity
- entity ID
- old value
- new value
- timestamp
- IP where available
- user agent where available

Audit logs cannot be edited from the application.

---

# 24. Authentication & Authorization

Authentication:

- email/password
- email verification
- password reset
- session management
- logout all sessions

Authorization:

Use RBAC plus resource-level checks.

Example:

A resident can only:

- view own unit
- view own invoices
- view own payments
- create/view own complaints
- view announcements targeted to them
- view own parking
- view own parcels
- create own move requests

A committee member can access committee-approved operational modules.

Server-side authorization is mandatory.

Never rely only on hidden frontend buttons.

---

# 25. Multi-Tenancy

Society is the primary tenant boundary.

Every tenant-owned table should contain:

`organization_id` / `society_id`

Every query must apply the current tenant scope.

Recommended service pattern:

```ts
service.list({
  societyId,
  filters
})
```

Never expose arbitrary society IDs from client input without authorization.

Cross-tenant access tests are mandatory.

---

# 26. Data Model

Core tables:

- users
- sessions
- societies
- society_members
- roles
- permissions
- buildings
- floors
- units
- unit_members
- complaints
- complaint_comments
- complaint_attachments
- complaint_assignments
- tasks
- task_checklists
- task_instances
- vendors
- vendor_documents
- staff
- staff_attendance
- announcements
- announcement_reads
- invoices
- invoice_items
- payments
- payment_allocations
- expenses
- expense_approvals
- parking_slots
- parking_assignments
- vehicles
- visitor_parking
- parcels
- move_requests
- move_documents
- meetings
- meeting_attendees
- agenda_items
- committee_decisions
- notifications
- notification_deliveries
- audit_logs
- file_assets
- subscriptions
- plans
- usage_events

Use UUIDs for externally exposed identifiers.

Use database-generated timestamps.

Use foreign keys and indexes.

---

# 27. Suggested PostgreSQL Indexes

At minimum:

- society_members(society_id, user_id)
- units(society_id, unit_number)
- complaints(society_id, status)
- complaints(society_id, assigned_to)
- complaints(society_id, created_at)
- invoices(society_id, status)
- invoices(society_id, due_date)
- payments(society_id, payment_date)
- expenses(society_id, status)
- tasks(society_id, status, due_date)
- notifications(user_id, read_at)
- audit_logs(society_id, created_at)

Use unique constraints for:

- society slug
- unit number within society/building
- vehicle registration within society
- invoice number within society

---

# 28. API Architecture

Use Next.js App Router.

Preferred structure:

```text
src/
  app/
    (auth)/
    (dashboard)/
    api/
  components/
  features/
    complaints/
    tasks/
    maintenance/
    expenses/
    vendors/
    staff/
    parking/
    parcels/
    announcements/
    move-in-out/
    committee/
  lib/
    auth/
    db/
    permissions/
    notifications/
    audit/
    files/
    validation/
  server/
    services/
    repositories/
  types/
```

Business logic must not live directly inside UI components.

Route handlers/actions call services.

Services validate authorization and invoke repositories.

Repositories handle persistence.

---

# 29. Validation

Use Zod for input schemas.

Validate:

- forms
- API payloads
- imports
- query parameters
- environment variables

Never trust client-side validation alone.

---

# 30. File Storage

Do not store binary files in PostgreSQL.

Store metadata in `file_assets`.

Recommended storage adapter:

```ts
interface FileStorage {
  upload(input): Promise<FileAsset>
  download(id): Promise<ReadableStream>
  delete(id): Promise<void>
}
```

The implementation can use an S3-compatible object store.

Keep the adapter replaceable.

---

# 31. Background Jobs

Use a job abstraction for:

- reminders
- recurring tasks
- overdue notifications
- contract expiry alerts
- invoice generation
- report generation
- notification retries

Do not depend on a browser tab being open.

The job system must be safe for retries.

---

# 32. SaaS Subscription

Plans should be configuration-driven.

Example:

### Starter

- 1 society
- up to 100 units
- core operations

### Growth

- up to 500 units
- financial modules
- automation
- reports

### Professional

- multiple societies
- advanced reporting
- integrations
- priority support

Do not hardcode plan restrictions throughout the UI.

Use a feature/entitlement service.

---

# 33. Onboarding

Flow:

1. Create account
2. Verify email
3. Create society
4. Add building
5. Import/add units
6. Invite committee members
7. Configure complaint categories
8. Configure maintenance settings
9. Add vendors/staff
10. Start using dashboard

Show setup progress.

Avoid forcing users to configure every module before using the product.

---

# 34. UX Design System

## Brand

**Name:** DwellOps

**Positioning:** Operations platform for apartment societies.

## Color palette

Primary:
- Deep Navy: `#0F172A`
- Blue: `#2563EB`

Secondary:
- Sky: `#0EA5E9`

Success:
- Green: `#16A34A`

Warning:
- Amber: `#D97706`

Danger:
- Red: `#DC2626`

Background:
- `#F8FAFC`

Surface:
- `#FFFFFF`

Border:
- `#E2E8F0`

Text:
- Primary `#0F172A`
- Secondary `#64748B`

## Design direction

- Clean
- Practical
- Trustworthy
- Minimal
- High information density without clutter
- Rounded cards, but not excessive glassmorphism
- Strong typography
- Clear status badges
- Consistent empty states
- Responsive tables
- Mobile-friendly forms

Use one primary action per screen.

Avoid decorative gradients in operational screens.

---

# 35. Accessibility

Target WCAG 2.2 AA where practical.

Requirements:

- keyboard navigation
- visible focus states
- semantic HTML
- accessible dialogs
- labels for form controls
- sufficient contrast
- screen-reader friendly status messages
- no color-only status communication
- reduced-motion support

---

# 36. Error Handling

User-facing errors should be actionable.

Bad:

`Internal server error`

Good:

`We couldn't save the complaint. Check your connection and try again.`

Server logs must contain:

- request ID
- actor ID
- society ID
- route
- error type
- stack trace
- timestamp

Do not expose stack traces to users.

---

# 37. Security Requirements

- HTTPS only in production
- secure cookies
- CSRF protection where applicable
- rate limiting on authentication endpoints
- password hashing using a modern password hashing algorithm
- authorization on every protected mutation
- file access authorization
- tenant isolation
- input validation
- SQL injection prevention through parameterized queries/ORM
- audit logs
- secret values only in environment variables
- no secrets committed to Git
- dependency scanning
- backup strategy
- database restore procedure

---

# 38. Testing Strategy

## Unit

Test:

- pricing/billing calculations
- SLA calculations
- permission rules
- recurring task generation
- invoice status transitions
- payment allocation
- validation schemas

## Integration

Test:

- database repositories
- authorization
- notification adapters
- invoice/payment workflows

## E2E

Critical journeys:

1. Society onboarding
2. Resident creates complaint
3. Manager assigns complaint
4. Staff resolves complaint
5. Resident confirms
6. Invoice generation
7. Manual payment
8. Expense approval
9. Vendor creation
10. Parking assignment
11. Parcel receipt/collection
12. Move request approval
13. Committee decision
14. Announcement/read tracking

## Security tests

- cross-society access
- unauthorized role access
- direct API access without UI
- file authorization
- ID enumeration
- session invalidation

---

# 39. Observability

Production should have:

- structured logging
- error tracking
- request IDs
- database monitoring
- API latency tracking
- job failure tracking
- notification delivery monitoring

Dashboard KPIs:

- active societies
- active users
- complaints created/resolved
- invoices generated
- payment success
- failed jobs
- failed notifications

---

# 40. Deployment

## Vercel

Deploy:

- Next.js application
- preview environments
- production environment

## Render

PostgreSQL:

- production DB
- staging DB
- automated backups
- connection pooling

Never connect production credentials to local development.

Environment variables:

```text
DATABASE_URL=
DIRECT_DATABASE_URL=
AUTH_SECRET=
NEXT_PUBLIC_APP_URL=
STORAGE_ENDPOINT=
STORAGE_BUCKET=
STORAGE_ACCESS_KEY=
STORAGE_SECRET_KEY=
EMAIL_API_KEY=
WHATSAPP_API_KEY=
```

Secrets must not be committed.

---

# 41. Environments

### Local

Developer machine.

### Preview

Pull-request/branch deployment.

### Staging

Production-like testing.

### Production

Real customer data.

Database migrations must be version-controlled.

Never manually modify production schema.

---

# 42. Definition of Done

A feature is complete only when:

- UI exists
- backend/service exists
- database migration exists
- validation exists
- authorization exists
- loading state exists
- empty state exists
- error state exists
- success state exists
- audit logging exists where relevant
- notifications exist where relevant
- unit/integration tests exist
- E2E test exists for critical flow
- responsive behavior is verified
- no hardcoded fake data remains
- documentation is updated

---

# 43. Non-Goals for V1

Do not build initially:

- biometric attendance
- full accounting/ERP
- payroll
- CCTV integration
- smart locks
- IoT sensors
- native iOS app
- native Android app
- complex visitor gate automation
- AI chatbot
- arbitrary custom workflow builder

The product should become useful before becoming huge.

---

# 44. Recommended Build Order

## Sprint 1

- project setup
- authentication
- society setup
- buildings/units
- users/roles
- dashboard shell
- audit foundation

## Sprint 2

- complaints
- assignments
- comments
- attachments
- notifications

## Sprint 3

- tasks
- vendors
- staff attendance
- announcements

## Sprint 4

- maintenance invoices
- payments
- receipts

## Sprint 5

- expenses
- approvals
- reports

## Sprint 6

- parking
- parcels
- move-in/out
- committee

## Sprint 7

- subscriptions
- usage limits
- onboarding polish
- security hardening
- observability

---

# 45. Primary Success Metrics

Product:

- time to first society setup
- time to first complaint resolution
- weekly active residents
- weekly active managers
- complaint resolution rate
- overdue complaint rate
- maintenance collection rate
- payment reconciliation rate
- task completion rate

Business:

- societies onboarded
- active paid societies
- trial-to-paid conversion
- monthly recurring revenue
- churn
- average revenue per society

---

# 46. Core Product Promise

DwellOps should answer four questions immediately:

1. **What needs attention?**
2. **Who is responsible?**
3. **What is the current status?**
4. **What happened previously?**

If a feature does not improve one of these questions, it should be questioned before being added.
