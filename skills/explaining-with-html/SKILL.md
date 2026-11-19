---
name: explaining-with-html
description: >-
  Use when communicating anything substantive to the user — findings, RCAs,
  plans, reviews, architecture, trade-offs, status reports — especially when a
  decision is needed, the topic spans 3+ interlocking concepts, work resumes
  after a time gap, or the user signals overload ("my head is not parsing",
  "explain so I can decide", "draw a diagram", "ELI5"). Covers goal alignment,
  analysis/RCA, recommendations, PR/code review, handoff, and sizing work. Builds
  human-readable HTML with exact claim evidence, verification status, scope,
  count reconciliation, named decisions, literal plain language, and explicit
  treatment for user-visible states before visual polish. Picture first: the
  answer and a hero figure lead, every section opens on an inline-SVG figure
  with a two-sentence caption, proof sits in expanders, and
  assets/page-budget-check.mjs holds the page to 1,200 visible words. Technical
  reviews use literal headings plus repository-grounded component and sequence
  diagrams.
  Default to zero
  unrequested analogies, metaphors, or story framing. Run a first-time-reader
  verification pass before delivery. This is the user's standing preference:
  default to it over long markdown replies.
---

# Explaining With HTML

## Overview

Dense prose with internal codenames fails this user. Render complex communication as a **self-contained HTML explainer** that leads with the answer and progressively reveals supporting detail. Use literal words for causes, actions, and user-visible states. Then open it in the browser. The chat reply becomes a short summary, with a decision ask only when a decision remains.

## Picture first: the page budget

The user reported the earlier pages as "too much text, fewer diagrams". A page
that carried 3,101 visible words and no diagram was rebuilt with the same facts
as 1,058 visible words and seven inline-SVG figures, and the user approved that
shape on 2026-10-30. These rules hold that shape:

- **The reader sees the answer, then a picture.** The page opens with the answer
  in one sentence, one hero figure that shows the mechanism, and the calls that
  are the reader's. A time-gap recap goes between the header and the hero.
  For a workflow, connect actions with arrows and label the conditions that
  send the reader down different paths. A grid of numbered steps can summarize
  the workflow. Draw its sequence and decisions in the hero SVG.
- **One figure per H2 section.** Each section opens on a figure: an inline SVG
  diagram, a chart, a marked UI mock-up, or a marked comparison table such as the
  decision matrix. A review form or source list says why it has none with
  `data-figure-exempt="review form"`. If a section has no relationship worth
  drawing, merge it into another section or move it into an expander; never add
  a decorative diagram to satisfy the rule.
- **Captions of at most two sentences.** The first says what the figure shows;
  the second says why it matters. Evidence tags such as Observed or Proposed sit
  after the caption and do not count as sentences.
- **Words go on the drawing, not around it.** Put evidence status, build state
  (exists, to build) and short facts on the nodes, chips and edges they describe.
  Dashed outlines mark proposed or unbuilt work.
- **Proof lives in expanders.** Tables of evidence, file paths, code references,
  per-option benefits and risks, long lists and paste-ready text go inside
  `<details class="proof">`. The visible spine keeps the figures, captions,
  claim cards, decisions and residuals.
- **At most 1,200 visible words** outside expanders, diagrams, forms and the
  footer, and no visible paragraph over 60 words. Most pages land well under the
  ceiling; a page that needs more is two pages or has proof in the spine.

Run `node assets/page-budget-check.mjs <page.html>` on the exact file you will
deliver. Use the checker bundled with this copy of the skill. If the checker
is missing, locate a current complete copy of the skill before authoring.
Fix each finding and inspect the rendered hero at desktop and phone widths.
The checker covers the figure-per-section rule, captions,
paragraph length and the word ceiling, and it fails a page that still carries the
template's STARTING KIT comment or any `<template data-module>` block: delete both
before verifying. It does not judge whether a figure is honest or readable; the
rendering checks and the first-time-reader pass do that.

Both this check and the prose verifier must pass, and they count different things.
`visibleWords` is the prose ceiling above. `readingWords` is every word the reader
reads, including diagram labels and the review form, and it is the number the prose
verifier compares with `attentionBudgetMinutes × 220`. Set the attention budget from
the reader's situation before drafting. When the verifier reports
`reader_budget_exceeded`, cut prose, shorten labels, or move detail into an
expander; never raise the budget after the fact to make a page pass.

## Explain the facts before designing the page

For a callable dedicated author with independent reader and fact review, follow
`references/explainer-author-workflow.md` when delegation is authorized. It uses
the runtime's actual subagent tools and the packaged payload builder. The reader
gets only the artifact and reader questions. Keep browser rendering separate from
comprehension, stop after at most two revision rounds, and let actual user feedback
override agent scores. Role prompts do not enforce tool restrictions. These reusable
instructions and validators also remain usable without a subagent.

Work in two passes. A polished layout cannot repair an unexplained claim.

### Pass 1 — meaning

Make a private content note with no page components or styling. Record the reader's words, the time gap, the questions being answered, the scope of each question, the important claims and their evidence, the relationship between compared counts, what is unknown, and the exact decisions or actions. For each important action, record who or what acts, what it acts on, and what changes. For interface work, record every user-visible state that could be confused with another state. Split a claim when those answers come from different systems or have different verification status.

### Pass 2 — page

Only after the meaning pass is complete, choose the explainer kind, visible spine, diagrams, cards, tables, and expanders. Use a diagram to show a relationship that is already understood. Do not use a diagram, label, colour, or short umbrella word to conceal a relationship that the evidence has not established.

Do not open the template until every consequential claim can be stated in plain language with its object, location, evidence, status, and relevance—or is explicitly marked unknown.

## Minimization pass and deliverable grouping

Apply cognitive-render's minimization pass after drafting and before verification.
For status and delivery pages, use one quiet block per higher-level deliverable,
with compact outcome rows beneath it. Use the user's existing deliverable names.
Use a shared group label for common scope and status; show row-specific status
exceptions and evidence beside each outcome. Keep environment and verification
distinctions explicit. Show progress counts only for a defined, reconciled set.

Cut repeated summaries, filler, decorative badges, empty sections, and visuals
that duplicate the same relationship. Delete unnecessary detail; retain useful
proof in expanders. Keep decisions, material risks, conditions, and unknowns
visible. A short introduction plus the deliverable blocks may be the whole page;
the recipe is not a list of sections to fill.

