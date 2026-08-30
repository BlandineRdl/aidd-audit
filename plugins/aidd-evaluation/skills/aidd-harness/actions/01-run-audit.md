# 01 - Run audit

Run the deterministic harness audit and establish whether it published a usable contract.

## Input

The repository open in the current session.

## Output

A parsed `HarnessAuditReport`, or a reported command failure.

## Process

1. **Run.** Execute the bundled command against the current directory.

   ```bash
   node "$CLAUDE_PLUGIN_ROOT/bin/cli.js" harness . --json
   ```

2. **Validate.** On exit code `0`, parse stdout as JSON and retain the complete contract.
   - On any non-zero exit, report stderr and stop. A failed audit is not a finding.
3. **Keep scope.** Read the report as two separate scopes. Subject measurements are reproducible
   from the repository. Machine measurements describe only the unchanged local configuration.

## Test

- The command exits `0` and stdout parses as a JSON object with `schemaVersion`, `files`, and `findings`.
- A non-zero command exit produces no narration of an audit result.
