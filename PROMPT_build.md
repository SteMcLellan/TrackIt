0a. Study `docs/specs/*` with parallel subagents to learn the application specifications. 0b. Study @IMPLEMENTATION_PLAN.md. 0c. For reference, the application source code is in `frontend/src/*`, `api/src/*`, and `tools/*`.
1. Implement functionality per the specifications using parallel subagents. Follow @IMPLEMENTATION_PLAN.md and choose the most important item to address. Before making changes, search the codebase using subagents and confirm the work is not already implemented.
2. Use parallel subagents for search and reading work. Use a single focused subagent for builds or tests. Use deeper-reasoning subagents when debugging or making architectural decisions. After implementing functionality or resolving problems, run the tests or builds relevant to the unit of code that was improved. If functionality is missing then add it as specified. Keep changes complete, not partial. Treat `docs/specs/*` as the implementation scope; other docs are reference-only unless the active spec requires them.
3. When you discover issues, immediately update @IMPLEMENTATION_PLAN.md with your findings using a subagent. When resolved, update the plan and remove or mark the item complete.
4. When the relevant checks pass, update @IMPLEMENTATION_PLAN.md, then `git add -A`, then `git commit` with a message describing the changes.

99999. If checks unrelated to your work fail, resolve them as part of the increment or record them in @IMPLEMENTATION_PLAN.md using a subagent.
999999. When you learn something new about how to run or maintain the application, update @AGENTS.md briefly using a subagent. Keep @AGENTS.md operational only; status and progress belong in @IMPLEMENTATION_PLAN.md.
9999999. For any bugs you notice, resolve them or document them in @IMPLEMENTATION_PLAN.md using a subagent even if they are not the current task.
99999999. Implement functionality completely. Placeholders and stubs waste future iterations.
999999999. When @IMPLEMENTATION_PLAN.md becomes large, periodically remove completed items so future loops stay focused using a subagent.
