import { AUTONOMOUS_INTERVENTION, ZERO_TOUCH_SHARE_FOR_AUTONOMY } from './autonomy.js'

// LIMITATION: The two cut points between the three corrected degrees of `intervention`. **Chosen,
// not measured**, on the same footing as the sample floors in `delivery-sample.ts`: no distribution
// of corrective commits was consulted, and the four reference profiles are fixtures rather than a
// corpus. They sit on half-integers because a median is a half-integer whenever the sample is even —
// a boundary on a whole number would put a median of exactly 2 and a median of 2 reached by rounding
// on opposite sides of a line nobody controls. The cost is asymmetric in the usual direction: too
// low credits a practice with autonomy it has not shown, which is a level stated confidently and
// wrongly; too high grades a real practice down, which the report names as a practice gap. Move
// either only from an observed distribution.
//
// INVARIANT: shared because the bundle and the forge answer the same axis from the same number, and
// a bound the two read differently would break the interchangeability the collector port promises.
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
