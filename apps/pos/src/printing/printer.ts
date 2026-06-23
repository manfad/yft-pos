import type { Receipt } from "@yf/core";
import { renderReceiptHtml } from "./renderReceiptHtml";

// Swappable printer boundary — mirrors how SqlDriver abstracts storage. Today
// we print through the browser/OS pipeline; an ESC/POS (WebUSB) driver can drop
// in behind this interface later for auto-cut / cash-drawer with no UI changes.

export interface ReceiptPrinter {
  readonly label: string;
  print(receipt: Receipt): Promise<void>;
}

/**
 * Prints via a hidden iframe + the OS print dialog. Works fully offline with any
 * driver-installed printer. In Chrome/Edge launched with `--kiosk-printing` it
 * prints silently to the default printer (no dialog) — the touchscreen setup.
 */
export const htmlPrinter: ReceiptPrinter = {
  label: "Browser / OS printer",
  print(receipt) {
    return new Promise<void>((resolve) => {
      const iframe = document.createElement("iframe");
      Object.assign(iframe.style, {
        position: "fixed",
        right: "0",
        bottom: "0",
        width: "0",
        height: "0",
        border: "0",
      });
      document.body.appendChild(iframe);

      let done = false;
      const cleanup = () => {
        if (done) return;
        done = true;
        setTimeout(() => iframe.remove(), 500);
        resolve();
      };

      const win = iframe.contentWindow;
      const doc = win?.document;
      if (!win || !doc) {
        iframe.remove();
        resolve();
        return;
      }

      doc.open();
      doc.write(renderReceiptHtml(receipt));
      doc.close();

      win.onafterprint = cleanup;
      // Let layout/fonts settle, then print. Fallback cleanup if onafterprint
      // never fires (varies by browser).
      win.requestAnimationFrame(() => {
        win.focus();
        win.print();
        setTimeout(cleanup, 2000);
      });
    });
  },
};

/** The active printer. Swap this to change hardware backends. */
export const printer: ReceiptPrinter = htmlPrinter;
