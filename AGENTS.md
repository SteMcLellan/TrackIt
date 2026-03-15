# AGENTS.md

TrackIt operating guide for coding agents.

## Agent Lookup Rules

1. Treat this file as the docs navigation source of truth.
2. Update this file in the same change whenever doc paths move.
3. Put each new doc in exactly one bucket: `architecture`, `product-specs`, `runbooks`, `references`, `decisions`, or `backlog`.
4. Prefer updating canonical docs over creating duplicate guidance.

## Agent Lookup Order

1. `AGENTS.md`
2. `docs/architecture/`
3. `docs/product-specs/`
4. `docs/runbooks/`
5. `docs/references/`
6. `docs/decisions/`
7. `docs/backlog/` — exploratory ideas and deferred plans

## Repository Doc Map

```text
AGENTS.md
DESIGN.md
docs/
|-- architecture/
|   |-- api-conventions.md
|   |-- auth-flow.md
|   |-- data-modeling.md
|   |-- frontend-engineering-conventions.md
|   |-- frontend-interaction-principles.md
|   |-- page-shell.md
|   `-- participant-association.md
|-- product-specs/
|   |-- behavior-tracking-abc.md
|   |-- dynamic-hero-phrase.md
|   |-- daily-reflection-scoring.md
|   |-- medication-command-center.md
|   `-- medication-frequency.md
|-- runbooks/
|   |-- api-testing.md
|   |-- common-dev-tasks.md
|   `-- frontend-build-verification.md
|-- references/
|   |-- development-commands.md
|   |-- environment-variables.md
|   |-- repo-conventions.md
|   `-- stitch-workflow.md
|-- decisions/
|   `-- README.md
`-- backlog/
    |-- README.md
    |-- daily-reflection-historical-entry.md
    |-- dynamic-hero-phrase.md
    |-- frontend-component-modularization-plan.md
    |-- multi-caregiver-mvp.md
    |-- non-google-auth-for-automation-and-agent-access.md
    |-- responsive-designs.md
    |-- timeline-stitch-alignment.md
    `-- ui-feedback-general.md
```

## Canonical Rule Docs

- Frontend engineering rules: `docs/architecture/frontend-engineering-conventions.md`
- UX and interaction rules: `docs/architecture/frontend-interaction-principles.md`
- API conventions: `docs/architecture/api-conventions.md`
- Data and time modeling: `docs/architecture/data-modeling.md`
- Auth flow: `docs/architecture/auth-flow.md`
- Naming and Git conventions: `docs/references/repo-conventions.md`
    - When executing any Git commands always follow repo-conventions.md.
- Development commands: `docs/references/development-commands.md`
- Environment variables: `docs/references/environment-variables.md`

## Stitch Defaults

- Project: `projects/2002730124455423542`
- Workflow: `docs/references/stitch-workflow.md`