Use **Instrument Sans** for prose, headings, and controls, and **IBM Plex Mono**
for counts, references, code, and ASCII diagrams, as in the user's checklist.
`template.html` embeds the fonts and their licenses from `assets/fonts.css`.
When writing fresh HTML, inline that CSS and preserve its license notices.
The scope generator does this automatically. Keep readable text sizes, neutral
grouping, thin dividers, and restrained spacing. Confirm the fonts load offline
before measuring layout; never add a remote font dependency.

## Choose the smallest useful visual

This skill is **picture-first**: every section opens on a figure (see the page
budget above). A visual can be an inline SVG diagram, a chart, a comparison
table, timeline, before/after panels, swimlane, or a marked UI mock-up. Choose
the smallest useful visual that makes the relationship easier to understand than
a short sentence. A section exists because the reader has a question; its figure
answers that question. Do not draw a second diagram of a relationship the page
already shows.

Choose the relationship first, then use the smallest useful visual. Read
`references/visual-affordance-toolbelt.md` before opening D2 or defaulting to prose.

| Relationship to explain | Default visual |
|---|---|
| Options or repeated fields across the same criteria | Comparison table or matrix |
| Magnitude or rank across categories | Ranked bar or dot chart |
| Events, duration, deadlines, or phases over time | Timeline or phased roadmap |
| Ordered messages, responsibility, or hand-offs | Sequence diagram or swimlane |
| Branching logic, a bounded workflow, or one failure path | Flowchart, decision tree, or bounded cause-and-effect diagram |
| Valid states and the triggers between them | State or lifecycle map |
| Containment, authority, taxonomy, or parent-child ownership | Hierarchy or ownership tree |
| Components, trust boundaries, stores, or data/control paths | System-context or architecture diagram |
| A screen, control, visual state, or proposed interaction | Annotated screenshot or UI mock-up |
| A current/proposed change | One annotated delta by default; paired before/after only through the divergence gate |

Replace repeated cards or repeated eight-row decision modules with one comparison
table when the fields are the same. Use a risk matrix when several gaps must be
ranked by both impact and urgency. Do not turn a wide diagram
vertical just to make it fit. Shorten and wrap labels, remove decoration, split at
a real phase or decision, or choose a table before changing direction.

### Draw diagrams as inline SVG

Hand-drawn inline SVG is the default diagram format. Draw the mechanism the
argument turns on: the components that talk, the path a request takes, the edge
a change adds or removes, the states an answer moves through. Leave out parts
that do not change the conclusion.

- Reuse the `.dg` drawing classes in `template.html`: `.n` box, `.n-ink` the one
  emphasised component, `.n-dash` proposed or unbuilt, `.n-amber` caution,
  `.e` edge, `.e-ret` returned message, `.e-red` the failing hop, `.lab` small
  mono labels. Colours come from the page tokens, so the semantic contract holds.
- Label every arrow with what moves (`writes`, `times out`, `3 · forwards job`).
  Keep node labels to a few words; sentences belong in the caption.
