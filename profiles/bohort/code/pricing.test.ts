import { describe, expect, it } from "vitest";
import { computeTotal, vatRateFor } from "./pricing";

describe("vatRateFor", () => {
  it("returns the rate for the country", () => {
    expect(vatRateFor("DE")).toBe(0.19);
  });

  it("falls back to the default rate for an unknown country", () => {
    expect(vatRateFor("XX")).toBe(0.2);
  });
});

describe("computeTotal", () => {
  it("applies the country VAT", () => {
    expect(computeTotal([{ unitPrice: 100, quantity: 2 }], "FR")).toBe(240);
  });

  it("returns 0 for an empty list", () => {
    expect(computeTotal([], "FR")).toBe(0);
  });

  it("rounds to two decimals", () => {
    expect(computeTotal([{ unitPrice: 0.1, quantity: 3 }], "FR")).toBe(0.36);
  });

  it("rejects a negative quantity instead of computing it", () => {
    expect(() => computeTotal([{ unitPrice: 100, quantity: -2 }], "FR")).toThrow();
  });
});
