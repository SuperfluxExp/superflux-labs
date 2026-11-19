# D2 + ELK diagrams

Use this renderer for branched or edge-labeled SVG after choosing a graphical
layout over compact ASCII. ASCII does not require conversion to D2 or SVG. Keep cards, tables, and simple one-step comparisons in HTML/CSS.

## Render

Write the diagram as `.d2` source. Let D2 size every text-bearing node. Render
with ELK and inline the resulting SVG in the self-contained page:

```powershell
d2 --layout=elk --no-xml-tag input.d2 output.svg
```

Do not load D2, fonts, icons, or scripts from a CDN in the delivered page.
For a scope-of-work page, use `assets/build_scope_html.py`; it generates D2
source from the structured component data and runs this command.

## Keep text readable

- Do not set `width` or `height` on a text-bearing node. D2 must size the shape
  from its label.
- Wrap long node labels with explicit `\n` line breaks. Keep each line at about
  28 characters and use no more than three label lines.
- Keep edge labels short: four words or fewer and no more than two lines.
- Do not shrink text to force a dense diagram into a fixed canvas.
- Rendered node text must stay at 14px or larger. Rendered edge-label text must
  stay at 12px or larger after SVG and CSS transforms.
- For generated multi-lane scope diagrams, preserve lane-heading casing and use
  14px source text for those container labels. They are grouping metadata, not
  primary nodes. Author component-node text at 18px and use compact ELK spacing
  of 20px. This leaves enough source size for a modest fit to the review width
  without crossing the rendered text floors.
- Preserve the SVG's natural aspect ratio by copying its numeric `viewBox` width
  and height onto the root `<svg>`. Root SVG dimensions are allowed; manual width
  and height on text-bearing nodes are not.
- Use a 620px default reading budget. This keeps the load-bearing visual within
  a normal review viewport while leaving room for its title, legend, and finding.
- Allow a 780px exceptional cap for one justified technical diagram only when
  splitting would hide the relationship under review. Put
  `data-diagram-height-budget="780"` on that diagram's shell and state the reason
  beside the figure. The checker rejects more than one exceptional shell per page;
  this is a local exception, not a page-wide default.
- The page must have no horizontal overflow, and the load-bearing visual must
  not require internal scrolling. A secondary reference map may scroll inside
  a disclosure only when a compact overview contains the decision-critical path.
- At 1200px and narrower, replace a dense multi-lane SVG with a visible structured
  component-and-connection alternative. Keep the SVG for wider review widths;
  never solve the narrow view by shrinking its labels.
- If the layout becomes too wide or tall, repair it in this order: shorten or
  wrap labels, remove decoration, split at a real phase or decision boundary,
  then replace repeated fields with a table. Do not rotate a wide diagram into
  a long vertical chain merely to make it fit.

## Verify the rendered SVG

Inline `assets/diagram-fit-check.mjs` in a `<script type="module">` after the SVG. Wait for
`document.fonts.ready`, then run:

```js
const fit = validateD2DiagramTextFit(document);
if (!fit.ok) {
  throw new Error(JSON.stringify(fit.errors));
}
```

The checker ignores D2 container frames and checks the leaf component boxes
inside them. Container headings sit near the frame edge by design and must not
be mistaken for component-label overflow.

Reject the render when:

- node text extends outside its shape;
- an edge label overlaps a node;
- two edge labels overlap;
- another connection's arrow crosses a label. The labeled edge's own
  line is allowed behind its label.
- rendered node text is below 14px;
- rendered edge-label text is below 12px;
- the diagram is taller than the selected height budget: 620px by default or
  the explicit 780px exceptional cap;
- the page has horizontal overflow.

Fix the D2 source with the repair order above. Change direction only when it
matches the relationship; do not turn a wide flow into a tall page by default.
Do not repair the SVG by manually moving arrows or text.

Open the final page at desktop and narrow widths. Confirm the load-bearing visual
fits without internal scrolling and without shrinking text below the stated floors,
and confirm the structured alternative replaces a dense SVG at the narrow breakpoint.
