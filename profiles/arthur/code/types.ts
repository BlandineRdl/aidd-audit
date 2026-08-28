export interface UsageEvent {
  at: Date;
  units: number;
}

export interface Plan {
  tier: "starter" | "growth" | "scale";
  includedUnits: number;
}
