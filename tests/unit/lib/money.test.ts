import { describe, expect, it } from "vitest";
import { formatPaise, rupeesToPaise } from "@/lib/money";

describe("rupeesToPaise", () => {
  it("converts without floating-point error", () => {
    expect(rupeesToPaise("1250.50")).toBe(125050);
    expect(rupeesToPaise("1250.5")).toBe(125050);
    expect(rupeesToPaise("0.1")).toBe(10);
    expect(rupeesToPaise("0.29")).toBe(29);
    expect(rupeesToPaise("1250")).toBe(125000);
  });

  it("rejects malformed amounts", () => {
    for (const bad of ["", "-1", "1.234", "abc", "1,000"]) expect(() => rupeesToPaise(bad)).toThrow();
  });
});

describe("formatPaise", () => {
  it("formats in Indian grouping", () => {
    expect(formatPaise(12345605)).toBe("₹1,23,456.05");
    expect(formatPaise(0)).toBe("₹0.00");
  });
});
