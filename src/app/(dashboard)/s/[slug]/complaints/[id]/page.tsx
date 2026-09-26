import { ComplaintPhotos } from "@/features/complaints/components/complaint-photos";
import { MAX_PHOTOS_PER_COMPLAINT } from "@/lib/storage/images";
import { requirePageContext } from "@/lib/auth/page";
import { unitLabel } from "@/lib/units";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { hasPermission } from "@/lib/auth/context";
import { AppError } from "@/lib/errors";
import { complaintService } from "@/server/services/complaintService";
import { societyService } from "@/server/services/societyService";
import { Alert } from "@/components/ui/feedback";
import { ActionForm } from "@/components/forms/action-form";
import { SubmitButton, TextAreaField } from "@/components/forms/fields";
import { ComplaintActions } from "@/features/complaints/components/complaint-actions";
import { OverdueBadge, PriorityText, StatusBadge } from "@/features/complaints/components/status-badge";
import { COMPLAINT_CATEGORIES, STATUS_LABEL } from "@/features/complaints/constants";
import { isOverdue } from "@/features/complaints/domain";
import { complaintOpAction } from "@/features/complaints/mutations";
import { allowedComplaintActions } from "@/features/complaints/permissions";
import { formatDateTime, relativeTime } from "@/lib/format";
import { formatPaise } from "@/lib/money";

export const metadata = { title: "Complaint" };

export default async function ComplaintDetailPage({ params, searchParams }: PageProps<"/s/[slug]/complaints/[id]">) {
  const { slug, id } = await params;
  const { created } = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const ctx = await requirePageContext(slug);
  const c = await complaintService.get(ctx, id).catch((e: unknown) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const allowed = allowedComplaintActions(ctx, c);
  const assignees = allowed.assign
    ? (await societyService.listAssignees(ctx)).map((a) => ({ id: a.id, role: a.role, name: a.user.name }))
    : [];
  const names = await complaintService.actorNames(c.activities.map((a) => a.actorId));
  const category = COMPLAINT_CATEGORIES.find((x) => x.value === c.category)?.label ?? c.category;
  const open = !["RESOLVED", "CLOSED", "CANCELLED"].includes(c.status);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-6">
        <div>
          <Link href={`/s/${slug}/complaints`} className="text-sm text-muted hover:text-text">
            ← Complaints
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={c.status} />
            {isOverdue(c) && <OverdueBadge />}
            <PriorityText priority={c.priority} />
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            <span className="mr-2 font-mono text-base text-muted">#{c.number}</span>
            {c.title}
          </h1>
        </div>

        {created === "1" && <Alert tone="success">Complaint submitted. Add a photo below if it helps — we’ll notify you as it moves forward.</Alert>}

        <ComplaintActions
          slug={slug}
          complaintId={c.id}
          status={c.status}
          allowed={allowed}
          assignees={assignees}
          currentAssigneeId={c.assigneeId}
        />

        <section className="rounded-xl bg-surface p-5 shadow-sm ring-1 ring-border">
          <h2 className="text-sm font-bold">Details</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm">{c.description}</p>
          {c.resolutionNote && (
            <div className="mt-4 rounded-md bg-green-50 p-3 text-sm">
              <p className="font-medium text-green-800">Resolution</p>
              <p className="mt-1 whitespace-pre-wrap text-green-900">{c.resolutionNote}</p>
              {c.resolutionCostPaise != null && <p className="mt-1 text-green-800">Cost: {formatPaise(c.resolutionCostPaise)}</p>}
            </div>
          )}
        </section>

        <ComplaintPhotos
          slug={slug}
          complaintId={c.id}
          photos={c.attachments.map((a) => ({ id: a.file.id, name: a.file.originalName }))}
          canAdd={
            c.status !== "CLOSED" &&
            c.status !== "CANCELLED" &&
            (ctx.memberIds.includes(c.raisedById) || (!!c.assigneeId && ctx.memberIds.includes(c.assigneeId)) || hasPermission(ctx, "complaint.assign"))
          }
          max={MAX_PHOTOS_PER_COMPLAINT}
          highlight={created === "1"}
        />

        <section>
          <h2 className="mb-3 text-sm font-bold">History</h2>
          <ol className="relative space-y-4 border-l border-border pl-5">
            {c.activities.map((a) => (
              <li key={a.id} className="relative">
                <span className="absolute -left-[25px] top-1.5 size-2.5 rounded-full border-2 border-surface bg-slate-400" aria-hidden />
                <p className="text-sm">
                  <span className="font-medium">{names.get(a.actorId) ?? "Someone"}</span>{" "}
                  <span className="text-muted">
                    {a.type === "CREATED" && "raised this complaint"}
                    {a.type === "COMMENT" && "commented"}
                    {a.type === "ASSIGNED" && "assigned it"}
                    {a.type === "STATUS_CHANGED" && a.toStatus && `moved it to ${STATUS_LABEL[a.toStatus].toLowerCase()}`}
                  </span>
                  <time className="ml-2 text-xs text-muted" dateTime={a.createdAt.toISOString()}>
                    {formatDateTime(a.createdAt)}
                  </time>
                </p>
                {a.note && <p className="mt-1 whitespace-pre-wrap rounded-md bg-surface p-2 text-sm ring-1 ring-border">{a.note}</p>}
              </li>
            ))}
          </ol>
          {c.status !== "CLOSED" && c.status !== "CANCELLED" && (
            <ActionForm action={complaintOpAction.bind(null, slug, "comment")} className="mt-4 space-y-2">
              <input type="hidden" name="complaintId" value={c.id} />
              <TextAreaField label="Add a comment" name="note" rows={2} />
              <SubmitButton variant="secondary">Post comment</SubmitButton>
            </ActionForm>
          )}
        </section>
      </div>

      <aside className="space-y-4">
        <dl className="divide-y divide-border rounded-xl bg-surface shadow-sm ring-1 ring-border text-sm">
          <Row label="Owner">{c.assignee ? c.assignee.user.name : <span className="text-muted">Not assigned yet</span>}</Row>
          <Row label="Due">
            {open ? (
              <span className={isOverdue(c) ? "font-medium text-danger" : ""}>
                {formatDateTime(c.dueAt)} ({relativeTime(c.dueAt)})
              </span>
            ) : (
              "—"
            )}
          </Row>
          {c.expectedCompletion && <Row label="Expected by">{formatDateTime(c.expectedCompletion)}</Row>}
          <Row label="Category">{category}</Row>
          <Row label="Unit">{c.unit ? unitLabel(c.unit) : "Common area"}</Row>
          {c.location && <Row label="Location">{c.location}</Row>}
          {c.preferredAccessTime && <Row label="Best time">{c.preferredAccessTime}</Row>}
          <Row label="Raised by">{c.raisedBy.user.name}</Row>
          <Row label="Raised">{formatDateTime(c.createdAt)}</Row>
        </dl>
        {hasPermission(ctx, "audit.view") && (
          <Link href={`/s/${slug}/audit?entityId=${c.id}`} className="block text-sm text-primary hover:underline">
            View audit trail
          </Link>
        )}
      </aside>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 px-4 py-2.5">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
