---
name: avari-plan
description: Plan a cross-layer Avari feature into verifiable tasks with contracts and file ownership. Use for decomposition or multi-session work.
---

# Plan an Avari slice

Read root AGENTS.md. Inspect the requested code path. Use [architecture](../../../docs/architecture.md) when crossing layers.

Define the observable outcome and what is outside this slice. Distinguish implemented, mocked and proposed behavior. Resolve decisions that would change the product; continue independent inspection while waiting for essential input.

For substantial work, create one task from [the task template](../../../docs/tasks/TEMPLATE.md). Include acceptance examples, request/response/error contract, dependency order, owned paths, checks and the next step. Do not create a plan file for a tiny edit.

Prefer one vertical slice that can be demonstrated. If parallel workers help, assign disjoint paths after agreeing on the contract; reserve shared config and integration for the parent. Use at most two children and no recursive delegation. Read-only exploration and an independent final review are often sufficient.

Use [the ADR template](../../../docs/decisions/TEMPLATE.md) only for durable architecture tradeoffs. Planning alone does not authorize implementing a product migration. When the user also requested implementation, proceed through the plan without an extra approval round.

Return the concrete scope, acceptance criteria and the first executable step; leave a task file only when it will aid continuation.
