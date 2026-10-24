# Beads (`bd`) Execution Rules

This repository uses Beads (`bd`) for cross-harness task and context management.

## Sandbox & Execution Environment

In sandboxed agent environments (such as Antigravity):
- **Always execute all `bd` commands outside the sandbox (`BypassSandbox: true`)**.
- `bd` uses an embedded Dolt database and hydrates across repositories (accessing `~/.dolt/config_global.json` and `~/.beads-planning`), which reside outside the project sandbox boundaries.
- Attempting to run `bd` inside the sandbox causes permission errors (`open ~/.dolt/config_global.json: operation not permitted`) and database connection failures (`Error 1049`).
