# Scope-of-work kind — the method

Reference for the **scope of work** kind of `explaining-with-html`. Open and follow this when
the user is sizing a body of work before committing to it — "scope of work", "how big/risky is
this change", "assess scope/complexity/effort", "before/after diagram", "current vs new state",
"component diagram", "impact score", "which changes should we make", "what would it take to
build X".

Everything in the parent `SKILL.md` still applies (light mode, self-contained,
diagrams-carry-the-load, digest-first prose, progressive disclosure, decision funnel, honest
residuals, delivery) and all visible prose still follows `cognitive-render`. This file adds the
one thing that makes a scope page trustworthy: **the page is generated from structured data
produced by code-grounded agents**, so nothing is hand-waved and nothing is lost.

Core move: **parallel agents read the code and return strict JSON → a cross-check agent
reconciles them → `assets/build_scope_html.py` renders authored ASCII or D2 + ELK diagrams and generates
the HTML → you verify the render → deliver.** You never hand-paste an agent's paragraph into the
visible page.

## The page this produces

`assets/build_scope_html.py` turns a scoping bundle into a page with this structure, using the
relationship-first toolbelt: summary table → per-change sections (pills, digest, one annotated
delta or justified stacked Today/After diagrams, risks) → dependencies & sequencing → caveats.
Run it once on `assets/example-ascii-scopes.json` to see the target (see **Build command** below).

## Method — end to end

### Phase A — Parallel scoping agents (code-grounded, structured)
- One agent per change/topic, launched **in parallel** (Workflow tool or parallel subagents).
- Each agent MUST **read the actual code before estimating** and cite `file:line` in its summary.
- Each returns **strict JSON** matching the schema below — including the two diagram states and
  the evidence-based diagram-presentation decision.
  The agent describes components and edges and may author a compact ASCII view of the same relationships.
- Effort is in **engineer-days for a senior dev who knows the codebase**.

**Diagram-spec rules — enforce these in the agent prompt** (they are what make the diagrams read):
- Include only components that communicate the change. Compact ASCII may need fewer than the usual 4–9 components in a graphical view.
- **Reuse the same component `id`** across current/new where the component persists.
- `new_state` must include **every** current component (with a `status`) plus additions.
- `status` ∈ `unchanged | modified | new | removed` on both components and edges.
- `lane` is one of the **project's swim lanes** (a fixed left-to-right list you pass to the
  generator as `lane_order`, e.g. `["Client UI","API","DB","Worker","External"]`). Keep labels
  ≤4 words, notes ≤8.
- For D2, do not supply node width, height, coordinates, or arrow routes. D2 must size text-bearing nodes,
  and ELK must place the nodes and route the arrows.

Agent output schema (copy-paste into the agent prompt):

```json
{
  "change_name": "string",
  "scope_summary": "3-6 sentences, cites file:line",
  "diagram_presentation": {
    "mode": "annotated_delta|paired_today_after",
    "divergence_factors": {
      "boundary_changed": false,
      "primary_route_changed": false,
      "stages_reordered_or_reowned": false
    },
    "independent_inspection_reason": "required only for paired_today_after"
  },
  "current_state": {
    "components": [{ "id": "str", "label": "<=4 words", "lane": "one of the project's swim lanes", "note": "<=8 words" }],
    "edges": [{ "from": "id", "to": "id", "label": "<=4 words" }]
  },
  "new_state": {
    "components": [{ "id": "...", "label": "...", "lane": "...", "note": "...", "status": "unchanged|modified|new|removed" }],
    "edges": [{ "from": "...", "to": "...", "label": "...", "status": "unchanged|modified|new|removed" }]
  },
  "files_touched": [{ "path": "str", "change": "one line" }],
  "effort": { "size": "S|M|L|XL", "est_days": "e.g. 2-3", "breakdown": ["workstream: days"] },
  "complexity_drivers": ["str"],
  "risks": [{ "risk": "str", "severity": "low|medium|high", "mitigation": "str" }],
  "dependencies": ["str"],
  "rollout": "2-4 sentences: flags, migrations, deploy order",
  "open_questions": ["str"]
}
```

### Phase B — Cross-check agent
After the scoping agents finish, one reconciliation agent receives **all** scoping JSONs and returns:

