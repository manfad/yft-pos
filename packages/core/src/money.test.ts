import { describe, expect, it } from "vitest";
import { fmtQty, fmtQtyUnit } from "./money.js";

describe("quantity formatting", () => {
  it("preserves kilogram precision stored in thousandths", () => {
    expect(fmtQtyUnit(1250, "kg")).toBe("1.25 kg");
    expect(fmtQtyUnit(1005, "kg")).toBe("1.005 kg");
  });

  it("does not add insignificant zeroes", () => {
    expect(fmtQty(1000)).toBe("1");
    expect(fmtQty(1500)).toBe("1.5");
  });
});
