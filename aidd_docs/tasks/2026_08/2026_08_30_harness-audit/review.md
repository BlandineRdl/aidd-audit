# Review: harness audit

- **Verdict**: changes-requested
- **Diff**: `ae47425...worktree`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_30
- **Findings**: 0 critical, 5 warning, 0 minor

## Phases

### Phase 1 — walls before code

- [x] Each widened peer rule names the new context, and its comment states the full list it covers — `.dependency-cruiser.cjs:6-32`
- [x] The new context cannot import the three other contexts, and `assessment` cannot import it; both directions are stated in a rule, not in prose — `.dependency-cruiser.cjs:20-58`
- [x] The architecture gate reports a higher count of proven rules than before the phase, and leaves no sentinel file behind — `scripts/prove-boundary-rules.mjs:28-70`
- [x] Breaking any rule added or widened here makes the gate fail and name that rule together with the folder whose sentinel stayed silent — `scripts/prove-boundary-rules.mjs:28-70`

### Phase 2 — measurement domain

- [x] Counting the same text twice returns the same estimate, and the encoding name travels with it — `src/harness/measurement/compose-harness-audit.test.ts:91-97`
- [x] A measured file cannot be constructed without a tier and a scope — `src/harness/contracts/harness-audit-report.contract.ts:10-20`
- [x] A file long in lines and small in tokens, and its reverse, both report both figures correctly — `src/harness/measurement/file-length.test.ts`
- [ ] Two files sharing a reworded passage but no whole line are reported as a pair, with the passage shown — `src/harness/measurement/shared-passages.ts:82-89` merges consecutive left-hand windows found at unrelated right-hand positions; it can publish a passage that is not contiguous in both files. `fix`
- [x] A file whose every line sits in a fence reports no countable line, rather than a share of zero — `src/harness/measurement/compose-harness-audit.test.ts:73-89`
- [ ] The report totals each tier separately, names its encoding and its sequence length, carries no grading field, and tells an empty harness from a measured zero — `src/harness/contracts/harness-audit-report.contract.ts:117` adds `findings`; the approved plan/spec still prohibit the new grading surface. `fix`

### Phase 3 — claude loading convention

- [x] Aborting during the walk stops the read rather than letting it run to completion — `src/harness/adapters/claude-harness.adapter.test.ts:131-150`
- [ ] An import inside backticks is not counted; a cycle terminates with each file counted once; a missing import is reported unread rather than empty; an unimported neighbour is absent from the always-loaded tier — `src/harness/adapters/claude-harness.adapter.ts:81-84` silently discards `content: null`, so a missing or unreadable import is indistinguishable from no import. `fix`
- [x] A rule with a path glob lands in the conditional tier and one without it in the always-loaded tier — `src/harness/adapters/claude-harness.adapter.test.ts:51-69`
- [x] A skill contributes its description to the always-loaded tier and its body to the conditional tier — `src/harness/adapters/claude-harness.adapter.test.ts:71-95`
- [x] Every file carries the scope it was read from, and no total mixes the two scopes — `src/harness/adapters/claude-harness.adapter.test.ts:97-115`

### Phase 4 — command and renderings

- [x] The existing command's output and exit codes are unchanged; an unknown or absent command word names both commands and stays the caller's fault — `src/cli/parsing/command-name.ts:3-21`
- [x] The sequencer loads nothing and builds no adapter — `src/harness/usecases/audit-harness.usecase.ts:12-15`
- [x] A subject path naming nothing leaves standard output empty and exits as the caller's fault — `src/cli/commands/harness.command.test.ts:91-103`
- [x] A report holding a figure that cannot be published truthfully is refused rather than published, and exits as ours — `src/cli/commands/harness.command.test.ts:117-132`
- [ ] Prose names both tiers separately, never sums them, names the encoding, lists every measured file, and contains no grading word — `src/cli/renderers/harness-human.renderer.ts:116-145` intentionally renders recommendations, but the plan/spec were not updated to approve that changed contract. `fix`

### Phase 5 — published behaviour

- [x] A real shell spawning the binary sees the new command succeed, and sees a bad invocation as the caller's fault with an empty standard output — `tests/cli/process-contract.test.ts:306-364`
- [x] The same subject spelled two ways produces byte-identical subject sections, and the machine section is labelled rather than merged — `tests/cli/harness-determinism.test.ts:14-65`
- [ ] This repository audits itself through its shipped binary, naming no level and no grading word, with prose and contract agreeing — `tests/cli/self-harness-audit.test.ts:66-89` exempts the new Findings section although the plan’s acceptance criterion does not. `fix`
- [x] A member added to one vocabulary declaration and not the others fails the gate — `tests/harness/vocabulary-conformance.test.ts:16-43`
- [x] The memory bank states the encoding, the chosen sequence length, the bundle cost, and what the audit cannot see — `aidd_docs/memory/cli.md:91-97`
- [x] The gate and the build are green and the tree is uncommitted — the `pnpm check && pnpm build` chain completed before its final redundant test run; the worktree remains uncommitted.

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟡 | code | 2 | `src/harness/measurement/shared-passages.ts:82-89` | Matching only against a set of right-hand shingles loses right-hand positions. Consecutive matches on the left are merged even when they occur in separate locations on the right, so the reported maximal passage and the threshold input can be false. | Match and extend aligned positions in both files; deduplicate only true maximal runs. Add adversarial repeated-shingle cases. |
| 🟡 | functional | 3 | `src/harness/adapters/claude-harness.adapter.ts:81-84` | Missing imports, malformed rules, and declarations without a description are omitted with no unread state, despite the plan requiring an unread import to be reported rather than treated as absent. | Add an `unread` result to the public contract and render it; retain the source path and reason for every undecidable entry. |
| 🟡 | functional | 3 | `src/harness/adapters/claude/context-imports.ts:48-59` | `@~/.claude/...` is normalized as a path relative to the importing file and then silently disappears; it cannot resolve a documented absolute user import. | Recognise supported absolute imports and resolve them against the appropriate tree/root, with regression coverage. |
| 🟡 | code | - | `src/harness/advice/harness-findings.ts:110-121` | `tokensSaved` is described and rendered as measured, but no edit or resulting load set is measured. Import/reference overhead, tier, scope, and which conditional work runs can change the result. | Publish this as an explicit upper-bound estimate (or omit it) and test the declared semantics. |
| 🟡 | conform | 2 | `aidd_docs/tasks/2026_08/2026_08_30_harness-audit/spec.md:5-19` | The implemented recommendation contract contradicts the approved spec and three phase criteria; `aidd_docs/memory/cli.md:8` still says the command “judges none of it.” The contract also calls its closed set five guidelines while product memory calls it six. | Version/update the spec and phase acceptance criteria for the new decision, reconcile the public wording and define whether the minimum-line cutoff is a reportable guideline. |

## Verification

| Metric | Value |
| ------------- | ------------------------------------------------- |
| Verified | 83% (20/24) criteria evidenced |
| Files checked | `.dependency-cruiser.cjs`, `scripts/prove-boundary-rules.mjs`, `src/harness/**`, `src/cli/**`, `tests/**`, `aidd_docs/memory/**`, task plan/spec |
| Unchecked | Phase 2.4 — fix; Phase 2.6 — fix; Phase 3.2 — fix; Phase 4.5 — fix; Phase 5.3 — fix |
| Unplanned | Advice/recommendation feature and its `advice/` boundary widening trace to no updated plan/spec criterion |
