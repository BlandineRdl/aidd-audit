import type { UsageEvent, Plan } from "./types";

export interface UsageSummary {
  included: number;
  used: number;
  overage: number;
  overageCents: number;
}

const CENTS_PER_UNIT: Record<Plan["tier"], number> = {
  starter: 8,
  growth: 5,
  scale: 3,
};

/**
 * Usage over a closed billing period.
 *
 * Events arriving outside the period are ignored rather than clamped: a clamp
 * silently moves someone else's usage into this invoice, and that is a support
 * ticket nobody can answer without the raw events.
 */
export function summarise(
  events: readonly UsageEvent[],
  plan: Plan,
  period: { from: Date; to: Date },
): UsageSummary {
  const used = events
    .filter((e) => e.at >= period.from && e.at < period.to)
    .reduce((total, e) => total + e.units, 0);

  const overage = Math.max(0, used - plan.includedUnits);

  return {
    included: plan.includedUnits,
    used,
    overage,
    overageCents: overage * CENTS_PER_UNIT[plan.tier],
  };
}
