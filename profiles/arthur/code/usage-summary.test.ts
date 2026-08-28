import { describe, expect, it } from "vitest";
import { summarise } from "./usage-summary";
import type { Plan, UsageEvent } from "./types";

const plan: Plan = { tier: "growth", includedUnits: 1000 };
const period = { from: new Date("2026-07-01"), to: new Date("2026-08-01") };
const event = (day: string, units: number): UsageEvent => ({ at: new Date(day), units });

describe("summarise", () => {
  it("counts nothing when there is no event", () => {
    expect(summarise([], plan, period)).toEqual({
      included: 1000,
      used: 0,
      overage: 0,
      overageCents: 0,
    });
  });

  it("bills only what exceeds the included units", () => {
    const summary = summarise([event("2026-07-10", 900), event("2026-07-20", 250)], plan, period);
    expect(summary.used).toBe(1150);
    expect(summary.overage).toBe(150);
    expect(summary.overageCents).toBe(750);
  });

  it("ignores an event from the previous period", () => {
    const summary = summarise([event("2026-06-30", 500), event("2026-07-02", 10)], plan, period);
    expect(summary.used).toBe(10);
  });

  it("excludes the first instant of the next period", () => {
    const summary = summarise([event("2026-08-01", 40)], plan, period);
    expect(summary.used).toBe(0);
  });

  it("prices the same overage differently per tier", () => {
    const events = [event("2026-07-05", 1100)];
    const starter = summarise(events, { tier: "starter", includedUnits: 1000 }, period);
    const scale = summarise(events, { tier: "scale", includedUnits: 1000 }, period);
    expect(starter.overageCents).toBe(800);
    expect(scale.overageCents).toBe(300);
  });
});
