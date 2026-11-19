# Human-readable output verification

Use this contract for a substantive summary, plan, spec, RCA, skill, or UI proposal.

## 1. Create the reader context

Write a small JSON file before drafting. Use this shape:

```json
{
  "schema": "superflux.human_readable_output_context.v0.1",
  "document": { "kind": "spec", "presentsUi": true },
  "reader": {
    "timeAwayHours": 18,
    "attentionBudgetMinutes": 3,
    "keyPoints": [
      { "readerPhrase": "Stopped answers now remain visible and are labelled incomplete." }
    ],
    "unseenChanges": [
      {
        "readerPhrase": "Copy remains available after the user stops an answer.",
        "evidence": "commit or test reference for the author only"
      }
    ]
  },
  "terminology": {
    "conversation": ["stopped answer"],
    "product": ["Acme", "Copy"],
    "repository": ["isStreaming"],
    "forbidden": ["execution spine"]
  }
}
```

Use two to four `keyPoints`. They are the ideas the reader should retain after closing
the output. Write every `readerPhrase` in words the reader has already seen. Put commit
hashes, code identifiers, raw errors, logs, and file coordinates in `evidence`; do not
use them as the explanation.

Treat `attentionBudgetMinutes` as a limit for the visible readout, not a decorative
field. The deterministic gate budgets 220 visible words per minute. Move secondary
mechanism and proof behind progressive disclosure when the readout exceeds that limit.

Build the terminology lists from the current conversation, visible product copy, and
the repository. Repository identifiers may support an explanation. They do not replace
the product words the user already knows.

When `timeAwayHours` is four or more, include a short recap in three blocks. One status
line: when the work paused, where it stopped, and what was rechecked since — or "nothing
rechecked". Two short columns: already done, and still open. One ask: what the reader
needs to decide, review, or send. Describe work completed while the reader was away
through its visible behavior or decision impact.

Three blocks, not six cards. When it paused, where it stopped and what changed since are
the same question in three tenses, and six equally weighted cards leave the eye nowhere
to land — the one part that needs the reader to act looks like the parts that do not.

## 2. Mark document-shape requirements

- For a technical spec or RCA, choose the smallest useful visual and mark it. In HTML,
  use `data-visual-role="comparison-table"`, `timeline`, `before-after`, `swimlane`,
  `cause-effect`, `ui-mockup`, or `architecture` on the element that carries the
  relationship. In Markdown, add `<!-- primary-visual:<role> -->` before the table or
  Mermaid/D2 block. Keep the older architecture marker only for existing artifacts.
- For a technical spec, add `<!-- user-stories -->` before the user stories. In HTML,
  add `data-section="user-stories"`. Write the stories with the product words the user
  already knows. The marker proves presence; the final cold read judges whether the
  stories are clear and genuinely grounded.
- When presenting UI, add `<!-- ui-mockup -->` before the mock-up. In HTML, add
  `data-visual-role="ui-mockup"`. Put the mock-up before implementation detail.
- Keep raw proof in a Markdown Evidence section or an HTML `<details>` element so it
  does not interrupt the visible readout.

## 3. Run the deterministic gate

```powershell
node <cognitive-render>/scripts/verify-human-readable-output.mjs `
  --input <draft-path> `
  --context <reader-context-path>
```

Do not deliver when the command exits non-zero. Fix every reported line and run it
again. The report catches known AI phrases, formulaic contrasts, jagged fragments,
overlong sentences, ungrounded compressed labels, excessive reader load, missing
resume context, hidden work described only through internal evidence, and missing user
stories, mock-ups, or marked load-bearing visuals. It also reads visible text inside SVG
diagrams while ignoring paths, styles, and geometry metadata.

The rule source lives in `stop-slop-rules.json`. It records the reviewed upstream
commit from <https://github.com/hardikpandya/stop-slop> and the local overrides. Rules
taken from upstream sit under `adopted`. Phrases and labels Superflux added itself sit
under `localAdditions`; keep them when upstream does not list them. Review the upstream
source within the recorded interval. Do not adopt its blanket bans when they make
engineer-facing prose compressed, jagged, incomplete, or unnatural.

## 4. Finish with a human cold read

The command cannot prove comprehension or decide whether a new term is legitimate.
Read every visible line as the engineer receiving it. Then read the whole output at a
normal pace. Confirm that the ideas arrive in a useful order, transitions carry the
reader forward, and every detail earns the attention it consumes.

Apply the four sentence-level tests during the cold read:

- **Paraphrase:** restate each consequential sentence plainly; delete it when the plain
  version carries no concrete claim.
- **Deletion:** remove the sentence; leave it out when the paragraph loses no meaning.
- **Transplant:** a sentence that could sit unchanged in output about a different team,
  company, or topic — and is not grounded by specifics within the next few sentences —
  is generic. Replace the abstraction with this output's actor, object, number, or
  consequence.
- **Specific verbs:** replace verbs that merely imply motion — "streamlining",
  "accelerating", "evolving" — with what actually happened and what changed.