- Keep node and edge text at 14px or larger at the drawn scale (13.5px only for a
  node's second line). Small mono labels — lane names, axis ticks, step numbers,
  status chips — may be 12–12.5px and never smaller. Size each box for its longest
  label and align boxes to a shared grid.
- Size the `viewBox` to the content, read wide flows left to right, and wrap the
  SVG in `.scroll` with a `min-width` near the `viewBox` width. A phone then
  scrolls the figure, never the page, and the text stays readable.
- Give each SVG `role="img"` and an `aria-label` that states the caption's claim,
  and give the figure a `<figcaption>` of at most two sentences.
- Mark the figure with `data-visual-role` (architecture, request-sequence,
  cause-effect, before-after, swimlane, state-map, timeline, comparison-table,
  ui-mockup, workflow) so the verifiers can find it. A count map and a decision
  matrix are both `comparison-table`.
- Before delivery, look at the rendered page at about 1280px and 375px wide and
  fix any label that touches a line, a box or another label.

The template's hero, request sequence, cause-and-effect, changed-path and decision
matrix figures are working examples to adapt; its modules add a state map,
timeline, UI mock-up, ASCII and D2 figure.

### Compact ASCII diagrams

Compact ASCII diagrams remain a good choice when text makes the relationship
easiest to trace: a short code-adjacent call path, a dependency list, or a
decision a reader may copy into a terminal or a pull request. Branches, edge
labels, or three or more connections do not by themselves require D2. Keep
tables, charts, screenshots, or D2 when they answer the question better. Do not
add decorative diagrams or mandatory sections just to satisfy a format preference.

Use escaped preformatted text: escape literal `<`, `>`, and `&` (or assign
`textContent`), never interpolate diagram text as HTML. Preserve spaces and LF
newlines with `white-space: pre`; use spaces instead of tabs, a monospace font at
least 16 CSS pixels at the displayed size, and no ligatures. Start around 28-32
columns for a phone, then measure at 375px and 320px. Shorten labels or split at a
real boundary before reducing text size. A bounded horizontal scroll region is
allowed only when needed; never wrap lines destructively or scroll the whole page.
Give the region keyboard focus, a visible focus indicator, and an accessible name
tied to a visible caption. The caption states the relationship in plain language
for readers who cannot interpret ASCII punctuation.

Label current, proposed, and unimplemented behavior beside the diagram; label
mixed-state nodes or branches individually. Keep exact evidence and unknowns next
to the claim. Mark its relationship with `data-visual-role` and mark the pre with
`data-diagram-format="ascii"`. Run `validateAsciiDiagramFit(document)` from
`assets/diagram-fit-check.mjs` after fonts load at each tested viewport. Rendering
checks do not demonstrate human understanding. See `references/ascii-diagrams.md`.

### Neutral-first colour contract

Neutral by default: white and grey carry structure, grouping, ownership, evidence
status, and proposed work. Red means current failure or blockage. Amber means caution
or a pending decision. Green means verified success. Blue is an informational accent,
not a status. Do not use violet as a semantic status.

Labels and icons must carry the meaning without colour. Add a short visible legend
whenever red, amber, or green appears in a diagram or data display. Never use green
for an observation merely because it was checked; write **Observed** on a neutral
badge. Never use colour alone to distinguish owners, options, phases, or proposals.

Lead with a UI mock-up when the page presents a proposed interface. Give the reader the
screen, state change, or interaction before component boundaries, file changes, or
implementation steps. Mark the mock-up with `data-visual-role="ui-mockup"` so the shared
output verifier can confirm its position.

For a technical spec or RCA, put one marked, load-bearing visual in the visible
reading spine before implementation depth. Select it with the table above. When the
reader must understand a multi-part system relationship, use an architecture diagram
and mark the ASCII pre, SVG, or its containing figure with `data-visual-role="architecture"`.
Otherwise mark the selected visual with its literal role, such as
`data-visual-role="comparison-table"`, `timeline`, `before-after`, or `swimlane`.
Technical documentation may use additional supporting visuals when each answers a
different review question—for example, an architecture map for topology, a sequence
diagram for one request, and a table for option trade-offs. Do not redraw the same
relationship three ways.

For Today/After material, use one annotated changed-path view unless the divergence
score in the toolbelt reference is 3 or higher and both complete states require
independent inspection. If paired columns squeeze the labels, stack matched full-width
views. Never shrink text merely to preserve the side-by-side layout.

In generated multi-lane D2 diagrams, lane headings are quiet grouping metadata, not
primary content. Preserve their authored casing and use 14px source text; keep component
labels at 18px source text so the system behavior remains the strongest reading level.

## Reader reset after time away

Do not assume that because earlier work exists in the task, the reader still remembers it. If work resumes after several hours, on another day, or after an unclear gap, begin the visible page with a short PA-style recap:

- **One status line:** when the work paused, where it stopped, and what was rechecked since — or "nothing rechecked". These three are the same question in three tenses, so they belong in one sentence, not three cards.
- **Two short columns, already done and still open:** completed or verified results on one side; unresolved questions, checks and decisions on the other. Lists, not sentences.
- **One ask:** end with what you need from the reader — the decision, review, or information. This is the only part styled loudly, because it is the only part that needs them to act.

Keep this recap short and use the reader's project language. It is a memory reset, not another executive summary. Copy the `reader-reset` module from `template.html` and place it under the header.

## Make every claim understandable

Every important claim must answer five questions. Put the answers together in the visible finding, table row, or card. Do not make the reader hunt through a provenance footer to reconstruct them.

1. **What exactly are we talking about?** Name the workbook, file, record, job, tenant, project, feature, or other object. Include an ID only when it helps distinguish similar objects.
2. **Where is it?** Name the product or service, environment, tenant or project, storage layer, and provider when each is relevant. For example: "Acme staging → upload queue → storage bucket," not merely "pending in staging."
3. **What did we observe?** State the concrete status, count, mismatch, or failure. Use the real domain status when one exists.
4. **How do we know?** Name the source: query, API response, log, UI check, repository path, or user confirmation. Include when it was checked if the fact can change.
5. **Why does it matter?** Connect the observation to a decision, risk, next step, or state clearly that it is background only.

If the evidence does not contain one of these answers, write "unknown" or "not checked" and say what would establish it. Do not fill the gap with a plausible story.

### Reconcile counts before comparing them

Counts must name their sets. For every number, say what one row or item represents, where it came from, which environment it covers, when it was measured, and which statuses or filters are included.

Before doing arithmetic, state whether the sets are **equal, subset, overlap, joined, or unrelated**. Show the mapping or equation when claiming a difference. Do not conclude that `10 - 7 = 3 missing items` unless the ten and seven refer to the same kind of object and the seven have been matched to the ten. If they are different objects, explain the join that relates them or leave the difference unresolved.

## Keep systems and environments separate

Put a plain scope line before a finding set or comparison. Use this shape:

> **Scope:** Billing production database. **Compared with:** Acme staging API. **Not checked:** Acme production.

Always name the product or service with the environment. "Production" by itself is incomplete. When the page switches from one product, database, provider, environment, tenant, or project to another, say so in the heading or scope line. Do not place different scopes in one row unless the purpose of the row is to compare them and the relationship is explained.

Give every finding enough context to stand on its own. Use **Expected → observed → meaning → action**:

- **Expected:** what should have existed or happened, and why.
- **Observed:** what was actually found, with its claim coordinates and source.
- **Meaning:** why the difference matters in this audit, incident, or decision.
- **Action:** the exact next check, decision, repair, or "no action needed."

This prevents a surprising ID, deleted project, retry object, or historical row count from appearing without telling the reader why it was investigated.

### Label facts, interpretations, and future work

Use a visible status on consequential statements:

- **Observed:** directly checked in the named source during this investigation.
- **Inferred:** a conclusion drawn from observed facts; state the reasoning.
- **Reported:** supplied by a person or prior artifact but not independently checked now.
- **Proposed:** a future action or target state, not current behavior.

Time changes the label. A prior artifact's direct observation becomes **Reported** in a new explainer unless this investigation checked the source again. The evidence text may say "the July 12 review observed ..."; the current page's badge still says "Reported from the July 12 review."

If evidence conflicts, show the conflict. Do not silently choose the tidier source. If a fact can change, include its check time or mark it "not rechecked after the time gap."

## Use the user's nouns

Build a small terminology note before writing: the words the user used, the exact names in the evidence, and any different repository or database labels. Use the user's nouns in the visible page unless an exact source name is needed to locate evidence.

Do not invent umbrella terms to make the page sound systematic. Words such as "fleet," "identity," "marker," "binding," "orphan," and "cached" often hide which tenant, project, row, file, test value, or configuration field is actually meant. Name the concrete thing instead. Avoid `canonical`; say "the current Acme project ID," "the value stored in this configuration file," or "the source used for this comparison."

Default to zero analogies, metaphors, or story framing. Use one only when the user
asks for it or a literal explanation still needs help. Give the plain explanation
first. Never let the analogy replace the product name, object, location, evidence,
or action.

Do not frame a sequence as a story. Call it an event sequence, request sequence,
timeline, or cause-and-effect chain. Do not assign human motives or feelings to
software.

## STE-inspired writing on the page

cognitive-render owns the shared writing rules. Apply its STE-inspired adaptation
to summaries, captions, diagram labels, controls, and expanded explanations.
For standalone use: keep one term per concept, name known actors, put conditions
before actions, give each instruction one main action, and preserve meaning.
Never invent an actor or remove uncertainty, exceptions, negation, quantities,
units, scope, or causal direction to simplify the page.

Keep conditions and uncertainty visible beside the claim or action. Do not hide
"only if", "may", or a required exception in an expander while presenting the
summary or control as unconditional. Use the same product terms in all surfaces.
Short labels may remain phrases when their context makes the meaning clear.
Wrap labels or adjust layout when needed; do not remove a material qualifier to
make a diagram fit. Treat 20/25 words as review signals, not hard limits, and
retain natural cadence. This adaptation does not establish ASD-STE100 compliance.

## Use literal technical headings

For PR reviews, code reviews, implementation plans, architecture reviews, RCAs,
and technical handoffs, headings are navigation labels, not narrative beats. The
heading names the exact object or review slice. The first sentence below it states
the conclusion. Do not make the reader decode a slogan, contrast, rhetorical
question, or story-like claim before they can find the technical material.

Use this shape:

- **Page title / H1:** `<feature, incident, or PR> — <review type or verdict>`.
- **Section headings / H2:** literal review slices such as **Cross-repository
  request sequence**, **Repository and component ownership**, **Automated test
  results by repository**, **Merge and deployment status**, **Findings**, and
  **Review result**.
- **Finding headings / H3:** the affected repository, component, behavior, or
  failure. Put the severity beside it when this is a code review.

For example, write **Invoice email retries — implementation
review**, not **One retry record must reach the worker before a
send can start**. Write **Cross-service request sequence**, not **The same
request travels through all three services**. Write **Merge and deployment
status**, not **Opening pull requests is allowed. Shipping is not.** Keep the
plain conclusion directly under the literal heading.

This contract applies to technical review artifacts. A daily micro-learning page
or a worked example explicitly requested by the reader may use paced educational
headings. Do not carry that teaching style into code-review navigation by default.

## Ground technical diagrams in the repositories

Before drawing a technical review page, inspect the repository or PR diff and make
a small source map. Record the exact repository names, the components or symbols
that changed, the files that prove those names, the runtime actors, the data stores,
and the physical boundaries. A physical boundary is where execution or data crosses
the browser, an API process, a worker, a queue, a database, or an external provider.
Mark a name **Unknown** when the source does not establish it. Do not replace a
missing name with **Frontend**, **Backend**, **service**, **engine**, or **agent**.

Use the product name first and the repository name second when both help. Put an
exact file or symbol in smaller evidence text after the plain component label. Do
not let a wall of file paths replace the component model.

Keep static structure and runtime order separate:

- Use a **component/deployment diagram** for repositories, components, hosting or
  process boundaries, stores, and ownership. Mark it with
  `data-visual-role="component-deployment"`.
- Use a **request sequence diagram** for calls, responses, acknowledgements,
  retries, or stop conditions. Mark it with
  `data-visual-role="request-sequence"`.
- When the review spans two or more repositories and one request crosses three or
  more runtime actors, include the request sequence diagram in the visible spine.
  Label participants with verified repository and component names. Label messages
  with the verified method, event, or payload name when it helps the review.
- When both physical topology and request order matter, show the component/deployment
  diagram and the request sequence diagram as two bounded views. Do not overload one
  diagram with both questions. Do not redraw the same relationship twice.

For a single-repository change, use the same grounding rule but keep the visual as
small as the review question allows. A file/component table is enough when no runtime
sequence, state, topology, ownership, or boundary needs tracing.

## Pick the kind first

Explainers come in kinds. **Before writing, name the primary kind the moment calls for**, then
apply that kind's spine. All kinds share the invariants below (light mode, self-contained,
visuals-carry-the-load, digest-first prose, progressive disclosure, honest residuals, and a
decision funnel or an explicit "FYI — no action needed").

