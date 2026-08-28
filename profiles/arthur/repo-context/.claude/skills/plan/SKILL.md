---
name: plan
description: Split a request into independent tasks, one worktree each
disable-model-invocation: true
argument-hint: <request or spec file>
---

# Plan

Split the request into tasks that can run at the same time. Each one is then
run with `claude --worktree <id>`.

- No task touches a file another task touches. If two overlap, they are one task.
- Each task carries its own verification criterion, executable.
- Output `[{ id, branch, prompt }]`.
