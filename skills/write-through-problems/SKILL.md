---
name: write-through-problems
description: Use when a messy problem keeps producing premature answers. Turns raw thoughts, questions, ideas, and reactions into subproblem islands, investigations, a diffuse pass, recursive refinement, and a decision or spec.
version: 0.1.0
author: Kandarp Jani
license: MIT-0
metadata:
  superflux:
    display_name: "Recursive Thought Writing"
    source: "Kandarp Jani, How to write your way to problem solving? (March 2023)"
    provenance: "Original author-owned process, published with permission"
    runtimes: [hermes-agent, claude-code, codex]
---

# Recursive Thought Writing

## Purpose

Write through a tangled problem before committing to an answer.

Most agents compress a messy note into one interpretation and solve that interpretation. This method preserves the raw material long enough to reveal separate subproblems, hidden relationships, emotional reactions, and investigations that premature convergence would erase.

The loop is:

**Capture → Organize → Map islands → Diffuse → Recurse and socialize → Graduate**

## When to use

Use this skill when:

- the same problem keeps returning without becoming clearer;
- notes contain a mix of questions, solution ideas, constraints, and reactions;
- a person is “noodling” but not converging;
- the obvious answer feels too early or too neat;
- an architecture, decision, experiment, or specification needs to emerge from incomplete thinking;
- a reaction such as “this feels wrong” contains information that has not been articulated;
- several plausible solutions may actually belong to different subproblems.

Human trigger phrase: **“Write through this problem before solving it.”**

Do not use this for a tiny reversible action with an obvious next step. Do not use it to delay buyer exposure, verification, or a necessary decision.

## Output contract

Produce a `recursive-thought-map.md`-style artifact containing:

Before capture, replace secrets, credentials, personal data, customer names, private URLs, and local paths with stable placeholders such as `[SECRET_1]`, `[PERSON_1]`, `[CUSTOMER_1]`, `[PRIVATE_URL_1]`, and `[PRIVATE_PATH_1]`. Preserve the conceptual item, type, conflict, and relationships—not the sensitive raw value. Use the same placeholder consistently throughout the map.

1. the root problem and working budget;
2. a conceptually unedited raw capture of every substantive thought, with sensitive values replaced by stable placeholders;
3. an organized ledger where every item becomes a next step or investigation;
4. named subproblem islands, their nodes, and their interconnections;
5. a real or synthetic diffuse pass;
6. a recursion and socialization log;
7. convergence criteria and the graduated artifact.

Use `templates/recursive-thought-map.md` when a file artifact is appropriate.

### Choose a mode before writing

The map must save more time than it consumes.

- **Quick mode** — use when the human has 30 minutes or less, the action is reversible, or the user asks for a plan now. Target 600–1,000 words, with a hard ceiling of 1,200 words. Use a compact raw ledger, three to five islands, one synthetic diffuse pass, one recursion cycle, and the graduated action plan. Omit empty template sections.
- **Standard mode** — use for an important decision, architecture, article, or experiment with time to inspect assumptions. Use the full template and up to two recursion cycles.
- **Deep mode** — use only for high-risk or hard-to-reverse work. Set a human checkpoint and a cycle budget before starting; never recurse merely because more can be said.

State the selected mode and budget at the top. If the output exceeds its budget, compress repeated explanation—not raw items, conflicts, edges, or evidence gaps.

## The loop

### 1. Capture without solving

Record everything relevant before ranking or compressing it.

After applying the privacy gate, preserve the speaker's wording when practical. Capture:

- questions;
- solution ideas;
- facts and observations;
- constraints;
- fears, excitement, embarrassment, resistance, and other reactions;
- contradictions;
- analogies;
- unexplained hunches.

Do not edit for elegance. Do not silently turn a reaction into a conclusion. Keep capturing until a final prompt—“What else is still in the mind?”—produces nothing material.

Agent adaptation: if the user already provided a dense note, reflect every substantive item into the raw-capture ledger before offering a recommendation. Do not make the user repeat it.

### 2. Organize into actions and investigations

Classify every captured item as one of:

- **Question** — something that must be answered;
- **Solution idea** — a candidate to test, compare, or prototype;
- **Reaction** — an emotional or aesthetic signal that must become a question;
- **Observation** — a claim requiring evidence or acceptance as a constraint;
- **Constraint** — a boundary the solution must respect.

Then transform each item:

| Item type | Required transformation |
|---|---|
| Question | Name the smallest investigation that could answer it. |
| Solution idea | Name the assumption it depends on and the cheapest test. |
| Reaction | Ask what expectation was violated and what evidence would explain it. |
| Observation | Mark it verified, inferred, or unverified; name the source or check. |
| Constraint | State whether it is hard, negotiable, or merely assumed. |

No item may disappear during organization. If two items conflict, keep the conflict visible.

### 3. Map islands of subproblems

