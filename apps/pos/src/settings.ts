import { getRepo } from "./db";

// Typed accessors over the DB `settings` table. The same rows are read by the
// Electron main process (SMTP credentials, recipient) — the table is the one
// config channel both sides share.

export const SETTING_KEYS = {
  pin: "pin",
  smtpUser: "smtp_user", // the dedicated Gmail address the report is sent FROM
  smtpPass: "smtp_pass", // its Gmail App Password
  recipient: "report_recipient", // HQ email the report is sent TO
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

/** True once the Gmail sender + HQ recipient are configured. */
export async function emailConfigured(): Promise<boolean> {
  const repo = await getRepo();
  const [u, p, r] = await Promise.all([
    repo.getSetting(SETTING_KEYS.smtpUser),
    repo.getSetting(SETTING_KEYS.smtpPass),
    repo.getSetting(SETTING_KEYS.recipient),
  ]);
  return !!(u && p && r);
}
