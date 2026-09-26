import { getSessionUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { attachmentService } from "@/server/services/attachmentService";

// Private file download. Auth + tenant + complaint visibility are checked on every request.
export async function GET(_: Request, { params }: RouteContext<"/api/files/[id]">): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return new Response("Not found", { status: 404 });
  const { id } = await params;
  try {
    const file = await attachmentService.openFile(user, id);
    return new Response(Buffer.from(file.bytes), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(file.bytes.length),
        "Content-Disposition": `inline; filename="${file.name.replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (e) {
    if (e instanceof AppError) return new Response("Not found", { status: 404 });
    throw e;
  }
}
