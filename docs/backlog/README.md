# Backlog

Design explorations, architectural ideas, and implementation plans that are not yet ready for active development.

## Purpose

This directory collects lightweight design docs for:

- **Exploratory designs** — ideas being sketched but not yet committed
- **Architectural discussions** — design patterns and data model changes under evaluation
- **Future implementation plans** — detailed plans for features or refactors that will be tackled later
- **Decision records** — context and reasoning for deferred choices

## Guidelines

- **Keep entries lightweight.** Use plain language, sketches, and bullet points. Full specs can wait.
- **Link related docs.** Reference canonical docs in `docs/architecture/`, `docs/product-specs/`, etc. to avoid duplication.
- **Date your entries.** Include a "Last updated" date so agents know how fresh the thinking is.
- **Mark status explicitly.** Examples: "On hold — waiting for X", "Ready to implement next sprint", "Exploring options".

## When to Use

✅ Use `/docs/backlog/` when:
- You want to explore multiple approaches before choosing one
- The design touches multiple systems and needs discussion
- You're deferring implementation but want to capture the thinking
- You need a staging area for ideas before they're ready for `DESIGN.md` or specs

❌ Don't use `/docs/backlog/` when:
- The idea is ready to implement now — write the proper spec or architecture doc instead
- The idea is a one-time note or personal memo — use comments in code or a PR description
- The issue belongs in a task tracker — keep it there, not here

## Related Docs

- `AGENTS.md` — navigation guide
- `docs/decisions/README.md` — decisions that have been made
