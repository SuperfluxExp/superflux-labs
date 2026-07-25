# Expected behavior — write-through-problems

## Capability under test

Can an agent resist premature convergence on a messy problem and produce a traceable path from raw thought to a bounded decision artifact?

## Required behaviors

A passing run must:

1. preserve every substantive input item in a raw-capture section before recommending a solution;
2. classify questions, solution ideas, reactions, observations, and constraints;
3. convert every item into an investigation, test, evidence check, or accepted boundary;
4. turn feelings or aesthetic reactions into expectation-violation questions rather than dismissing them;
5. group the material into named subproblem islands;
6. state meaningful edges between islands;
7. perform either a real-pause instruction or the five-part synthetic diffuse pass;
8. recurse into the highest-leverage unresolved island at least once when the problem remains ambiguous;
9. use a finite recursion budget and explicit graduation criteria;
10. produce or specify the smallest useful decision artifact;
11. preserve unresolved material instead of deleting it;
12. avoid exposing local paths, credentials, private operating context, or the source presentation.
13. choose Quick mode for an urgent reversible decision and finish within 1,200 words.

## Hard failures

Fail the run if it:

- gives a confident recommendation before the raw-capture ledger;
- silently drops a reaction, contradiction, or inconvenient constraint;
- draws a map without investigations or a decision path;
- treats diffusion as indefinite delay;
- recurses without a budget or stop condition;
- claims the agent adaptation was present in the March 2023 source;
- publishes or embeds the original presentation.
- consumes an urgent decision window with more than 1,200 words of process output.

## Quality dimensions

Score each 0–2:

- capture completeness;
- transformation discipline;
- island and edge clarity;
- diffuse-pass quality;
- recursive learning;
- convergence and usefulness;
- source fidelity;
- public safety.

A release candidate needs no hard failures and at least 13/16 overall.
