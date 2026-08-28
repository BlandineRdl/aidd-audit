# Testing

Every task carries its own check, executable, written before the task runs. A
task without a check cannot be declared done by anything but a human, and I am
running three at a time.

- Python: `ruff` and `mypy --strict`. No per-file ignores.
