import {
  businessDateFor,
  localDateStr,
  type DayClose,
  type Order,
} from "@yf/core";
import { getRepo } from "./db";
import { emailConfigured, getPaperWidthMm } from "./settings";
import { buildDailyExcelB64, dailyEmailBody, dailyEmailSubject } from "./report/daily";
import { renderDayReportHtml } from "./printing/renderDayReportHtml";
import { printHtml } from "./printing/printer";

// Close Day orchestration. The business day is defined by the Close Day button:
// closing prints the day report, queues the HQ email, and pushes any later
// sale to the next day (see @yf/core closeday.ts for the stamping rule).

/** The business day a sale made right now belongs to. */
export async function currentBusinessDate(companyId: number): Promise<string> {
  const repo = await getRepo();
  const today = localDateStr(Date.now());
  const closed = await repo.getDayClose(today, companyId);
  return businessDateFor(Date.now(), closed != null);
}

export async function getTodayClose(companyId: number): Promise<DayClose | null> {
  const repo = await getRepo();
  return repo.getDayClose(localDateStr(Date.now()), companyId);
}

async function queueDailyEmail(
  companyId: number,
  companyName: string,
  businessDate: string,
  orders: Order[],
  auto: boolean,
): Promise<void> {
  const repo = await getRepo();
  const catalog = await repo.listItems(true, companyId);
  await repo.queueEmail({
    companyId,
    businessDate,
    subject: dailyEmailSubject(companyName, businessDate, auto),
    body: dailyEmailBody(companyName, businessDate, orders, auto),
    attachmentName: `${companyName.replace(/\s+/g, "-")}-sales-${businessDate}.xlsx`,
    attachmentB64: buildDailyExcelB64(orders, catalog),
  });
  // Nudge the main-process mailer; it also retries on its own timer.
  void window.mailer?.process().catch(() => {});
}

/**
 * Close a business day: record the close, queue the HQ email, and (for a
 * manual close) print the paper day report. Returns that day's orders.
 */
export async function performClose(
  businessDate: string,
  opts: { companyId: number; companyName: string; auto?: boolean; print?: boolean },
): Promise<Order[]> {
  const repo = await getRepo();
  const orders = await repo.listOrdersByBusinessDate(businessDate, businessDate, opts.companyId);
  await repo.closeDay(businessDate, { companyId: opts.companyId, auto: opts.auto ?? false });
  await queueDailyEmail(opts.companyId, opts.companyName, businessDate, orders, opts.auto ?? false);
  if (opts.print) {
    const paperWidthMm = await getPaperWidthMm();
    await printHtml(
      renderDayReportHtml({ storeName: opts.companyName, businessDate, orders, paperWidthMm }),
    ).catch(() => {}); // a printer problem must not block the close
  }
  return orders;
}

/** Undo today's close (PIN-gated in the UI). */
export async function performReopen(companyId: number): Promise<void> {
  const repo = await getRepo();
  await repo.reopenDay(localDateStr(Date.now()), companyId);
}

/**
 * The forgot-to-close fallback, run at app launch: any past business day with
 * sales but no close record is closed automatically and its report emailed to
 * HQ flagged "auto-closed". Nothing is printed. Skips the email quietly when
 * SMTP isn't configured yet (e.g. browser dev), so old demo days don't spam
 * the outbox.
 */
export async function autoCloseUnclosedDays(): Promise<string[]> {
  const repo = await getRepo();
  const today = localDateStr(Date.now());
  const canEmail = await emailConfigured();
  const closedDates: string[] = [];
  for (const company of await repo.listCompanies()) {
    for (const date of await repo.listUnclosedDays(today, company.id)) {
      const orders = await repo.listOrdersByBusinessDate(date, date, company.id);
      await repo.closeDay(date, { companyId: company.id, auto: true });
      if (canEmail) await queueDailyEmail(company.id, company.name, date, orders, true);
      closedDates.push(date);
    }
  }
  return closedDates;
}