| Kind | When | Spine (visible skeleton) |
|---|---|---|
| **Goal alignment** | At the START of substantive work, before building | Goal restated in my own words → in scope / out of scope → how I read each ambiguous point → relationship-selected approach visual when one clarifies the work → what "done" looks like → decisions I need answered BEFORE starting. Funnel: "did I understand you right?" |
| **Analysis / RCA** | Something broke, or "what's really going on with X" | Start-here → relationship-selected event sequence, cause map, comparison, or concise prose → findings with claim coordinates (mechanism in expanders) → was/now corrections table when beliefs changed → evidence → residuals. Mark red only on a confirmed current failure or blockage. Decisions often FYI-only. |
| **Recommendations** | Eval/audit done; the user must choose a direction | Scorecard of measured evidence → findings → change/benefit/impact-score table → horizons (now / next / strategic) → rollout with 🔒 human gates → decision panel → residuals. |
| **Scope of work** | "How big/risky is this change?" — sizing before funding | Summary table → per-change relationship-selected view (annotated delta by default; paired Today/After only through the divergence gate) + Today/The change/Watch out digest + risks + files/rollout → dependencies & sequencing → caveats. **Open `scope-of-work.md`** (in this skill) — it has the agent JSON schema, the generator, and the D2 technical-diagram path for this kind. |
| **PR / code review** | Reviewing a PR or a branch diff | Review target (repository, PR, base, and head) → changed repositories, components, and files → relationship-selected behavior view (for a cross-repository call path, use the repo-grounded request sequence; add a separate component/deployment view only when physical topology also matters) → findings by severity (each: affected component, evidence, failure scenario, fix) → test coverage by repository → merge and deployment risk (UX/impl/testing) → verdict funnel: approve / approve-with-nits / request changes + a marked recommendation. |
| **Handoff / recap** | Ending a session, carrying context forward | What was done (verified vs. attempted) → relationship-selected current-state visual only when dependencies or state need mapping → what's in flight → exact next steps with file paths → open decisions → gotchas learned. |

**Kinds compose.** A long piece of work often opens with a goal-alignment explainer and closes with
a recommendations or scope-of-work one; a PR-review explainer may embed a scope-style before/after
diagram. Pick the primary kind, borrow sections from others when they serve.

## Invariants vs creative freedom

**The template and recipe are a launchpad, not a cage.** Invent sections, components, diagram styles, and layouts as the content demands — a state comparison, a timeline instead of a flow, or an interactive toggle. Use literal diagrams before visual metaphors. Only these are non-negotiable:

