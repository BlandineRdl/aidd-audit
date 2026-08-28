# Project AI Docs

Structured context the AI assistant reads to work on this project, so it does not rediscover the codebase each session. AIDD generates this folder and keeps it in sync.

## What lives here

- `memory/`: the project memory bank loaded each session. See [`memory/README.md`](memory/README.md).
- `GUIDELINES.md`: how this team operates the AI on this project.
- `CONTRIBUTING.md`: how to add or change project context.
- `INSTALL.md`: the frozen technical vision and execution plan.
- `tasks/`: specs, plans, and run summaries, grouped by month as work happens.
- `plans/`: implementation plans still in flight.

The project memory block inside each AI context file (`CLAUDE.md`, `AGENTS.md`, and the rest) is generated and kept in sync, never edited by hand. To change what the AI sees, add or remove files under `memory/`. See [`memory/README.md`](memory/README.md) for the load tiers and the current file index.

## The framework

AIDD ships skills, agents, rules, and generators as a plugin marketplace. For the full catalog, the install guide, and the end-to-end workflow, see the framework docs: <https://github.com/ai-driven-dev/framework>.
