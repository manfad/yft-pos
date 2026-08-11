import { describe, expect, it } from "vitest";
import { useCentsEntry } from "./centsEntry";

describe("useCentsEntry", () => {
  it("starts empty and reads 0.00", () => {
    const e = useCentsEntry();
    expect(e.cents.value).toBe(0);
    expect(e.text.value).toBe("0.00");
  });

  it("fills from the cent column", () => {
    const e = useCentsEntry();
    for (const d of "300") e.push(d);
    expect(e.text.value).toBe("3.00");
    expect(e.cents.value).toBe(300);
  });

  it("reads 5.50 for 5,5,0", () => {
    const e = useCentsEntry();
    for (const d of "550") e.push(d);
    expect(e.text.value).toBe("5.50");
  });

  it("takes multi-digit pushes (the 00 key)", () => {
    const e = useCentsEntry();
    e.push("1");
    e.push("00");
    expect(e.text.value).toBe("1.00");
  });

  it("backspaces the rightmost digit", () => {
    const e = useCentsEntry();
    for (const d of "1234") e.push(d);
    expect(e.text.value).toBe("12.34");
    e.backspace();
    expect(e.text.value).toBe("1.23");
    e.clear();
    expect(e.text.value).toBe("0.00");
  });

  it("ignores leading zeroes and non-digits", () => {
    const e = useCentsEntry();
    e.push("0");
    e.push("0");
    e.push("7");
    expect(e.digits.value).toBe("7");
    e.push(".");
    expect(e.digits.value).toBe("7");
  });

  it("caps the amount so the display cannot overflow", () => {
    const e = useCentsEntry();
    for (let i = 0; i < 14; i++) e.push("9");
    expect(e.digits.value).toHaveLength(9);
  });

  it("seeds from an existing amount", () => {
    const e = useCentsEntry(1250);
    expect(e.text.value).toBe("12.50");
    e.reset();
    expect(e.text.value).toBe("0.00");
  });
});
