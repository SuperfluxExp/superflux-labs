# Visual affordance toolbelt

Choose the relationship first. Then use the smallest visual that preserves the
relationship the reader must inspect. Do not choose from habit, and do not replace
a useful technical diagram with a table simply because the table is easier to build.
Every H2 section of an explainer opens on one of these visuals (see the picture-first
page budget in `SKILL.md`).

## 1. Comparison table or matrix

Use when the reader must compare options or repeated fields across the same criteria.
Keep fields as rows when options are few; transpose when that makes scanning easier.
Do not use it for sequence, causality, topology, or a path through a system.

## 2. Ranked bar or dot chart

Use when magnitude and order matter more than exact multi-field lookup. Start at zero
when bar length encodes quantity, label the values directly, and keep the ranking
visible. Do not turn nominal categories into a chart just to add decoration.

## 3. Timeline or phased roadmap

Use when order, duration, deadlines, or dependencies across time are the relationship.
Keep it to the events that change the reader's decision; move event evidence into a
compact table or disclosure when every event needs details.

## 4. Sequence diagram or swimlane

Use when actors exchange messages or ownership changes over an ordered path. Prefer a
sequence diagram for request/response behavior and a swimlane for responsibility and
handoffs. This is a technical diagram when the actors are services, queues, agents, or
data stores.

## 5. Flowchart or decision tree

Use when branching logic, a bounded workflow, or a cause-to-outcome route is the point.
Label conditions on the branches. If there is no meaningful branch, use a short ordered
list or sequence instead of manufacturing decision diamonds.

## 6. State or lifecycle map

Use when valid states and transitions matter. Name transition triggers and terminal
states. Do not substitute a timeline: elapsed time and state transition are different
relationships.

## 7. Hierarchy or ownership tree

Use when containment, authority, taxonomy, inheritance, or parent-child ownership is
the relationship. Keep each level semantically consistent. Use a table when the reader
needs attributes of each item rather than the structure between them.

## 8. System-context or architecture map

Use when the reader must understand components, trust boundaries, data stores,
external systems, deployment boundaries, or important data/control paths. Bound the
view to one question and one abstraction level. Label relationship meaning, not merely
the nouns at each end.

## 9. Annotated screenshot or UI wireframe

Use when the decision concerns a screen, control, state, or interaction. Annotate the
few regions the reader must inspect. Use a wireframe for a proposed interface and a
screenshot for observed behavior; label which is which.

## 10. Annotated delta or paired Today/After

Default to one annotated changed-path view when the surrounding system stays stable.
Use two complete views only when the states diverge enough that the reader genuinely
needs to trace each one independently. Keep vocabulary, abstraction, legend, scope,
and stable element placement matched across both views.

## Technical diagramming trigger

Technical diagramming remains a first-class path. Hand-draw system structure,
sequence, state, ownership, boundaries, or cause and effect as inline SVG by default,
using the `.dg` drawing classes and the worked figures in `template.html`. Prefer
compact ASCII when text shows the relationship most clearly, such as a short
code-adjacent call path. Use D2 with ELK when the layout is too dense to hand-draw.
Branches and labeled connections alone never require D2. A technical document may combine one
load-bearing diagram with a comparison table, evidence table, or annotated interface;
the toolbelt is not a one-visual limit.

Use `references/d2-elk-diagrams.md` for geometry and legibility checks. If the bounded
question still needs an unreadably wide or tall graph, split it at a real boundary,
change the abstraction level, or add a local detail view. Never shrink the text below
the legibility floor to preserve a single canvas.

## Today/After divergence gate

Default to one annotated changed-path view. Add the following evidence-based score:

- +2 when an ownership, trust, security, or system boundary changes;
- +2 when the primary entry, exit, or end-to-end route changes;
- +1 when at least 35 percent of main nodes are added or removed;
- +1 when at least 40 percent of main relationships are added, removed, or rerouted;
- +1 when two or more stages reorder or change actors;
- +1 when review genuinely requires tracing both complete states independently.

Use paired complete diagrams only when the divergence score is 3 or higher **and**
both states need independent inspection. Otherwise show one stable context with the
changed path, boundary, or responsibility annotated. These are calibrated review
heuristics, not scientific constants. Record boundary, route, and stage-change factors
separately; compute node and relationship deltas from the two graphs; reject structurally
identical states; and show which conditions earned the score. Never accept a bare
author-supplied total.

Paired views must use the same scope, vocabulary, abstraction, legend, and stable
element placement. If equal-width columns make either view cramped, stack two
full-width views and preserve matched anchors. Never shrink labels to keep the pair
side by side.

## ASCII is a visual format

The relationship determines the visual role; ASCII determines how it is rendered.
An ownership tree, request sequence, or architecture view can be escaped preformatted
text. Use the accessible 16px monospace pattern in `ascii-diagrams.md`. Aim for a phone
width; keep whitespace and use keyboard-accessible contained horizontal scrolling
only when necessary. Never use tiny text or line wrapping to force alignment.
Keep current, proposed, and unimplemented labels and source evidence visible.