```json
{
  "dependency_edges": [{ "before": "change", "after": "change", "reason": "one line" }],
  "sequencing": "2-5 sentences: the recommended order and why",
  "effort_flags": ["estimates that look wrong vs. that change's own files_touched"],
  "shared_risks": ["risks that span changes, e.g. two changes editing the same file"]
}
```

This becomes the "How they fit together" section.

### Phase C — Programmatic HTML generation (never hand-paste)
Assemble one **bundle JSON**: per change add a `key` (kebab-case anchor), a display `title`, an
`impact` score (e.g. `4/5`), and a **hand-authored `digest`** (see the digest rule). Add
`title`/`subtitle`/`lane_order`/`start_here`, the Phase-B `cross_check`, and optional `caveats`/
`footer`. Then run `assets/build_scope_html.py` — it emits the whole page from data, so every
section is consistent and nothing is dropped. See `assets/example-ascii-scopes.json` for a complete input.

Set `diagram_presentation.mode` to `annotated_delta` by default. The generator then renders the
proposed state as one changed-path view using the status annotations already present in
`new_state`. Use `paired_today_after` only when the computed divergence score is at least 3 and
reviewers must inspect both complete states independently. Record the three semantic factors and
the plain-language inspection reason; the generator computes node and relationship deltas from
the two state graphs, shows every factor that earned points, and rejects an identical pair, a pair
below the threshold, or a pair without the reason. Do not type a score into the input.

**The digest rule (mandatory)** — this is the parent skill's digest-first rule, made concrete.
An agent's dense `scope_summary` (with `file:line`) must **never appear raw in the visible spine**.
Visible = a 3-row tagged digest you write in cognitive-render register:

- **Today** — what happens now, in plain language
- **The change** — what becomes different
- **Watch out** — the one thing that can bite

The full technical paragraph goes behind the styled expander *"Full technical scope (file:line
citations)"*. The generator does this automatically when you supply `digest` + `scope_summary`.

Page structure the generator emits (top to bottom): H1 + subtitle → **Start-here card** (15-sec
read) → **Summary table** (one row per change: title anchor, impact, size, est. days, risk
profile) → **per-change sections** → **Dependencies & sequencing** → **Caveats card** (amber) →
footer provenance. Each per-change section, in order: pills (`impact N/5` · `effort SIZE · X-Y
days` · risk pill) → 3-row digest → full-scope expander → **one changed-path diagram by default,
or stacked full-width Today/After diagrams when the divergence gate passes** → colour legend →
effort expander → **Risks table (visible, never collapsed, most-severe first)** → files-touched
expander → Rollout + Depends-on → open-questions expander.

### Phase D — choose ASCII or D2 + ELK

For compact text diagrams set `diagram_presentation.format` to `"ascii"` and add
`ascii` (spaces and LF newlines) and `summary` (plain-language equivalent) to each
rendered state. Retain `components` and `edges` for the structural Today/After
divergence calculation. Reconcile ASCII with those records; the generator cannot
prove semantic equivalence. It escapes text, preserves whitespace, adds a focusable
named scroll region, and labels new_state **Proposed - not implemented**. Current
claims still need source evidence. No D2 executable is needed for an all-ASCII
bundle. See `assets/example-ascii-scopes.json` for a complete input.

Existing bundles without a format retain `"d2"`; explicitly choose `"ascii"` for new
bundles when it communicates more clearly. Invalid formats and ASCII fail fast;
they never switch renderers. ASCII uses the 16px phone-width and contained scrolling
rules in `references/ascii-diagrams.md`.

For the `"d2"` format only:
`assets/build_scope_html.py` converts each `{components, edges}` spec into D2 source, then runs
the D2 CLI with `--layout=elk --no-xml-tag`. D2 auto-sizes each text-bearing node. ELK places the
nodes and routes the arrows. The generator inlines the resulting SVG, so the delivered page stays
self-contained and works offline.

The generator enforces these constraints:

1. Lanes keep the order supplied in `lane_order`.
2. Component labels wrap to at most three 28-character lines.
3. Notes wrap to at most three 34-character lines.
4. Edge labels wrap to at most two 24-character lines.
5. No text-bearing D2 node receives a manual `width` or `height`.
6. A label that exceeds those limits fails the build instead of being truncated or made smaller.
7. Missing D2, invalid component references, and D2 compile errors fail the build. There is no
   hand-drawn SVG fallback.
