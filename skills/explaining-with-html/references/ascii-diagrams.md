# ASCII diagrams in HTML

Prefer compact ASCII when it lets the reader trace a system, workflow, owner,
dependency, or decision with less effort. Branches do not require D2/SVG conversion.
Tables compare repeated fields, charts show magnitude, screenshots show screens.

## Safe accessible pattern

Copy `.ascii-figure` and `.ascii-diagram` CSS from the template. Escape text once
with `html.escape`, or assign browser `textContent`. Do not put markup inside the
pre. Use a visible caption that states the relationship, scope, and status in plain
language. It is also the accessible name for the focusable scroll region. Keep
source links/check times nearby; uncertain deployment stays explicitly unknown.

```html
<figure class="ascii-figure" data-visual-role="request-sequence">
  <figcaption id="request-caption">Proposed, not implemented:
    the API queues a job and a worker processes it.</figcaption>
  <pre class="ascii-diagram" data-diagram-format="ascii" tabindex="0"
       role="region" aria-labelledby="request-caption">API
 | enqueue &lt;job&gt;
 v
Queue
 | claim
 v
Worker</pre>
</figure>
```

Use 16px or larger monospace with preserved whitespace, normal word breaking and
wrapping disabled. Start around 28-32 columns, then check 375px and 320px. Shorten
labels without inventing terms, or split at a real boundary. If necessary, allow
horizontal scrolling inside the named region; keep the whole page within the
viewport. Never scale text down or wrap diagram lines to make it fit.

## Bounded examples

These are illustrative only, not facts about a deployed product. Keep that label
when reusing them. Each caption explains the same relationship as the diagram.

Ownership (`data-visual-role="ownership"`):

```text
Project owner
  +-- API configuration
  +-- Worker configuration
```

Decision (`data-visual-role="decision-tree"`):

```text
Worker slot available?
  +-- yes -> Start one job
  +-- no  -> Keep it queued
```

Dependency (`data-visual-role="workflow"`):

```text
Approve migration (person)
  |
  v
Run migration (person)
  |
  v
Start worker (proposed)
```

If current and proposed behavior share a figure, label each changed node or branch
in the text; do not depend on color.

## Rendering checks

Inline `assets/diagram-fit-check.mjs` in a module script, wait for fonts, then run
`validateAsciiDiagramFit(document)`. It rejects hidden/empty diagrams, nested markup,
tabs, destructive wrapping, non-monospace or small rendered text, unnamed diagrams,
inaccessible overflow, and page overflow. Inspect the screenshot too: a passing
DOM check does not prove a good abstraction or reader understanding. Exercise any
scroll region with keyboard arrows and verify the caption remains visible.

A browser check should exercise real layout and intentionally broken variants.
