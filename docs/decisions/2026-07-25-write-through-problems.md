# Decision trace: package Recursive Thought Writing as `write-through-problems`

**Date:** July 25, 2026
**Status:** proposed public lab

## Decision

Package Kandarp Jani's March 2023 Recursive Thought Writing process as a portable Superflux Labs skill named `write-through-problems`.

Use the original human title in the skill heading and catalog display name. Use a verb-oriented package name so agents and humans can invoke it naturally.

## Why

The source describes a concrete repeatable workflow, not a collection of tips:

- raw capture without filtering;
- transformation of questions, ideas, and reactions;
- subproblem islands with interconnections;
- deliberate diffusion;
- recursive re-entry and socialization;
- graduation into a specification or architecture.

Blind baseline runs showed a consistent agent failure: useful but premature answers with no inspectable path from the messy source note to the decision.

## Adaptations

The package adds agent-operability without changing source ownership:

- explicit item types and transformations;
- a synthetic diffuse pass for urgent work;
- Quick / Standard / Deep execution modes with one-cycle, two-cycle, and explicit human-gated recursion budgets;
- a stable-placeholder privacy gate before raw capture;
- convergence and stop conditions;
- a reusable Markdown map;
- evaluator and public-safety checks, including rejection of PDFs and unexpected installable file types;
- Hermes, Claude Code, and Codex installation smoke tests.

These are labeled as adaptations, not attributed to the 2023 presentation.

## Alternatives rejected

- **`recursive-thought-writing` as the package slug:** faithful branding, but weaker as an invocation trigger.
- **Publish the original presentation:** unnecessary and outside the package's minimal public surface.
- **Turn it into a generic brainstorming skill:** loses the distinctive raw-capture, island, diffusion, and recursion contract.
- **Make it a runbook only:** misses portable skill discovery across agent runtimes.

## Verification contract

The package is ready for review only when:

- the failing-first validator suite passes;
- the three-runtime copy/install simulation passes;
- a post-skill pressure run produces the required receipts without endless analysis;
- repository validation and the public-artifact safety scan pass;
- the public diff contains no local paths, credentials, or private operating context.

## Custody

The original presentation remains outside the repository. The repository contains only the author-approved operational method, attribution, evaluation, and templates.