8. Lane headings preserve authored casing and use 14px source text. Scope nodes use 18px,
   keeping the grouping labels visibly quieter than the system behavior. ELK layer, edge,
   and container spacing is 20px instead of its much larger defaults; geometry validation
   still rejects collisions.
9. The root SVG receives its natural `viewBox` width and height so CSS can reduce an oversized
   diagram without enlarging a naturally compact one.
10. At 1200px and narrower, the SVG is replaced by a generated component-and-connection view.
    The technical diagram remains the desktop visual; the narrow view never shrinks its text.

Status labels and the visible legend must carry meaning without colour. Read
`references/d2-elk-diagrams.md` for the general diagram contract and its 620px default reading
budget. The load-bearing D2 diagram cannot require internal scrolling. ASCII may use a contained horizontal scroll region when necessary.

### Phase E — Rendering verification loop (mandatory before delivery)
The generator inlines `assets/diagram-fit-check.mjs`. After fonts load, the page checks the actual
browser geometry. It marks the page failed and shows a visible warning when node text leaves its
shape, an edge label overlaps a node, two edge labels overlap, or another arrow crosses a label.
For ASCII it checks visible nonempty text, escaping/whitespace, 16px monospace, captions,
keyboard-accessible contained overflow, and page width. Reject the render if any check fails.

Serve the page over localhost when the browser cannot open `file://`. Inspect 2–3 diagram sections
at desktop and narrow widths. Do not deliver until `document.documentElement.dataset.diagramFit`
is `pass` and the visible page is easy to scan.

Fix a failed D2 render by shortening or wrapping a label, changing diagram direction, or splitting
the diagram at a real phase or decision boundary. Do not shrink the text and do not manually move
elements inside the generated SVG.

Kill the temp server and delete screenshots afterwards.

### Phase F — Delivery
Standard parent-skill delivery: save as `YYYY-MM-DD-<topic>-explainer.html` → `SendUserFile` with
a caption naming what's inside → open it (`Invoke-Item`) → chat reply ≤150 words in
cognitive-render register ending with the decision ask. Never re-paste the page content as prose.

## The decision at the end
A scope page funnels to **"which of these do we fund, and in what order?"** Use the parent skill's
**decision-panel spec** — per option: the benefit, risks split into **user experience /
implementation / testing**, and scores (impact 1–5, effort S/M/L/XL + days, risk low/med/high),
plus a marked recommendation ("My read: …"). The summary table's scores and the panel's scores use
the same scales so the reader can cross-reference. Nothing to decide (pure sizing FYI)? Say so
explicitly.

## Build command

```bash
# from skills/explaining-with-html/assets/
python build_scope_html.py <bundle.json> <YYYY-MM-DD-topic-explainer.html>
# D2 defaults to `d2` on PATH; use --d2-bin C:/path/to/d2.exe when needed
python build_scope_html.py example-ascii-scopes.json example-explainer.html   # see the target page; needs no D2
```

## Common mistakes

| Mistake | Fix |
|---|---|
| Estimating without reading the code | Every scoping agent reads the files and cites `file:line` first |
| Agent's `scope_summary` pasted into the visible page | Hand-author the Today/The change/Watch out digest; tuck the raw prose in the expander |
| Two complete diagrams for a small change | Use one annotated delta; pair Today/After only at divergence score 3+ when both need independent inspection |
| Side-by-side before/after diagrams | Stack an approved pair full width — 5+ lanes are unreadable at half width |
| Unescaped diagram markup | Author ASCII as plain text and let the generator escape it; use D2 + ELK for graphical layout |
| Fixed node width or height | Let D2 size every text-bearing node from its wrapped label |
| Geometry check reports a collision | Shorten or wrap the label, change direction, or split the diagram; never patch the SVG coordinates |
| `new_state` missing unchanged components | It must contain every current component (with `status`) plus additions |
| Delivering without looking at the render | Run Phase E — serve on localhost, screenshot, eyeball, fix, repeat |
| Hardcoding lanes in the renderer | Pass the project's `lane_order` to the generator |
| Risks hidden in an expander | Risks table stays visible, most-severe first |

## Provenance
The canonical implementation is this reference file plus
`skills/explaining-with-html/assets/`, so agents route through one page-skill instead of choosing
between overlapping HTML explainer paths.
