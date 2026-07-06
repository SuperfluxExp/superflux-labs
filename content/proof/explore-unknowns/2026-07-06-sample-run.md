# Explore Unknowns — sample run

Run source: Claude Code with model `fable`.

Task:

```text
A team wants to build a Fable-style agent that takes a vague feature idea, explores unknowns before coding, and returns the one question most likely to change the implementation.
```

## known knowns

- Input is a vague feature idea. Output is one clarifying question, not a spec.
- The workflow order is fixed: explore first, code never in this phase.
- The question is ranked by leverage: how much the answer would change the implementation.

## known unknowns

- What territory does the agent explore: idea text only, or idea plus repo and product docs?
- Who answers the question: a human waiting synchronously, or an async review queue?
- What is the exploration budget per idea: one model call in seconds, or a multi-step pass in minutes?
- What does "changes the implementation" mean here: data model, UX flow, or cost/risk posture?

## unknown knowns

The team will know the right output when they see it, so give them shapes to react to:

- Option A: one plain sentence, the question alone.
- Option B: the question, why it is load-bearing, and what changes with each possible answer.
- Option C: top three questions ranked, winner flagged.

A reaction like "B, but shorter" is the data we are after.

## unknown unknowns

| risk | smallest de-risking step |
|---|---|
| No territory: many vague ideas arrive with no repo or docs. | Define the empty-context fallback: ask about users, not files. |
| Question fatigue: if the agent always asks, people route around it. | Add a skip threshold when remaining unknowns are cheap to guess. |
| No ground truth: "was that the right question?" is hard to score. | Log whether the answer changed the plan. |
| Exploration creep: the unknowns pass can burn the budget. | Hard cap exploration steps before the question must ship. |

## next question

**When the agent asks its one question, who is on the other end: a human waiting synchronously, or an async review queue?**

Synchronous means exploration should finish in about 30 seconds and stay single-pass. Async permits a deeper sweep. This one answer decides the runtime architecture, the exploration budget, and whether a skip threshold is optional or essential.

## decision-first plan

1. Interaction contract: sync vs async answering.
2. Input territory: idea only vs idea plus repo/docs.
3. Output shape: pick A/B/C by reacting to samples.
4. Skip condition: when asking is not worth the interruption.
5. Then mechanics: exploration loop, question-ranking heuristic, answer-impact logging.
