# Mise Claude Agent Kit — HISTORICAL

Status: **SUPERSEDED**

> Historical document.
> This file describes Mise before repository consolidation.
> Do not use it as the current implementation source of truth.
> Current state: `docs/implementation/STATE.md`.

1. Clone or open `RAWCoder123/Mise` locally.
2. Copy `CLAUDE_CONSOLE_AGENT_PROMPT.md` and `MISE_OPERATIONAL_BACKEND_MASTER_PROMPT(1).md` into the repository root.
3. Copy `references/` to `docs/design/references/`.
4. Open Claude Console/Claude Code from the repository root.
5. Paste the complete contents of `CLAUDE_CONSOLE_AGENT_PROMPT.md`.
6. Give Claude GitHub access and read/write access to the working tree. Keep production/staging credentials out of the prompt and peer-agent consultations.

The prompt instructs Claude to inspect the six open PRs, consult Codex and Cursor when available, integrate the existing work safely, maintain a resumable implementation state, and implement the master product document through tested vertical slices.
