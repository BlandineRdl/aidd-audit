# 02 - Narrate

Explain the audit in French as a decision aid while preserving the contract's limits.

## Input

A parsed `HarnessAuditReport` from `01-run-audit` and the user's requested level of detail.

## Output

A concise French explanation of the measured context and its findings.

## Process

1. **Lead.** State the always-loaded subject and machine totals separately. Name the encoding as
   an estimate, not the model's own token count.
2. **Prioritize.** Present `findings` in the order carried by the contract. For each useful item,
   name its guideline, observed value, action, and any `potentialTokensRemoved`.
   - Call guidelines chosen guidance, never universal limits.
   - Call `potentialTokensRemoved` a possible upper bound, never a measured saving.
3. **Bound.** Explain unread entries when present. Keep machine details separate from repository
   details and do not quote machine file contents.
4. **Detail.** Give the compact summary by default. When the user asks for the inventory, use the
   contract's file, prose-share, and duplication fields, or run the bundled command with `--details`.
5. **Stop.** Propose edits only as optional next steps. Do not edit or reorganize files unless the
   user asks for a specific change.

## Test

- The answer names no maturity level and never changes the assessment verdict.
- The answer does not call an estimate an observed saving or a chosen guideline a measured fact.
- The answer makes no filesystem change without a separate user request.
