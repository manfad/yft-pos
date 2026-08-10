import { getRepo } from "./db";

// Typed accessors over the DB `settings` table. The same rows are read by the
// Electron main process (SMTP credentials, recipient) — the table is the one
// config channel both sides share.

export const SETTING_KEYS = {
  pin: "pin",
  smtpUser: "smtp_user", // legacy fallback — the sender now lives in .env (SMTP_USER)
  smtpPass: "smtp_pass", // legacy fallback — the App Password now lives in .env (SMTP_PASS)
  recipient: "report_recipient", // legacy single HQ email (pre-list installs)
  recipients: "report_recipients", // newline/comma-separated list the report is sent TO
  paperWidthMm: "paper_width_mm",
} as const;

/** Confirmation PIN (void / reopen / settings). Defaults to 1234 until changed. */
export async function getPin(): Promise<string> {
  const repo = await getRepo();
  return (await repo.getSetting(SETTING_KEYS.pin)) ?? "1234";
}

export async function getPaperWidthMm(): Promise<number> {
  const repo = await getRepo();
  const v = Number(await repo.getSetting(SETTING_KEYS.paperWidthMm));
  return v === 58 ? 58 : 80;
}

export const parseRecipients = (raw: string): string[] =>
  raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.includes("@"));

/** Report recipients from the DB list, falling back to the legacy single email. */
export async function getReportRecipients(): Promise<string[]> {
  const repo = await getRepo();
  const list = parseRecipients((await repo.getSetting(SETTING_KEYS.recipients)) ?? "");
  if (list.length) return list;
  const legacy = await repo.getSetting(SETTING_KEYS.recipient);
  return legacy ? [legacy] : [];
}

/** True once the sender credentials (.env on the till) + a recipient exist. */
export async function emailConfigured(): Promise<boolean> {
  const recipients = await getReportRecipients();
  if (recipients.length === 0) return false;
  const config = await window.mailer?.config?.().catch(() => null);
  if (config) return config.hasCredentials;
  // Browser build / older preload: fall back to the legacy in-DB credentials.
  const repo = await getRepo();
  const [u, p] = await Promise.all([
    repo.getSetting(SETTING_KEYS.smtpUser),
    repo.getSetting(SETTING_KEYS.smtpPass),
  ]);
  return !!(u && p);
}