Group related items into named islands. Each island is a smaller problem that can be reasoned about independently while remaining connected to the whole.

For every island, record:

- the subproblem statement;
- its questions, ideas, reactions, observations, and constraints;
- the important internal relationships;
- edges to other islands;
- the uncertainty or evidence gap blocking progress;
- the next investigation or artifact.

Represent the map as text, Mermaid, a table, or a graph. The representation is not the work; the explicit nodes and edges are.

Do not choose a solution merely because one island is easier to describe than the others.

### 4. Diffuse / zoom out

Deliberately stop local optimization before convergence.

If time allows, recommend a real break: walk, do an unrelated activity, sleep on it, or discuss something else. State when to resume and preserve the map so re-entry is cheap.

If the task is urgent, run a synthetic diffuse pass instead:

1. **Analogy:** where does a structurally similar problem appear in another domain?
2. **Inversion:** what would make the current preferred answer obviously wrong?
3. **Distance:** what changes when viewed from the buyer, operator, reviewer, or future self?
4. **Connection:** which two islands seem unrelated but may share a cause?
5. **Removal:** what happens if the most attractive solution is forbidden?

Add only connections or questions that survive scrutiny. Do not manufacture novelty for its own sake.

### 5. Recurse and socialize

Re-enter the highest-leverage unresolved island and repeat capture → organize → map.

Quick-mode recursion budget: **one cycle**. Standard-mode recursion budget: **two cycles**. Extend only when the decision is high-risk and a new cycle is producing genuinely new evidence or structure.

Socialize the map before graduation when another person's tacit knowledge matters. Do not ask “thoughts?” Send a concrete artifact and ask one question tied to an island, assumption, or connection.

Treat reactions to the artifact as new capture material—not as approval or rejection to rationalize away.

### 6. Graduate into a decision artifact

Graduate only when:

- every high-impact captured item has a home;
- the important islands and edges are named;
- unresolved questions have owners, investigations, or explicit acceptance;
- the diffuse pass has challenged the preferred path;
- the recommendation traces back to the map;
- one next artifact can move the work forward.

Choose the smallest appropriate artifact:

- decision brief;
- experiment plan;
- architecture note;
- product or technical specification;
- article outline;
- research agenda;
- prototype brief.

Include discarded alternatives and the evidence or constraint that eliminated them.

## Pressure rules

| Pressure | Required response |
|---|---|
| “Just give me the answer.” | Use Quick mode: preserve a compact thought ledger, name the biggest unresolved island, run the synthetic diffuse pass, target 1,000 words, and never exceed 1,200. |
| “We have no time for a break.” | Run the five-part synthetic diffuse pass. |
| “This is just a feeling.” | Convert the reaction into an expectation-violation question. |
| “The architecture is obvious.” | Map the buyer-value, security, data, workflow, and platform-risk islands before selecting infrastructure. |
| “We already spent too long.” | Time-box recursion; do not use sunk cost as evidence. |
| “The map is getting huge.” | Split islands, cap the active set, and park low-impact nodes without deleting them. |

## Failure modes

- **Premature convergence:** jumping from a messy note to a confident plan.
- **Polished capture:** rewriting raw thoughts until the original signals disappear.
- **Feeling deletion:** treating discomfort as noise instead of data.
- **Graph theater:** drawing a complex map with no investigations or decisions.
- **Infinite recursion:** discovering forever without a budget or graduation test.
- **Socialization theater:** asking for generic feedback instead of testing one assumption.
- **Diffusion as avoidance:** taking a break instead of running the next obvious experiment.
- **Ceremonial overproduction:** producing a map so long that it consumes the decision window. Switch to Quick mode and compress repetition.
- **Sensitive-value persistence:** copying a credential, personal identifier, customer name, private URL, or local path into the map instead of a stable placeholder.

## Runtime notes

### Hermes Agent

Copy this directory to `$HERMES_HOME/skills/write-through-problems/`, then invoke:

```text
Use the write-through-problems skill on this note before recommending a solution.
```

### Claude Code

Copy the directory to `.claude/skills/write-through-problems/`, or install it with a compatible Skills CLI. Invoke it by name before architecture, planning, or complex writing work.

### Codex

Copy the directory to `.agents/skills/write-through-problems/`, or install it with a compatible Skills CLI. Ask Codex to preserve the recursive thought map as a reviewable artifact.

## Source boundary

This skill packages an original process created by Kandarp Jani in March 2023. The source presentation is not included in the repository. The method is published here by its author under MIT-0.

See `references/source-ledger.md` for provenance and adaptation notes.

## Done condition

The run is done when the user has a traceable thought map and either:

- a decision or next experiment;
- a graduated spec, architecture note, or outline;
- a bounded unresolved island with a named investigation;
- or an explicit pause and re-entry point.

A polished answer without the map is not completion.
