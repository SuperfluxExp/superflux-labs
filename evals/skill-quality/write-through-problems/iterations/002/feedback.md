# Iteration 002 — correct structure, missed the hard cap by 32 words

**Scenario:** identical founder noodling prompt
**Mode:** Quick
**Result:** behavioral improvement, failed the explicit output ceiling

## Observed outcome

The run preserved thirteen raw items, organized each into a check or action, mapped four connected islands, performed the five-part synthetic diffuse pass, recursed once on the demand island, and graduated into a six-block plan totaling 20 minutes.

The output was **1,232 words / 8,001 bytes**. That is dramatically smaller than iteration 001 but still 32 words above the declared 1,200-word hard ceiling. The run therefore does not pass.

## Root cause

A target equal to the hard ceiling leaves no generation margin. The agent satisfied every structural requirement and still drifted slightly over budget.

## Change made

Quick mode now targets **600–1,000 words** while retaining **1,200 words as the non-negotiable ceiling**. The 200-word buffer absorbs generation variance without deleting raw items, conflicts, edges, or evidence gaps.

## Re-test requirement

Run the identical prompt again. It must:

- preserve all substantive raw items or stable placeholders;
- map three to five islands and important edges;
- run one synthetic diffuse pass and one recursion cycle;
- graduate the 20-minute action plan;
- remain at or below 1,200 words.