1. **Self-contained** — single HTML file, no CDN/external fonts, inline SVG; must render offline.
2. **Light mode, always — never dark.** The user finds dark themes off-putting; this is a hard rule, not a preference to weigh. Even when you write fresh CSS instead of copying the template, the page background stays light (off-white/white cards, dark ink on light). Concretely: light `--bg`, never a dark `#0d1117`-style palette; put `color-scheme: light` on `:root` **and** `<meta name="color-scheme" content="light">` in the head so the OS dark theme can't bleed into scrollbars, form controls, or `<details>` markers; **never** add a `prefers-color-scheme: dark` block. (Generations have silently drifted to GitHub-dark — that is the bug this rule kills.)
3. **Visuals carry the load, not paragraphs.** Use the visual-selection table above and the page budget: one figure per H2 section, a caption of at most two sentences, proof in expanders. Each major concept earns one load-bearing visual with its facts written on the drawing; prose is the caption, not a second explanation. If a compact table communicates the relationship, do not draw it again as a diagram.
   Hand-draw the diagram as inline SVG by default. When the layout is too dense
   to hand-draw cleanly, use
   **D2 + ELK** for branched or edge-labeled SVG diagrams. Keep the D2 source beside the artifact while working, render it
   to SVG, and inline the SVG in the finished page. Read
   `references/d2-elk-diagrams.md` before authoring or rendering one.
   Do not set `width` or `height` on a text-bearing node; let D2 size the box from the
   label. Run `assets/diagram-fit-check.mjs` after fonts load and reject the
   render if node text leaves its box, an edge label touches a node, two edge
   labels overlap, another arrow crosses a label, rendered node text falls below
   14px, rendered edge-label text falls below 12px, a diagram exceeds the 620px
   default reading budget (or its explicit 780px exception), or the page has
   horizontal overflow. The labeled edge's own line is
   allowed behind its label. Do not repair the generated SVG by manually moving
   arrows or text. For a dense multi-lane diagram, preserve the readable desktop
   SVG and provide the same components and connections as a structured alternative
   at 1200px and narrower. Do not make the load-bearing D2 diagram internally scrollable; ASCII may use
   contained horizontal scrolling under the compact ASCII rules above.
