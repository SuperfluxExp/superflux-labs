# Architecture Satisfaction Loop

## Use when

Use this when an agent has produced code that works mechanically, but the architecture still feels wrong.

Typical triggers:

- the feature passes tests but the design is hard to explain;
- responsibilities are smeared across too many files;
- the code added a shortcut that will make the next change harder;
- the reviewer says “this works, but I am not happy with the shape.”

## Outcome

At the end, the agent should leave one of these states:

1. **Improved architecture** — a small refactor landed and checks pass.
2. **Clear no-op** — the current shape is acceptable, with the reason documented.
3. **Human review gate** — the dissatisfaction is real, but the next move requires a product or ownership decision.

The loop should not run forever.

## Loop contract

This runbook follows the loop-engineering shape described by The Pragmatic Engineer's “What is loop engineering?”: a loop needs a durable goal, a way to carry state between turns, a fresh-context restart path, and an explicit stop rule.

- **Trigger:** a review comment, design note, or agent self-review says the code works but the shape is hard to trust.
- **Goal:** improve the named architectural dissatisfaction while keeping behavior and checks intact, or document why the next move needs a human decision.
- **State to persist:** keep a short architecture loop note in the PR description, issue, or `architecture-loop-notes.md`. It should list the dissatisfaction sentence, files touched, current pass number, checks run, and remaining risk.
- **Iteration rule:** each pass handles one dissatisfaction and one small refactor. If another pass is needed, restart from the persisted note, not from hidden chat memory.
- **Budget / gate:** two passes maximum. Stop earlier if the next change is a product, ownership, or broad redesign decision.

## Workflow

### 1. Name the dissatisfaction

The agent must write one plain sentence:

> I am dissatisfied because `<specific architectural problem>`.

Bad examples:

- “The code could be cleaner.”
- “This needs refactoring.”
- “The architecture is suboptimal.”

Good examples:

- “The retry policy is duplicated in three clients, so the next timeout change will drift.”
- “The UI component owns data fetching and formatting, so it is hard to test without rendering the page.”
- “The new helper hides network errors, so callers cannot decide whether to retry or fail.”

### 2. Map the current shape

The agent lists:

- the files involved;
- the responsibility of each file;
- the dependency direction;
- the tests or checks that currently protect the behavior.

If the agent cannot map the current shape, it must stop and ask for a narrower target.

Record this map in the loop note so a later pass can restart with clean context.

### 3. Propose the smallest refactor

The agent proposes one refactor, not a redesign.

Good moves:

- extract one duplicated policy;
- move formatting out of a network client;
- split a mixed helper into two named functions;
- add a boundary object that makes ownership clear.

Bad moves:

- introduce a framework;
- rename half the repo;
- convert a working module into a new architecture because it “feels cleaner.”

### 4. Run the checks before and after

Before editing, identify the checks that matter.

After editing, run them again.

At minimum:

- unit tests for the touched behavior, if they exist;
- formatting or lint checks, if configured;
- a direct smoke check when the behavior is user-visible.

### 5. Review the new shape

The agent must answer:

- Did the named dissatisfaction improve?
- Did the change create a new responsibility leak?
- Did any test coverage become weaker?
- Is the diff small enough to review?

If the answer is not clearly yes, revert or stop with a review note.

### 6. Update the loop note

The agent appends:

- what changed in this pass;
- the before/after check results;
- whether the named dissatisfaction is resolved;
- whether another pass is allowed under the two-pass budget.

If another pass is needed, start from this note and the current repo state. Do not rely on the prior chat context being complete.

## Verification

A completed loop should include:

- the original dissatisfaction sentence;
- a short map of the old shape;
- the chosen refactor;
- checks run, with commands and results;
- a one-paragraph review of the new shape;
- any remaining architectural risk.

## Stop condition

Stop after **two refactor passes**.

If the architecture still feels wrong after two passes, the problem is probably not a local cleanup task. It needs a design review or a sharper constraint.

## Failure modes

### Infinite “until happy” loop

The agent keeps finding new things to improve.

Bound it with the two-pass rule.

### Refactor without a named problem

The agent changes shape because clean code feels good.

Require the dissatisfaction sentence before touching files.

### Passing tests, worse architecture

The agent moves code around and keeps tests green, but the responsibilities become harder to explain.

Require the new-shape review before completion.

### Hidden product decision

The architecture question is actually about product behavior or ownership.

Stop and mark a human review gate.

### Lost context between passes

The agent starts a second pass with stale memory and repeats work or changes the wrong boundary.

Prevent this by writing the loop note before restarting.

## Minimal example

A data sync client has retry logic in three methods.

Dissatisfaction:

> Retry policy is duplicated in three sync methods, so future backoff changes will drift.

Smallest refactor:

- extract `retry_with_backoff()`;
- keep existing method names and call sites;
- run the existing sync tests;
- add one test for retry exhaustion if missing.

Loop note after pass 1:

- dissatisfaction: retry policy duplicates across three sync methods;
- files: `sync_client.py`, `test_sync_client.py`;
- change: extracted `retry_with_backoff()`;
- checks: sync tests pass;
- status: resolved, no second pass needed.

Stop when:

- duplication is removed;
- tests pass;
- the client still owns sync behavior, not unrelated orchestration.

## Source / credit

Adapted from public discussion around Peter Steinberger's Architecture Satisfaction Loop and Loop Library's [Architecture Refactoring Loop for Coding Agents](https://signals.forwardfuture.com/loop-library/loops/architecture-satisfaction-loop/).

This version adds explicit verification, persisted loop state, fresh-context restart guidance, failure modes, and a two-pass stop condition. It also incorporates the goal/state/stop framing from Gergely Orosz's Pragmatic Engineer article, [“What is loop engineering?”](https://newsletter.pragmaticengineer.com/p/what-is-loop-engineering).
