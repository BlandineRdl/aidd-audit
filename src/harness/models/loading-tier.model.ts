// INVARIANT: exactly two values. ALWAYS_LOADED is what the tool reads at every session opening —
// the context file and everything it pulls in, transitively, plus every declaration whose summary
// is present from the first turn. CONDITIONALLY_LOADED is everything read only once something
// triggers it, reported as a worst-case ceiling rather than an opening cost. A third value would
// need its own totalling rule wherever a report sums a tier, so the set stays closed rather than an
// open string.
export const LOADING_TIERS = ['ALWAYS_LOADED', 'CONDITIONALLY_LOADED'] as const

export type LoadingTier = (typeof LOADING_TIERS)[number]
