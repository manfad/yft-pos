import { describe, expect, it } from "vitest";
import { businessDateFor, localDateStr, nextDateStr } from "./closeday.js";

describe("business-day rules", () => {
  it("formats local calendar dates", () => {
    expect(localDateStr(new Date(2026, 6, 13, 9, 30))).toBe("2026-07-13");
    expect(localDateStr(new Date(2026, 0, 1, 0, 0))).toBe("2026-01-01");
  });

  it("rolls to the next day, across month and year ends", () => {
    expect(nextDateStr("2026-07-13")).toBe("2026-07-14");
    expect(nextDateStr("2026-07-31")).toBe("2026-08-01");
    expect(nextDateStr("2026-12-31")).toBe("2027-01-01");
    expect(nextDateStr("2028-02-28")).toBe("2028-02-29"); // leap year
  });

  it("stamps sales to today while the day is open", () => {
    const now = new Date(2026, 6, 13, 15, 0);
    expect(businessDateFor(now, false)).toBe("2026-07-13");
  });

  it("pushes sales after Close Day to tomorrow", () => {
    const now = new Date(2026, 6, 13, 16, 30);
    expect(businessDateFor(now, true)).toBe("2026-07-14");
  });
});
