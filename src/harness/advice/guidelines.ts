// INVARIANT: what a harness figure is compared against, so a finding can name what fired without
// re-deriving a number the report itself never invents. The first five values are reportable
// CHOSEN guidelines, not measurements; the last is their CHOSEN applicability guard. Nothing
// observable here settles a threshold, and the human made that trade deliberately, reversing the
// audit spec's original "measure only, never judge" constraint. Move none of these so a given
// repository passes; that would turn a stated assumption into a tuned one.

// LIMITATION: the total ALWAYS_LOADED tokens across BOTH scopes — subject and machine together,
// the one sum this audit otherwise refuses to publish as a reproducible figure, because a
// **finding** is not the reproducible report: it is an opinion about the combined weight a session
// actually opens with, and the spec's non-goal barring a merged reproducible total does not reach a
// verdict computed from one, offered as machine-local. **Anchored to one external fact**: a 200,000
// token context window, of which 10,000 is 5%. The window size varies by model — a smaller model's
// context makes the same 10,000 tokens a much larger share — so this is a stated assumption about a
// typical window, not a measurement of any model this tool ran against.
export const SESSION_OPENING_TOKEN_BUDGET = 10_000

// LIMITATION: one always-loaded file's own token estimate. Rationale: 40% of the whole session
// budget above concentrated in a single file leaves little room for anything else the tool loads
// unconditionally, however that remaining 60% is spread. Not derived from any measured corpus of
// harnesses.
export const ALWAYS_LOADED_FILE_TOKENS = 4_000

// LIMITATION: one always-loaded file's own line count. Rationale is human readability, NOT cost —
// tokens already carry the cost above, and lines is a second, independent axis about how easily a
// person can read the same file, not how much it costs an agent to load. This repository measured
// that the two disagree: `cli.md` is 106 lines and 6,217 tokens, `testing.md` is 196 lines and 5,917
// tokens — the shorter file by line count is the heavier one by token count. 200 is chosen for
// readability alone and must not be read as a proxy for token cost.
export const ALWAYS_LOADED_FILE_LINES = 200

// LIMITATION: the share of an always-loaded file's countable lines that are prose rather than list
// lines, above which a finding fires. **This is the least defensible of the five: it has no
// external anchor at all**, unlike the token budget's window-size fact or the file-size rationale's
// own 40%-of-budget argument. It is also the one guideline this repository's own CLAUDE.md tells
// against directly — "Normal prose in authored docs and code" is stated there as the accepted
// register for exactly this kind of file, so a finding that fires on prose share is flagging a
// register this project's own conventions permit. It is kept because the human asked for threshold-
// based findings on every dimension the report measures, prose share included, with this
// defensibility gap stated rather than hidden.
export const PROSE_SHARE = 0.6

// LIMITATION: the count of distinct shared passages between one file pair, strictly greater than
// which a finding fires — exactly 5 does not fire. **No external anchor.** A passage here is a
// maximal run, not a window: an earlier reading counted every overlapping eight-word window
// separately and reported 28 where there were 7 runs, and this guideline was first set at 10
// against those inflated figures, where it would now fire on nothing. Against real runs on this
// repository the pairs read 7, 2 and 1. Five is placed on the reasoning that one or two runs
// between two documents of the same project is shared vocabulary, while a pair repeating more than
// five distinct passages of at least eight words is repeating itself. It is a judgement, and it
// must never be moved so that a given repository reports a given number.
export const SHARED_PASSAGES_PER_PAIR = 5

// LIMITATION: a file with fewer countable lines than this has no prose share worth comparing, so
// PROSE_SHARE is not evaluated on it at all. This is an applicability guard, not a reportable
// guideline: a two-line context file has one countable line and is therefore trivially 100% prose,
// and the report told its author to add bullet points to it. Twenty is where a ratio starts
// describing a register rather than restating a line count. Raising it silences files that genuinely
// are prose-heavy; lowering it brings the false positives back.
export const PROSE_SHARE_MINIMUM_LINES = 20
