// INVARIANT: The one intervention value a collector may establish from authorship alone. Every
// lower value on the scale answers *when* a human intervened relative to review; this one answers
// whether one intervened at all, which is a different question and the only one authorship settles.
export const AUTONOMOUS_INTERVENTION = 'never-once-framed'

// LIMITATION: The share of delivered changes that must hold no human work before autonomy is
// granted. **0.9 is chosen, not measured**, on the same footing as the sample floors: nothing
// observed in this project establishes it over 0.8, and moving it needs a corpus of real
// repositories that is post-MVP. It is shared because the production collectors are interchangeable
// by their port's promise, and a threshold two of them read differently would break it. Only the
// sources that can see human authorship may reach this value at all: the forge cannot, and does not.
export const ZERO_TOUCH_SHARE_FOR_AUTONOMY = 0.9
