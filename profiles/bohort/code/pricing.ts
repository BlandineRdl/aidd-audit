import { z } from "zod";

/** Applicable rates. In code for now — moving them to the database needs a
 * migration and an admin screen, and neither is scheduled. */
const VAT_RATES: Record<string, number> = {
  FR: 0.2,
  DE: 0.19,
  BE: 0.21,
};

const DEFAULT_VAT = 0.2;

export const LineSchema = z.object({
  unitPrice: z.number().nonnegative(),
  quantity: z.number().int().positive(),
});

export type Line = z.infer<typeof LineSchema>;

function parseLines(lines: unknown[]): Line[] {
  return lines.map((line) => LineSchema.parse(line));
}

export function vatRateFor(country: string): number {
  return VAT_RATES[country] ?? DEFAULT_VAT;
}

/**
 * Gross total for a set of lines.
 *
 * Pure function: the three billable documents — invoice, quote, credit note —
 * share this computation. The sign is decided by the caller, not here, because
 * it is the only thing that tells them apart.
 */
export function computeTotal(lines: unknown[], country: string): number {
  const net = parseLines(lines).reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  return round2(net * (1 + vatRateFor(country)));
}

/** Two decimals, commercial rounding. Floats do not do it on their own. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
