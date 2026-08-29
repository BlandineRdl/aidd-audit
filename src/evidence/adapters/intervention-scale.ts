import { AUTONOMOUS_INTERVENTION, ZERO_TOUCH_SHARE_FOR_AUTONOMY } from './autonomy.js'

// LIMITATION: Where a median number of corrective commits after a change was opened falls on the
// intervention scale. **Both bounds are chosen, not measured.** They came in with the recorded
// bundle format and nothing in this project establishes 2.5 over 2, or 1.5 over 1. They are shared
// because the bundle and the forge answer the same axis from the same number, and a bound the two
// read differently would break the interchangeability the collector port promises.
//
// LIMITATION: The scale's top two ranks assert that a human never intervened once the task was
// framed. A corrective-commit median cannot establish that, so `ZERO_TOUCH_SHARE_FOR_AUTONOMY`
// answers for the first of them and nothing answers for the second: `never-framing-included` is
// about who chose the task, which no delivery record carries.
const AFTER_THE_FACT_MOST_FROM = 2.5
const AFTER_THE_FACT_SOME_FROM = 1.5

// INVARIANT: `zeroTouchShare` is the share of deliveries that took no corrective commit at all,
// `null` when the source does not record it. It can only raise the answer, never lower it.
export function interventionFor(
  medianCorrectionsAfterOpen: number,
  zeroTouchShare: number | null,
): string {
  if (zeroTouchShare !== null && zeroTouchShare >= ZERO_TOUCH_SHARE_FOR_AUTONOMY) {
    return AUTONOMOUS_INTERVENTION
  }
  if (medianCorrectionsAfterOpen >= AFTER_THE_FACT_MOST_FROM) return 'after-the-fact-most'
  if (medianCorrectionsAfterOpen >= AFTER_THE_FACT_SOME_FROM) return 'after-the-fact-some'
  return 'key-steps'
}
