# Iteration 001 — useful structure, excessive ceremony

**Scenario:** founder noodling under a 20-minute decision window
**Skill version under test:** pre-release `0.1.0` draft
**Result:** failed the urgency/usability gate

## Observed outcome

The skill-guided run did materially better than the no-skill baseline:

- preserved all substantive raw items;
- separated buyer demand, demonstrability/emotional exposure, learning mechanism, and decision-friction islands;
- mapped cross-island edges;
- converted embarrassment into a testable expectation question;
- challenged analytics through the synthetic diffuse pass;
- produced a six-block plan totaling 20 minutes.

However, it produced **3,487 words / 22,894 bytes** for a user with only 20 minutes. A longer answer is not evidence of a better method. The artifact risked consuming the decision window it was meant to protect.

## Root cause

The draft skill:

- prescribed the full template for every run;
- defaulted to two recursion cycles;
- had no output budget;
- treated completeness and compactness as if they were unrelated.

## Change made

Added explicit execution modes:

- **Quick:** 600–1,200 words, three-to-five islands, one synthetic diffuse pass, one recursion cycle;
- **Standard:** full template, up to two cycles;
- **Deep:** human checkpoint and explicit budget.

Added “ceremonial overproduction” as a failure mode and made exceeding 1,200 words a hard failure for quick evals.

## Re-test requirement

Run the identical founder scenario in Quick mode. It must preserve the key receipts and graduate an actionable plan within 1,200 words.
