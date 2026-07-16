/**
 * Mail provider routing: send email via Gmail, SMTP, or Resend fallback.
 * Uses org-level credentials from Settings (or env fallback).
 */
import { google } from "googleapis";
import nodemailer from "nodemailer";
import type { MailAccount } from "@prisma/client";
import { Resend } from "resend";
import { decrypt } from "./mail-encrypt";
import { getMailConfigForOrg } from "./mail-org-config";

export type SendEmailPayload = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  from: string;
  fromName?: string;
};

type MailConfig = {
  gmail?: { accessToken: string; refreshToken: string; expiresAt?: number };
  smtp?: { host: string; port: number; secure: boolean; user: string; password: string };
};

function getConfig(account: MailAccount): MailConfig | null {
  const c = account.config as MailConfig | null;
  return c && typeof c === "object" ? c : null;
}

async function sendViaGmail(account: MailAccount, payload: SendEmailPayload): Promise<void> {
  const accountConfig = getConfig(account)?.gmail;
  if (!accountConfig?.accessToken || !accountConfig?.refreshToken) {
    throw new Error("Gmail account not properly connected. Reconnect in Settings.");
  }

  const orgConfig = await getMailConfigForOrg(account.organisationId);
  if (!orgConfig.googleClientId || !orgConfig.googleClientSecret) {
    throw new Error("Gmail OAuth not configured. Super Admin: configure in Settings → Email.");
  }

  const oauth2Client = new google.auth.OAuth2(
    orgConfig.googleClientId,
    orgConfig.googleClientSecret,
    `${orgConfig.appUrl}/api/mail/oauth/gmail/callback`
  );

  oauth2Client.setCredentials({
    access_token: accountConfig.accessToken,
    refresh_token: accountConfig.refreshToken,
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const to = Array.isArray(payload.to) ? payload.to : [payload.to];
  const contentType = payload.html ? "text/html; charset=utf-8" : "text/plain; charset=utf-8";
  const body = payload.html || payload.text || "";
  const raw = [
    `From: ${payload.fromName ? `"${payload.fromName}" ` : ""}<${payload.from}>`,
    `To: ${to.join(", ")}`,
    `Subject: ${payload.subject}`,
    payload.replyTo ? `Reply-To: ${payload.replyTo}` : "",
    "MIME-Version: 1.0",
    `Content-Type: ${contentType}`,
    "",
    body,
  ]
    .filter(Boolean)
    .join("\r\n");

  const encoded = Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: encoded },
  });
}

async function sendViaSmtp(account: MailAccount, payload: SendEmailPayload): Promise<void> {
  const config = getConfig(account)?.smtp;
  if (!config?.host || !config?.user) {
    throw new Error("SMTP account not properly configured. Check Settings.");
  }

  let password = config.password;
  if (password.startsWith("enc:")) {
    try {
      password = decrypt(password.slice(4));
    } catch {
      throw new Error("SMTP password could not be decrypted. Re-enter credentials in Settings.");
    }
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port || (config.secure ? 465 : 587),
    secure: config.secure,
    auth: { user: config.user, pass: password },
  });

  const to = Array.isArray(payload.to) ? payload.to : [payload.to];
  await transporter.sendMail({
    from: payload.fromName ? `"${payload.fromName}" <${payload.from}>` : payload.from,
    to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
    replyTo: payload.replyTo,
  });
}

async function sendViaResend(account: MailAccount, payload: SendEmailPayload): Promise<void> {
  const orgConfig = await getMailConfigForOrg(account.organisationId);
  if (!orgConfig.resendApiKey) {
    throw new Error("Resend not configured. Super Admin: go to Settings → Email → Mail Provider Configuration.");
  }
  const resend = new Resend(orgConfig.resendApiKey);
  const to = Array.isArray(payload.to) ? payload.to : [payload.to];
  const from = orgConfig.emailFrom;
  const body: Record<string, unknown> = {
    from: payload.fromName ? `"${payload.fromName}" <${from}>` : from,
    to,
    subject: payload.subject,
    replyTo: account.email,
  };
  if (payload.text) body.text = payload.text;
  if (payload.html) body.html = payload.html;
  await resend.emails.send(body as unknown as Parameters<typeof resend.emails.send>[0]);
}

/**
 * Send email using the account's configured provider.
 */
export async function sendEmailForAccount(
  account: MailAccount,
  payload: SendEmailPayload
): Promise<void> {
  const provider = account.provider || "resend_only";
  const from = account.email;
  const fromName = account.displayName || undefined;
  const fullPayload: SendEmailPayload = {
    ...payload,
    from: payload.from || from,
    fromName: payload.fromName || fromName,
  };

  if (provider === "gmail") {
    await sendViaGmail(account, fullPayload);
  } else if (provider === "smtp") {
    await sendViaSmtp(account, fullPayload);
  } else {
    await sendViaResend(account, fullPayload);
  }
}
