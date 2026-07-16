import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const DEFAULT_FROM = process.env.EMAIL_FROM || "no-reply@nexium-os.local";

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string | string[];
};

/**
 * Thin wrapper around Resend for sending emails.
 * For now this sends from a Nexium OS address; in future this can be
 * extended to send via user-connected providers (Gmail, Outlook, etc.).
 */
export async function sendEmail(input: SendEmailInput) {
  if (!resend) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const { to, subject, html, text, replyTo } = input;

  const payload: Record<string, unknown> = {
    from: DEFAULT_FROM,
    to,
    subject,
  };
  if (html) payload.html = html;
  if (text) payload.text = text;
  if (replyTo) payload.replyTo = replyTo;

  // Resend v4 types expect react; we use html/text. Cast to satisfy compiler.
  return resend.emails.send(payload as unknown as Parameters<typeof resend.emails.send>[0]);
}