4. **Progressive disclosure — show the spine, tuck the depth.** Don't dump everything at once; the user feels buried by a long fully-expanded scroll. Keep a *skimmable spine* always visible — the answer sentence and hero figure at the top (the Start-here read), the calls strip, every section's figure and caption, and the decision panel — and put the dense supporting prose (full mechanism write-ups, effort/risk tables, provenance/timelines) behind `<details class="proof">` expanders styled so they don't look like the raw browser triangle. Rule of thumb: **collapse prose, never collapse a diagram or the decision panel.** A reader should get the whole gist in ~60 seconds from the spine, then open only what they want to go deeper on.
   A caption is a claim, not a label: write "The retry job stops after the third failure," never "This section covers retry behavior." Signposting that only announces what a later section covers spends words without orienting anyone — the visible structure already does that job. (The calls strip's one-line decision teaser is not signposting: it names the decision at stake, and it stays.)
   **Digest-first prose (hard rule):** a dense technical paragraph — especially an agent-generated one with `file:line` citations — must NEVER appear raw in the visible spine. Visible = a short hand-authored digest (for scope/change work, a 3-row **Today / The change / Watch out** block); the full paragraph goes behind a styled expander ("Full technical scope"). Digest the source, don't paste it.
5. **Plain language** — use the user's nouns, define unavoidable technical terms at first use, and state literal actions with their object and location. Say who or what acts, what it acts on, and what changes. Do not introduce a new abstraction merely to shorten the page. All user-facing prose must use ordinary words, including expanders. Exact source identifiers may appear inside code formatting as evidence, after the plain explanation.
   **Text register = the `cognitive-render` skill.** Apply it to ALL prose — banner, cards, decisions, residuals, and the chat summary: literal wording, short sentences, one idea per sentence, progressive disclosure, concrete nouns, natural cadence, and concise but uncompressed explanations. Default to zero analogies, metaphors, or story framing. A sentence that needs translation is a bug even inside a pretty card. This skill packages the same verifier and reader-context reference so the standalone install enforces that register too.
   For a product-facing technical spec, add marked user stories and write them with the
   same terms a person sees in the product. Keep repository identifiers as supporting
   evidence when they differ from the UI.
6. **Funnels to a decision** — ends with the user's calls, each with concrete options + a marked recommendation ("my read: …") + one-line reasoning, so they can reply in one line. When the call is non-trivial (which change to fund, which approach to take, whether to merge), give each option the full **decision-panel spec** below, not just a label. Nothing to decide? Say "FYI — no action needed" explicitly.
7. **Honest residuals** — what this does NOT fix/cover. Keep these visible (don't bury them in an expander).
8. **Pleasing, calm aesthetic.** This is a deliverable the user looks at, so polish matters: generous whitespace, a cool grey ground with white figure panels, hairline rules instead of a card around every block, a restrained light palette where colour follows the semantic contract (red = confirmed current failure or blockage, green = verified success, amber = caution or pending decision), a clear type scale, and styled `<summary>` affordances. Only figures, claim cards and the calls strip get a panel; sections are separated by a rule and a mono section label. Aim for "a designer made this," not "a tool dumped this."
9. **The delivery steps below, every time.**

## Make user-visible states visibly different

For interface work, do not stop at the implementation cause. If two states can look
the same to the user, the explainer must make their different treatment part of the
finding and the plan.

Draw the states as a state map (the `user-visible-states` module in `template.html`)
and keep the field-by-field comparison in its expander, with these fields:

| Field | What to specify |
|---|---|
| **State** | The product state in ordinary words, such as "answer is still arriving," "answer is complete," or "user stopped the answer." |
| **What the user sees** | Persistent text, placement, colour or emphasis, motion, and whether partial content remains visible. |
| **Controls** | Which actions appear or stay hidden in that state. |
| **Transition** | The event that moves the interface into or out of the state. |
| **Proof** | The observable browser check that shows the treatment is correct. |

A spinner alone is not enough when missing it would make an in-progress answer look
final. Use persistent text that states what is happening, then reinforce it with
layout, controls, colour, or motion. The words must still work when animation is
disabled and for assistive technology.

For an answer UI, the minimum comparison is:

- **Answer is still arriving:** show a prominent, persistent status such as "The
  assistant is still answering." Keep final-only controls hidden.
- **Answer is complete:** remove the working status. Show final-only controls such as
  Copy or the full-answer action.
- **User stopped the answer:** label retained text as incomplete, for example
  "Stopped — this answer may be incomplete." Remove working activity.
- **Answer failed:** show the failure and the next available action. Do not make it
  look stopped or complete.

Use the product's approved words when they exist. These examples define the required
meaning, not mandatory final microcopy.

## Default recipe (deviate freely; this order funnels well)

**Header** (the answer in one sentence, with the part that drives the decision in bold, plus evidence tags) → **hero figure** (the one mechanism the page is about) → **calls strip** (one cell per pending decision with my read and a one-line reason, or "FYI — no action needed") → time-gap recap module when needed → one section per question, each opening on its relationship-selected figure: event sequence, cause map, comparison, technical diagram, annotated interface, state map, or timeline → findings with exact object, location, evidence, and meaning in a claim card (full mechanism in a `details.proof`) → user-visible state map when states can be confused → was/now corrections (if beliefs changed) → the change drawn as one annotated delta, mapped to the causes it removes (a cause with no in-scope lever goes to residuals) → rollout timeline with the human gate in amber → **YOUR DECISIONS** as a decision matrix (never collapsed) → residuals, visible → review form → footer with whatever provenance exists (doc paths, tickets, logs, date).

The spine = the answer sentence + every figure and its caption + claim cards + the decision panel. Everything else is depth-on-demand behind expanders.

Decisions that don't belong to the rollout (e.g. a parallel business call like "refund now vs wait") still go in the decision panel.

`template.html` in this skill's directory renders the picture-first spine with working CSS and figures to copy-adapt. Its `<template data-module>` blocks are not rendered: copy one into the page only when its trigger applies (time-gap recap, user-visible states, technical decision table, count mapping, rollout timeline, ASCII figure, D2 figure, UI mock-up, status deliverables).

## Make the next decision concrete

Do not ask the reader to decide about an unnamed group. If six projects need ownership or cleanup decisions, list all six with their names, IDs, locations, retained data, and the options that apply to each. If the source does not contain the names, say that the decision is blocked until they are retrieved.

Every decision block must make these lines answerable without rereading the page:

- **Decision target:** the exact workbook, project, feature, file, record set, or change being decided, including its system and environment.
- **Why now:** the consequence of deciding now or deferring.
- **Evidence available:** the facts that support the choice, with links or expandable detail where useful.
- **Your options:** concrete choices that can be repeated in a one-line reply.
- **My read:** the recommended option and its reason, or "no recommendation" when the evidence does not support one.
- **What your reply changes:** the exact action that will happen, who or what performs it, and how completion will be checked.

For actions, name the object and location. "Reconcile the pending upload" is not enough. "Retry `<file name>` in the Acme staging upload queue, then confirm its status becomes READY" is checkable. If the name or provider is unknown, the next action is to retrieve it, not to hide the gap behind a generic verb.

## Make every review page answerable

Every page that asks the reader to review, choose, approve, correct, or answer must
include the feedback surface from `template.html`. Give each question a stable review
ID that does not change when its wording changes. Use radio choices for the expected
answers and question-specific notes for corrections, questions, and annotations. Keep
one optional additional-notes field for context that applies to the page as a whole.

Keep one compiled, copy-ready reply visible in a selectable text area. Provide a
**Copy reply** button and **JSON export**. The plain-text reply starts with
`HTML_PRESENTATION_REVIEW`, names the artifact, and preserves each stable review ID so
the coding agent can map the response back to the page. When clipboard permission is
blocked on a local file, select and copy the same visible text instead of losing the
answer.

Do not treat local browser storage as durable persistence. A self-contained file owns
only the immediate reply and JSON download. Durable persistence, review-task state,
template versions and cross-device history belong to a separate service, not the page.

## Technical decision table

This is the decision module inside the full HTML explainer; it does not replace the rest of the page. When the reader must judge a defect, risk, safeguard, or technical fix, put one complete table for that decision in the visible reading spine. Reserve the eight-row module for the highest-stakes named decision. When several findings repeat the same fields, summarize them once in a comparison table or risk matrix and move finding-specific mechanisms into expanders. Do not repeat the module for every finding. Use these rows in this exact order:

1. **Trigger**
2. **User impact**
3. **Likelihood**
4. **Severity**
5. **If we do nothing**
6. **Smallest clean fix**
7. **Proof**
8. **Debt if deferred**

Write the Trigger with the literal user action first, followed by any extra system condition. User impact says what the user sees, hears, loses, repeats, or pays for. Use **user instead of visitor**.

Likelihood and Severity stay separate. Choose Low, Medium, High, or Unknown for each, then add a short plain-language explanation: likelihood says how easily the condition occurs; severity says how bad the result is. Do not compress those facts into phrases such as `latent globally`, `certain when exposed`, or `ticks with retries + scale`.

Use one short sentence by default in each cell. Add a second only when the reader needs a condition or rating explanation. Pair each simple icon with visible words that carry the full meaning; decorative inline SVG uses `aria-hidden="true"`.

Smallest clean fix is the least change that closes the problem without creating a second source of truth. Debt if deferred names the exact compromise left by delay or a narrower workaround; write **None** when the clean fix leaves none. Proof names an observable check and starts with **Proposed** until run or **Observed** after verification. If evidence is missing, keep the row and say **Unknown** or **Not checked**, plus what would establish it.

A single clean fix gets the table and My read without fake options. When genuine alternatives differ in approach, boundary, sequence, or residual risk, keep the existing option comparison and My read below the table. The table's likelihood and severity describe the issue; the option panel's aggregate risk score describes the risk of adopting that option.

Never collapse the table or its rating explanations. Supporting mechanism and evidence may collapse. Use separate complete tables for unrelated decisions. A finding that is only background keeps the existing **FYI — no action needed** behavior and does not need a decision table.

## Decision panel spec

Every decision you offer gets a compact block per option — an option row or mini-card:

```
Option (a) — <label>
  Benefit:  <one sentence, concrete>
  Risks:    UX:             <one line, or "none">
            Implementation: <one line, or "none">
            Testing:        <one line, or "none">
  Scores:   impact N/5 · effort S/M/L/XL (X-Y d) · risk low/med/high
My read: (a) — <one-line reasoning>          ← the marked recommendation, always
```

Rules: risks **always** use the three fixed categories (user experience / implementation /
testing); "none" is a fine value but the category still appears. Scores reuse the same scales as
any summary/scorecard table in the page, so the reader can cross-reference. The "My read:"
recommendation line is mandatory.

## Companion files & skills

- **`scope-of-work.md`** (in this skill's directory) — the full method for the *scope of work*
  kind: parallel code-grounded agents → strict JSON → `assets/build_scope_html.py` → before/after
  swim-lane diagrams → verified render. Open it when the kind is scope of work; it composes with
  these invariants and the decision-panel spec above. Its assets live in `assets/`.
- **`references/d2-elk-diagrams.md`** — the D2 + ELK authoring, rendering, text-fit,
  and collision-repair contract. Open it when a structural diagram is too dense to
  hand-draw cleanly as inline SVG.
- **`assets/page-budget-check.mjs`** — the picture-first budget: one figure per H2
  section, captions of at most two sentences, visible paragraphs of at most 60 words,
  and at most 1,200 visible words. `node assets/page-budget-check.mjs <page.html>`
  prints JSON and exits non-zero when a rule fails.
- **`cognitive-render`** (separate skill) — the prose register for all visible text (see
  invariant 5). Kept separate because it also governs plain summaries, briefs, and digests that
  are not HTML pages. This skill carries a parity-checked copy of its verification contract.
  Open `references/human-readable-verification.md`, create the reader context, and run
  `assets/verify-human-readable-output.mjs` before the HTML-only checks below. Keep
  `unseenChanges` evidence out of the visible spine; explain the result the human can
  see instead. Set an attention budget for the visible spine and move secondary proof
  behind expanders. After a four-hour gap, give the resume as one status line, two short
  columns and one ask — three blocks, not six cards.

## Final verification pass

Run this on the rendered page before delivery.

1. **Shared prose gate.** Run the packaged output verifier at
   `assets/verify-human-readable-output.mjs` against the rendered HTML and its
   reader-context JSON. Fix every line it reports. Do not deliver the page when the
   verifier fails.
   **Picture-first budget.** Run `node assets/page-budget-check.mjs <page.html>`.
   Fix every finding — a section without a figure, a caption over two sentences, a
   visible paragraph over 60 words, or more than 1,200 visible words — by drawing
   the relationship or moving proof into an expander. Do not deliver the page when
   the check fails.
2. **First-time-reader check.** Read the visible spine with every expander closed.
   Confirm that a first-time reader can state the problem, cause, user impact, fix,
   and decision without translating implementation terms.
3. **Actor and action check.** For each important sentence, identify who or what acts,
   what it acts on, and what changes. Replace unclear pronouns and invented labels
   with the real noun.
4. **Plain-language check.** Use ordinary words in the spine and expanders. Exact
   source identifiers may appear inside code formatting as evidence. Search for
   "browser reader," "retire," "terminalize," "typewriter caught up," and "stream
   remained active." Rewrite them in literal product terms.
   Give the plain explanation first. This applies to all reader-facing prose,
   including expanders.
5. **Internal-language check.** Remove workflow labels and unexplained acronyms that
   matter only to the author, such as "forward render" or "EDD." Name the actual
   activity: revised page, browser check, automated test, or human review.
6. **Narrative-device check.** Remove unrequested analogies, metaphors, story
   framing, rhetorical reveals, and decorative transitions.
7. **Progressive-disclosure check.** Keep the answer and required user-visible
   distinctions in the spine. Collapse proof and implementation depth, not the
   meaning.
8. **Interface-state check.** When states can be confused, verify that each state has
   a persistent text status, distinct controls or treatment, a transition, and an
   observable proof. Reject a spinner-only distinction.
9. **Document-shape and visual-selection check.** Confirm that a UI page leads with its marked mock-up, a
   technical spec contains marked product-grounded user stories, and a technical spec
   or RCA contains one marked load-bearing visual selected for the relationship in the
   visible spine. Replace a diagram with a table when the reader is comparing repeated fields.
10. **Colour-semantics check.** Confirm that white and grey carry structure; red means
   current failure or blockage, amber means caution or a pending decision, and green
   means verified success. Require visible words, icons, and a legend; remove violet
   status meaning and any colour-only distinction.
11. **Feedback-surface check.** On every review page, answer each radio question, add a
   note, and confirm that the visible copy-ready reply preserves the artifact and stable
   review IDs. Exercise Copy reply and JSON export.
12. **Evidence and decision check.** Reconfirm claim coordinates, verification labels,
   honest residuals, and the exact decision target.
13. **Diagram geometry check.** For every D2 SVG, wait for fonts, run
   `validateD2DiagramTextFit(document)`, and require `ok: true`. Also inspect the
   page at desktop and narrow widths. Reject the render when text leaves a box,
   edge labels overlap nodes or one another, another arrow crosses a label, or
   rendered node text is below 14px, rendered edge-label text is below 12px, a
   diagram exceeds the 620px default reading budget or its explicit 780px exception,
   the page has horizontal overflow, or the browser
   shrinks the text to make the diagram fit. At 1200px and narrower, require the
   structured component-and-connection alternative for a dense multi-lane SVG.
14. **Generic-prose check.** Read the Start-here answer sentence and every figure caption. Each
   must state this page's specific claim with its own nouns, counts, and locations
   (the transplant test applied to spine prose). Rewrite any line that would fit
   another project's page unchanged, and any line that announces what a section
   covers instead of saying the thing. The Start-here decision teaser passes when it
   names this page's decision.
15. **Technical-heading check.** On a PR review, code review, implementation plan,
   architecture review, RCA, or handoff, confirm that the H1 names the exact review
   target and every H2 names a literal review slice. Move conclusions into the first
   sentence under the heading. Remove slogans, rhetorical questions, contrasts, and
   story-like titles.
16. **Repository-grounding check.** For each technical diagram participant, confirm the
   repository and component or symbol against the diff or source. Name physical
   boundaries that affect ownership, trust, deployment, or failure. Mark unresolved
   names Unknown instead of substituting Frontend, Backend, service, engine, or agent.
17. **Technical-view separation check.** If a cross-repository request has three or more
   runtime actors, require a marked request sequence diagram. If physical topology also
   matters, require a separate marked component/deployment diagram. Reject one overloaded
   visual that mixes static containment with runtime message order.
18. **Read-aloud check.** Read every visible sentence at a normal speaking pace. If a
   sentence needs a second read, rewrite it before delivery. Watch for clusters of
   colons or dashes and long runs of same-shape sentences; vary the rhythm instead of
   banning a mark.

19. **Minimization and typography check.** Remove duplicate claims and unnecessary
   sections. Confirm that related outcomes sit beneath their deliverable, with
   exact statuses, evidence, qualifiers, and risks intact. Check Instrument Sans
   and IBM Plex Mono load offline, then inspect desktop and phone widths.

Only proceed to the delivery steps after all applicable checks pass.

## Story mode — the worked-example walkthrough (comprehension repair)

This is the one sanctioned exception to "zero analogies, metaphors, or story framing" above,
and it triggers only on the condition that rule already names: the literal explanation was
given and the reader still did not understand. It is not a page style. It never appears in a
rendered explainer. It happens in the chat reply, once, as a repair.

Diagrams explain structure, but they can still fail to explain *behavior*. When the reader says
"I didn't understand" — or the concept is a feedback loop, a retry mechanism, or any
multi-actor pipeline — switch to **story mode**: one concrete instance, walked forward step by
step in plain chat prose. No new page, no new diagram. Comprehension repair happens in the reply
itself; shipping another (bigger) artifact at someone who is lost buries them deeper.

The method:

1. **Pick ONE concrete instance with realistic data** — one question, one order, one request
   ("Can I return a gift without a receipt?").
   Never the general case. The general case is what already failed to land.
2. **Cast the system's components as human roles** — the writer (generator), the grader
   (judge), the librarian (retrieval). Roles let the reader simulate the system socially
   instead of technically.
3. **Walk time forward** — attempt 1: what each actor sees, what it does, where it fails.
   Attempt 2: same thing. Let the repetition itself show the bug.
4. **Point at the missing obvious move** — what any human in that role would do next ("go back
   and search again, this time specifically for the returns policy"), and note that the system doesn't
   do it. The gap between obvious-human-move and actual-system-behavior IS the explanation.
5. **Only now state the general principle**, in one sentence ("the grader's complaint is used
   to re-word the draft, never to re-search").
6. **Close with the catch** — the one condition where the insight doesn't apply ("if no
   returns policy document exists, no search will find it").
7. **Zero jargon until the story lands.** Internal names (Stage B, retryCount, Path 2) may be
   mapped back to the story afterwards — never used inside it.

End with "Clearer?" — story mode is a repair loop; confirm it worked before rebuilding any
artifact on top of it.

## Build & delivery (all steps, every time)

1. Save as `YYYY-MM-DD-<topic>-explainer.html` next to the related artifact (plan/doc/ticket folder). Caller-specified path wins; no artifact → the project's `docs/` or `%TEMP%`.
2. Deliver through the runtime's available file surface: in Codex, link the absolute
   artifact path; in Claude Code, use SendUserFile when exposed. Name the decisions
   inside. Do not invent unavailable tool calls.
3. Open through the runtime's supported preview (Codex `open_in_codex`) or local
   browser (`Invoke-Item "<path>"` on Windows). Preview opening is delivery, not proof
   of browser inspection; preserve the separate rendering evidence.
4. Chat reply: a short plain summary (<150 words). If a decision remains, add a one-line ask quoting the options (e.g. "both, refund now"); otherwise use the FYI-only treatment. Never invent a decision or re-paste the full content as prose.

## Common mistakes

| Mistake | Fix |
|---|---|
| Dark theme (e.g. `#0d1117` bg, light ink) | Light mode only — light bg, dark ink, `color-scheme: light` + meta tag; the user finds dark off-putting |
| Everything fully expanded in one long scroll | Spine visible, proof behind `details.proof`; answer sentence and hero figure up top; never collapse diagrams or decisions |
| Walls of paragraphs explaining structure | Draw it as inline SVG — flow, sequence, timeline or annotated delta with the facts on the drawing; the caption is two sentences |
| A page of text with one diagram at the top | One figure per H2 section; run `assets/page-budget-check.mjs` and fix every finding |
| A caption that re-explains the figure in a paragraph | Two sentences: what it shows, then why it matters. Put the facts on the nodes and edges |
| Every template module copied into every page | Copy a `<template data-module>` only when its trigger applies; delete the rest |
| Hand-drawn SVG with crossing edges, a dozen or more nodes, or colliding labels | Write D2, render with ELK, inline the SVG, and run the geometry check |
| Diagram text made tiny to avoid overflow | Let D2 auto-size text-bearing nodes; wrap or shorten the label, or split the diagram |
| Wide diagram is flipped into an extremely tall page | Keep the relationship's natural direction; split at a real boundary or use a table |
| Red, amber, and green change meaning between sections | Use the neutral-first colour contract, visible labels, and a status legend |
| Review page asks for decisions but has no answer controls | Add stable radio questions, notes, a copy-ready reply, Copy reply, and JSON export |
| HTML restates the dense prose | Rewrite for a smart non-specialist; concrete nouns and diagrams carry the load |
| A caption announces its topic ("This section covers the findings") | State the claim itself: what was found, where, and why it matters |
| The Start-here answer sentence would fit any project's page unchanged | Name this page's objects, counts, environments, and the decision at stake |
| "Browser reader," "retire," "terminalize," "typewriter caught up," or "stream remained active" appears as explanatory prose | Rewrite it in literal product terms. Keep only exact source identifiers inside code formatting as evidence |
| Author workflow terms such as "forward render" or "EDD" appear in reader-facing copy | Say revised page, automated test, browser check, or human review |
| A causal sequence is presented as a story or metaphor | Show the literal event sequence and cause-and-effect relationship |
| A small spinner is the only difference between an answer preview and a final answer | Add persistent text, distinct controls or treatment, the transition, and browser proof for each state |
| UI explanation starts with component or file changes | Lead with the marked UI mock-up, then explain implementation |
| Technical spec or RCA has no marked load-bearing visual | Choose the smallest useful table, timeline, before/after, swimlane, cause-and-effect, UI mock-up, or architecture visual and mark its role |
| Architecture is drawn for a repeated-field comparison | Replace it with a marked comparison table |
| Commit hashes, raw errors, logs, or file coordinates dominate the visible readout | Explain the human-visible result first and move internal proof into an expander |
| Treating the template as mandatory structure | It's a starting kit — serve the content, keep only the invariants |
| No decision section | If nothing to decide, say "FYI only" explicitly |
| Mermaid/CDN dependency | Breaks offline; inline SVG only |
| A technical heading sounds like a slogan or story beat | Use a literal navigation label such as "Cross-repository request sequence"; put the conclusion below it |
| A technical diagram says only Frontend, Backend, service, engine, or agent | Inspect the diff and use verified repository and component names; mark unresolved names Unknown |
| One diagram mixes physical topology with runtime message order | Use separate component/deployment and request sequence diagrams when both relationships matter |
| Raw `<details>` browser triangle | Style `summary` (custom chevron, hover) so expanders look designed |
| File sent but never opened | Invoke-Item right after SendUserFile |
| Reader says "didn't understand" and you ship another/bigger artifact | Switch to story mode in chat — one worked example, human roles, no jargon (see Story mode section) |
