---
name: explore-unknowns
description: Map the gap between an agent's prompt/plan and the real territory before long-horizon work. Use when a task is ambiguous, the codebase or domain is unfamiliar, the user will know it when they see it, or implementation needs a live unknowns map, blindspot pass, decision-first plan, implementation notes, and post-change quiz.
version: 0.1.0
author: Superflux
license: MIT-0
metadata:
  superflux:
    source: "Thariq (@trq212), A Field Guide to Fable: Finding Your Unknowns"
    source_url: "https://x.com/trq212/status/2073100352921215386"
    runtimes: [hermes-agent, claude-code, codex]
---

# Explore Unknowns

## Purpose

Turn vague work into a four-quadrant unknowns map before the agent starts making expensive guesses.

The article frame is simple: The map is not the territory. The prompt, plan, and context are the map; the codebase, domain, real users, and deployment constraints are the territory. Long-horizon agent work fails in the gap between the two.

This skill makes that gap explicit.

## When to use

Use this skill when:

- the request is underspecified or has hidden product/architecture choices;
- the agent is entering an unfamiliar repo, stack, domain, or workflow;
- the user has taste or tacit context they will recognize only when shown artifacts;
- a task is large enough that unknowns will surface during implementation;
- a plan needs buyer/user/reviewer approval before code starts;
- a finished change needs proof and a quiz before merge.

Agent trigger rule: if the next step would require guessing what matters, invoke Explore Unknowns before writing code or final copy.

Human trigger phrase: "explore unknowns before we build."

Do **not** use this as ceremony for tiny edits. If the next safe action is obvious and cheap, act.

## Output contract

The deliverable is an `unknowns-map.md` style artifact with:

1. known knowns;
2. known unknowns;
3. unknown knowns extracted through artifacts/options/references;
4. unknown unknowns from a blindspot pass;
5. decisions that would change architecture or UX;
6. implementation notes/deviation log, if work has started;
7. proof + quiz, if work has finished.

Use `templates/unknowns-map.md` when a file artifact is helpful.

## The quadrant walk

### 1. Known knowns: settled ground

Start by listing what is already clear from the user's message, repo files, source docs, and prior artifacts.

Keep it factual. Cite files or URLs when you inspected them.

Example:

```text
Known knowns:
- The target repo is a Next.js app.
- The change affects checkout onboarding.
- The user wants a prototype before backend wiring.
```

### 2. Known unknowns: ask one question at a time

List the questions you can already name. Then ask only the highest-leverage question first.

Prioritize questions where the answer would change:

- data model;
- API contract;
- UX flow;
- security/privacy posture;
- runtime choice;
- deployment path;
- evaluation/proof required for approval.

Bad:

```text
Can you clarify the requirements?
```

Better:

```text
One question before I touch code: should this be stored as a durable user setting, or is it only session-local? That changes the data model and tests.
```

### 3. Unknown knowns: make artifacts to react to

If the user will know it when they see it, stop asking them to imagine.

Give them something to react to:

- two to four HTML/design variants;
- a decisions table;
- fake-data prototype;
- before/after copy options;
- a small trace/report;
- a reference implementation summary;
- a clickable/mock artifact.

The goal is to extract tacit context. A reaction like "not this, more like option B but less salesy" is useful data.

### 4. Unknown unknowns: blindspot pass

Run a blindspot pass before implementation, and again when reality changes the plan.

Check at least these surfaces when relevant:

- repo conventions and existing abstractions;
- edge cases and failure modes;
- permissions, PII, secrets, and compliance constraints;
- migration/backward compatibility;
- testing and observability gaps;
- UI states the happy path ignores;
- cost, latency, quotas, and rate limits;
- deployment and rollback;
- user/buyer review requirements;
- places where a model is likely to confidently guess.

Return the blindspots as concrete risks plus the smallest way to de-risk each.

### 5. Plan with changeable decisions first

When ready to plan, lead with the parts most likely to change:

1. data model/interface decisions;
2. UX/product behavior;
3. security/privacy boundary;
4. verification/proof requirements;
5. mechanical refactors and file edits.

Do not bury real decisions under a long task list.

### 6. During implementation: keep notes

For non-trivial work, create or update an implementation notes file. Use `implementation-notes.md` unless the repo has its own convention.

Track:

- decisions made;
- deviations from the plan;
- edge cases discovered;
- assumptions still open;
- tests/proofs run;
- things to revisit before merge.

If a deviation changes the product or architecture, stop and surface it instead of quietly guessing.

### 7. Post-implementation: proof and quiz

Before merge or handoff, package what changed into a short proof report.

Include:

- what was built;
- what changed from the plan;
- test/proof output;
- screenshots or traces if relevant;
- known limitations;
- a short quiz that confirms the human understands the change.

For risky code, the user should be able to pass the quiz before merging.

## Runtime notes

### Hermes Agent

Load with:

```bash
hermes -s explore-unknowns
```

For local testing, install by copying this folder into `$HERMES_HOME/skills/explore-unknowns/` or by using a marketplace/export installer when available.

### Claude Code

Install/copy this folder into:

```text
.claude/skills/explore-unknowns/
```

Then invoke it by name in a prompt, for example:

```text
Use the explore-unknowns skill before implementing this feature.
```

### Codex

Install with the Skills CLI or copy this folder into the Codex-compatible project skill directory used by the local harness:

```bash
npx skills add <repo-or-local-path> --skill explore-unknowns --agent codex --copy -y --full-depth
```

The Skills CLI currently syncs Codex-targeted project installs into:

```text
.agents/skills/explore-unknowns/
```

Then invoke it by name in a prompt:

```text
Use the explore-unknowns skill to map unknowns before writing code.
```

## Source boundary

This skill is source-grounded in Thariq's public Fable article and the public source-to-skill pattern Kd highlighted from David/dzhng. It is not a transcript dump and does not imply endorsement by Thariq, Anthropic, David, or Fable.

Keep source excerpts in `references/source-ledger.md`. Keep the runnable procedure small.

## Done condition

A run of this skill is done when the user has the unknowns map in hand and either:

- approves the next implementation step;
- answers the next highest-leverage question;
- reacts to an artifact;
- or decides the task should be re-scoped.

No map, not done.
