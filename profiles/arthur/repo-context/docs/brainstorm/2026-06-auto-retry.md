# Brainstorm — should a failed task relaunch itself?

> Not decided. Kept because I keep re-having this conversation with myself.

## Where it stands today

Three worktrees run at once. Each one ends `done`, `empty` or `failed`, and
there it stops.
A `failed` task waits for me. In practice that means it waits until the next
morning, which on a multi-week batch is one lost day per failure.

## The obvious version

Loop: run the task, run its check, feed the failure back, run again. Stop after
N attempts or when the check passes.

## Why I have not done it

**The check has to be trustworthy before the loop can be.** A loop that runs
until `pytest -q` passes will find the shortest path to green, and the shortest
path is sometimes deleting the test. I already write "never modify code to make
an assertion pass" in `.claude/skills/check-task/SKILL.md`, and it is a request,
not a guarantee.

What would make it safe:

- The check file is read-only to the task. Diffing it after the run is not
  enough — a run that edits then restores it looks clean.
- A cap on attempts that is low, three, not ten. Ten attempts on a
  misunderstood task produces a lot of confident wrong code.
- The diff of a converged loop still gets read by me. Which raises the
  question of what the loop actually saved.

## The honest objection

I run three tasks in parallel and I read every diff. If the loop means I read
diffs from runs I did not watch, I have traded a day of latency for a class of
bug I will find later and understand less.

## Next step, when I get to it

Try it on an infrastructure-only track first, where the check is `terraform plan` and the failure
mode is loud. Not on application code.
