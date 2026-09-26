import "server-only";
import { logger } from "@/lib/logging/logger";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailProvider {
  readonly name: string;
  send(msg: EmailMessage): Promise<{ id?: string }>;
}

/** Dev: prints the email (including links) to the server console. Never used in production. */
class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";
  async send(msg: EmailMessage) {
    logger.info("email (console provider)", { to: msg.to, subject: msg.subject, text: msg.text });
    return {};
  }
}

/** Tests: keeps messages in memory so tests can read links. */
export class MemoryEmailProvider implements EmailProvider {
  readonly name = "memory";
  readonly outbox: EmailMessage[] = [];
  async send(msg: EmailMessage) {
    this.outbox.push(msg);
    return {};
  }
}

/** Production: Resend HTTP API. Swap for another provider by implementing EmailProvider. */
class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}
  async send(msg: EmailMessage) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: this.from, to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html }),
    });
    if (!res.ok) throw new Error(`Email provider responded ${res.status}`);
    const body = (await res.json().catch(() => ({}))) as { id?: string };
    return { id: body.id };
  }
}

const g = globalThis as unknown as { __nivasoEmail?: EmailProvider };

export function emailProvider(): EmailProvider {
  if (g.__nivasoEmail) return g.__nivasoEmail;
  const key = process.env.EMAIL_API_KEY;
  let provider: EmailProvider;
  if (process.env.NODE_ENV === "test") provider = new MemoryEmailProvider();
  else if (process.env.EMAIL_PROVIDER === "console") provider = new ConsoleEmailProvider(); // explicit opt-in (E2E, previews)
  else if (key) provider = new ResendEmailProvider(key, process.env.EMAIL_FROM ?? "Nivaso Plus <no-reply@nivasoplus.app>");
  else if (process.env.NODE_ENV === "production") throw new Error("EMAIL_API_KEY is required in production.");
  else provider = new ConsoleEmailProvider();
  g.__nivasoEmail = provider;
  return provider;
}

/** Sends and logs failures without throwing: an email outage must not break the user's action. */
export async function sendEmail(msg: EmailMessage): Promise<boolean> {
  try {
    await emailProvider().send(msg);
    return true;
  } catch (err) {
    logger.error("email send failed", { to: msg.to, subject: msg.subject, error: err instanceof Error ? err.message : String(err) });
    return false;
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Simple branded layout with one call-to-action button. */
export function actionEmail(opts: { to: string; subject: string; heading: string; intro: string; cta: string; url: string; footer: string }): EmailMessage {
  const text = `${opts.heading}\n\n${opts.intro}\n\n${opts.cta}: ${opts.url}\n\n${opts.footer}\n\n— Nivaso Plus`;
  const html = `<!doctype html><html><body style="margin:0;background:#F7F6F3;font-family:Inter,Arial,sans-serif;color:#121826">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#fff;border:1px solid #E7E4DE;border-radius:16px">
<tr><td style="padding:28px">
<p style="margin:0 0 20px;font-weight:700;font-size:18px">nivaso<span style="color:#F4A62A">plus</span></p>
<h1 style="margin:0 0 12px;font-size:20px">${esc(opts.heading)}</h1>
<p style="margin:0 0 24px;font-size:14px;line-height:22px;color:#5F6672">${esc(opts.intro)}</p>
<a href="${esc(opts.url)}" style="display:inline-block;background:#0D7C79;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 18px;border-radius:10px">${esc(opts.cta)}</a>
<p style="margin:24px 0 0;font-size:12px;line-height:18px;color:#8C919B">${esc(opts.footer)}</p>
</td></tr></table></td></tr></table></body></html>`;
  return { to: opts.to, subject: opts.subject, text, html };
}
