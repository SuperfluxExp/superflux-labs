# Source Credit Ledger

This project should credit public ideas that it adapts.

Good credit is not just politeness. It makes the corpus more useful because builders can compare the original idea with the runbook version.

## Current credits

| Source | Used in | Notes |
|---|---|---|
| Peter Steinberger / Loop Library — [Architecture Refactoring Loop for Coding Agents](https://signals.forwardfuture.com/loop-library/loops/architecture-satisfaction-loop/) | [Architecture Satisfaction Loop](../runbooks/architecture-satisfaction-loop.md) | The runbook adapts the repeated architecture critique loop and adds explicit verification, failure modes, and a two-pass stop condition. |
| Gergely Orosz / The Pragmatic Engineer — [“What is loop engineering?”](https://newsletter.pragmaticengineer.com/p/what-is-loop-engineering) | [README](../README.md), [Architecture Satisfaction Loop](../runbooks/architecture-satisfaction-loop.md), [Bug Reproduction Loop](../runbooks/bug-reproduction-loop.md) | The repo adapts the article's practical framing: loop engineering needs a durable goal, persisted state, fresh-context restart path, verification, budget, and human gate. |
| Common test-first debugging practice | [Bug Reproduction Loop](../runbooks/bug-reproduction-loop.md) | The runbook formalizes reproduce → isolate → failing test → fix → verify. |
| openai/codex — [`.codex/skills/babysit-pr`](https://github.com/openai/codex/tree/main/.codex/skills/babysit-pr) | [PR Babysitter Loop](../runbooks/pr-babysitter-loop.md) | Public prior art for continuously monitoring PR review comments, CI checks/workflow runs, and mergeability until a terminal state or user-help blocker. This repo's runbook is a clean-room operating procedure and does not copy scripts, tests, wording, or file structure. |
| novotnyllc/babysit-pr — [repository](https://github.com/novotnyllc/babysit-pr) | [PR Babysitter Loop](../runbooks/pr-babysitter-loop.md) | Public packaging and source-lineage signal that PR babysitting is useful as a reusable workflow beyond one codebase; this repo credits the pattern without importing implementation code. |

## Credit rule

If a runbook adapts a public post, repo, paper, talk, or workflow, add it here.

Include:

- source name;
- link;
- which runbook uses it;
- what changed in the adaptation.

Do not add private sources or internal notes to this file.
