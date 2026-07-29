# Baseline pressure scenario receipt

**Date:** July 25, 2026
**Condition:** Same agent family, no access to `write-through-problems` or Recursive Thought Writing.
**Method:** Three blind, independent scenarios. This public receipt records only synthetic prompts, bounded excerpts, checksums, and grading.
**Execution order:** The baseline completed before `SKILL.md` package authoring began.
**Output receipts (SHA-256):**

- founder output: `65964a179487b674a751624c0b6257da15eb7004db7dcc5569303131ca4b96e9`;
- architecture output: `43b17c89162570d5011e7c958bf558f4f7d3be2acd6a8d8ca9f8239639e6df7e`;
- design-reaction transcript: `2986abadf7e21e99860f9808cff6e67526f368ede815d3a98fbe201f66f40039` (the runner did not persist a standalone final-summary file for this task, so the append-only completed transcript is the bounded receipt).

## Result

All three baselines were competent. All three converged before externalizing the problem structure.

| Scenario | Baseline move | What was good | Missing behavior |
|---|---|---|---|
| Founder noodling | “Do a small, private launch today.” | Clear 20-minute action plan and decision rule. | No raw thought ledger; embarrassment was reframed but not investigated; no islands or edges; no diffuse pass; the launch verdict preceded recursive analysis. |
| Architecture from mixed note | “Workflow-first, SQL-first, platform-later.” | Coherent architecture, memory model, security baseline, and buyer-value gate. | Selected infrastructure before preserving assumptions; no island map; no explicit edges between buyer proof and storage; no diffuse challenge; no recursion log. |
| Unarticulated design reaction | “Keep the underlying flow and make a focused experience pass.” | Respected sunk cost and proposed bounded changes. | Replaced the speaker's reaction with a generic taxonomy; did not capture which expectation was violated; no socialization artifact or recursive feedback loop. |

### Baseline rubric scores

Dimensions are ordered: capture / transformation / islands-and-edges / diffuse pass / recursion / convergence / source fidelity / public safety.

| Scenario | Scores | Total | Hard failure |
|---|---|---:|---|
| Founder noodling | `0 / 1 / 0 / 0 / 0 / 2 / 0 / 2` | 5/16 | Recommendation preceded raw capture. |
| Architecture from mixed note | `0 / 1 / 0 / 0 / 0 / 2 / 0 / 2` | 5/16 | Architecture preceded raw capture. |
| Unarticulated design reaction | `0 / 1 / 0 / 0 / 0 / 1 / 0 / 2` | 4/16 | The reaction was replaced rather than preserved and investigated. |

Source fidelity is scored `0` because the baseline agents had no access to the source method by design; it is not evidence of a source error.

## Failure signature

The no-skill agent optimized for immediate usefulness by compressing each messy note into one inferred root cause. That is often productive, but it destroys inspectability and can make an unsupported first interpretation feel inevitable.

The skill must not make the agent less useful. It must preserve the speed of the final recommendation while adding four missing receipts:

1. what raw material was retained;
2. how it split into subproblems;
3. which cross-island connections changed the answer;
4. why the work was ready to graduate.

## Release test

The post-skill run should remain bounded and actionable while satisfying `expected-behavior.md`. A longer answer alone is not improvement.
