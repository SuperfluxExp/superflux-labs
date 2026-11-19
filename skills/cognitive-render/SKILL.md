---
name: cognitive-render
description: Render summaries, briefs, RCAs, plans, and synthesis in grounded human language — literal wording, progressive disclosure, natural cadence, and concise but uncompressed explanations. Use this skill EVERY time the user asks for a summary, brief, recap, synthesis, key takeaways, analysis, executive summary, TL;DR, digest, write-up, or any explanatory prose that condenses information — including outputs from Slack/Notion/Gong/Granola/calendar/email synthesis, channel digests, call summaries, daily briefings, research summaries, competitive briefs, status reports, and any "what's going on with X" requests. Also use when the user pastes existing AI output and asks to make it readable, unpack it, or rewrite it (e.g., "this is too dense", "render this", "unfold this", "make this clearer"). Default to literal language and zero unrequested analogies, metaphors, or story framing. Run the final verification pass before delivery.
---

# Cognitive Render

This is a rendering and pacing system, not a writing-style mimic.

The goal is simple to state and hard to do:
**Maximum understanding with minimum cognitive friction.**

The reader is a founder/operator. They are smart, fast, and overloaded. They are reading many AI-generated briefs today. They are context-switching constantly.

So the job is not to sound smart. The job is to help them understand and keep thinking.

---

## What this skill is for

Use this whenever you would otherwise produce:
- a summary, recap, or digest
- a synthesis across messages, notes, or calls
- an executive brief or status update
- a research write-up or analysis
- a re-rendering of someone else's dense output

It applies whether the input is:
- raw source material (documents, transcripts, articles)
- existing AI output the user wants re-rendered
- data pulled from connectors (Slack threads, calendar, call notes, etc.)

If the answer is meant to be read and understood, this skill applies.

If the answer is a single short factual reply, it doesn't.

---

## Core philosophy

Your job is **not** to:
- sound intelligent
- maximize information density
- compress aggressively
- produce polished analyst prose
- generate AI-newsletter energy
- create "thought leadership"

Your job **is** to:
- help the reader immediately understand
- preserve attention
- reduce mental decoding effort
- unfold ideas progressively
- sustain strategic thinking

The output should feel like an intelligent operator explaining something thoughtfully. Ideas unfolding naturally. Strategic, but easy to follow.

It should NOT feel like an analyst report, a McKinsey deck, or an AI newsletter.

---

## Plain before clever

State what happened in grounded human terms.

Every important sentence should make clear:

- who or what is acting
- what it acts on
- what happened
- what changed for the user or decision

Use the actor, object, action, and result. Do not replace them with implementation
shorthand.

When a sentence describes an action that will run somewhere, name where it runs: which
system, environment, and who runs it. Actor, object, action and result are not enough
when the reader's next question is 'where'.

When a sentence explains why something was configured or intended a certain way, say
where that reading came from: the code, a document, or a person. If it is your
inference, mark it as one. An unsourced statement of intent reads as established fact,
and the reader stops to ask how you know.

**Bad:**
> Cancel stops the browser reader, but it does not retire that assistant message.

**Better:**
> When the user clicks Stop, the page closes the live response connection.
>
> But the page still marks that unfinished answer as active. The next response can
> update the old answer as well as the new one.

The exact code term can follow in parentheses or supporting detail when it is useful
for engineers. It must not replace the plain explanation.

Do not invent a new label merely to shorten the sentence. Use the reader's nouns and
the source's real object names.

Do not stack the names of a command, a mode and an object into one phrase. Say what acts
on what, with a verb: 'run the release workflow in dry-run mode against the pull request',
not the three names in a row.

Do not use implementation shorthand as explanatory prose, even in an expander.
In particular:

- do not say the "browser reader" stopped; say the page closed the live response
  connection
- do not say a message was "retired" or "terminalized"; say the page marked the
  answer as stopped, complete, or failed
- do not say the "typewriter caught up"; say the page displayed all text received
  so far
- do not say a "stream remained active"; say the server had not confirmed that the
  answer was complete

Exact source identifiers such as `isStreaming` or `ReadableStreamDefaultReader` may
appear inside code formatting when they are evidence. Do not use them to carry the
explanation.

## Progressive disclosure is not storytelling

Progressive disclosure means giving the reader the answer first, then adding the
detail they need.

It does not mean:

- withholding the answer to create a reveal
- building suspense
- turning an incident into a narrative arc
- adding a punchline at the end of each section
- calling a sequence of events a story

For an RCA, lead with the cause and user impact. Then explain the event sequence.
Then show the evidence and fix.

Default to zero analogies, metaphors, or story framing. Use one only when the user
asks for it or when a literal explanation is still hard to understand. Give the
plain explanation first. Keep the analogy short, then return to the real product,
object, consequence, and action.

## Concise, not compressed

Remove repetition and filler. Keep every word the reader needs to understand the
sentence on the first read.

If shortening a sentence removes the actor, object, condition, or result, the sentence
is compressed rather than concise. Restore the missing words or split it into two
sentences.

**Bad:**
> The typewriter can catch up before the stream ends.

**Better:**
> The page can finish displaying the words it has received before the server
> confirms that the answer is complete.
>
> The answer then looks final even though the response is still in progress.

---

## Minimization pass

After drafting, remove repetition, filler, generic setup, and conclusions that
repeat the answer. Group related changes under the user's higher-level
deliverables; keep tasks and evidence inside their deliverable rather than
creating a section for every detail. For status updates, use a short outcome
line with its exact status and compact evidence reference.

Keep only what helps the reader understand, decide, or act. Use one useful visual
when it explains a relationship faster than prose; do not repeat its contents in
a paragraph. Delete unnecessary detail instead of moving all of it into expanders.
Preserve actors, conditions, uncertainty, exceptions, quantities, scope, risks,
and evidence. Stop when the point is complete; do not turn minimization into
clipped fragments or a fixed word limit.

## STE-inspired writing

Use this defined adaptation of ASD-STE100 Simplified Technical English when
drafting and reviewing prose. Do not use an undefined "80% STE" instruction.
This skill owns the shared writing rules; explaining-with-html applies them to
the page. The existing concise, not compressed rule takes priority.

- **Use one term for each concept.** Keep the user's established product terms.
  Do not alternate synonyms for variety or use one term for different concepts.
  Explain a necessary technical term on first use; retain exact UI labels and
  code identifiers when they are evidence.
- **Make actions explicit.** Prefer active voice when the actor is known.
  Never invent an actor to remove a passive sentence. Say when the actor is unknown.
- **Put conditions before actions.** State when an instruction applies before
  telling the reader to act: "If validation fails, stop the release."
- **Give each instruction one main action.** Separate ordered actions into steps.
  Keep prerequisites and exceptions with the action they govern.
- **Keep sentences easy to parse.** Split nested clauses and long noun chains.
  Repeat a noun when a pronoun could refer to two things. Keep connecting words
  that explain cause, sequence, or contrast; avoid a series of clipped fragments.
- **Preserve uncertainty, exceptions, quantities, units, and technical distinctions.**
  Do not change "may" to "will", "only if" to "if", or "not confirmed" to "failed".
  Preserve negation, scope, and causal direction. Compare the rewrite with its source.

Treat 20 words for instructions and 25 for explanations as review signals, not hard limits.
Review sentences above those lengths; keep a longer sentence when it is clearer.
These signals do not add automatic word-count failures or replace the existing
output verifier. Do not delete meaning to shorten a sentence or force every
sentence to the same length. The full STE dictionary and grammar restrictions
are not adopted here. Do not claim ASD-STE100 compliance from this adaptation
or from model familiarity with the standard.

Example context: a page displays an answer as the server sends it to the user.
"Premature completion signalling can lead to reliance on partial responses."
becomes "The page can show an answer as complete before the server finishes sending
it. The user may then act on an incomplete answer." The possibility remains a possibility.

Source: [ASD-STE100 Issue 9](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf),
writing rules and dictionary. The 20/25-word limits belong to STE; treating them
as review signals and retaining natural cadence are local adaptations.

## The two pacing rules that matter most

### Rule 1: Don't compress before the reader understands.

AI loves to stack strategic concepts into one tight sentence. This forces the reader to mentally unpack it before they can use it.

That's the opposite of the goal.

**Bad:**
> "AI commoditizes generation and shifts moat to verification."

**Better:**
> AI is making content and software generation much cheaper.
>
> But companies still need people and systems that can check:
> - whether the output is correct
> - whether it followed policy
> - whether it used trusted sources
>
> That means the review layer may become more important over time.

The first version makes the reader stop and decode.
The second lets them keep reading and start thinking.

A slightly longer explanation is BETTER than a dense sentence that needs decoding.

### Rule 2: Unfold one idea at a time.

Humans understand better through:
- gradual unfolding
- layered explanation
- pacing
- clear information order

So prefer:
- simpler sentences
- progressive explanation
- one idea introduced at a time
- the answer before the supporting detail

Do not:
- collapse concepts too early
- delay the answer for effect
- optimize for density
- pack strategic jargon for effect

---

## Cognitive load rules

Always optimize for:
- low mental friction
- easy parsing
- fast understanding
- sustained reading energy

The reader is scanning. They are tired of AI prose. Do not make them mentally unpack nested abstractions.

If a sentence makes the reader pause to figure out what it means — break it into two.

---

## Writing style

**Use:**
- shorter sentences
- direct language
- concrete nouns
- operational examples
- natural transitions
- progressive explanation

**Avoid:**
- consultant/MBA language
- corporate strategy phrasing
- AI-generated "balanced summary" tone
- fake profundity
- intellectual theater
- invented shorthand
- implementation terms in place of ordinary words
- unrequested analogies, metaphors, or story framing
- scripted transitions that add no information
- motion verbs that imply progress without naming what changed
- vague intensifiers with no evidence behind them

**Phrases to never use** (these are red flags — they signal AI/consultant register):
- "This highlights the importance of..."
- "Organizations should..."
- "In today's fast-changing world..."
- "leveraging AI" / "leveraging X"
- "key takeaway"
- "it is important to note"
- "AI is transforming industries"
- "moving the needle"
- "at the end of the day"
- "synergies"

This list is a floor, not the test. Word blacklists are brittle — swap in a fresh synonym and the sentence is still empty. The sentence-level tests below catch what the list misses.

---

## Sentence-level tests

Run these on every consequential sentence. They catch empty prose that no phrase list can.

- **Paraphrase test.** Restate the sentence in the plainest words available. If the plain version carries no concrete claim ("things exist", "change is happening"), delete the sentence.
- **Deletion test.** Remove the sentence. If the paragraph loses no meaning, leave it out.
- **Transplant test.** If the sentence could sit unchanged in a brief about a different team, company, or topic, it is generic. Replace the abstraction with this brief's actor, object, number, or consequence.
- **Specific-verb test.** Replace verbs that merely imply motion — "streamlining", "accelerating", "evolving", "driving" — with what actually happened and what changed.

---

## Rhythm and flow

The output should feel like someone thinking **with** the reader, not talking **at** them.

Vary pacing naturally:
- some ideas can be short and sharp
- some ideas should unfold over several sentences
- some sections should end as soon as the point is complete

Do not maintain perfectly symmetrical structure or identical paragraph sizes. Conversational movement is good.

Natural cadence comes from clear thinking and varied sentence length. Do not manufacture
it with filler such as "here's the catch," repeated setup lines, or decorative one-line
conclusions.

---

## Preserving strategic substance

This is important: cognitive-render is **not** dumbing down.

Preserve:
- strategic insight
- implications and second-order effects
- incentives
- tradeoffs
- operational consequences
- workflows

The difference is *how* you preserve them. You explain them progressively rather than compressing them into a slogan.

**Bad (compressed):**
> "AI shifts value from generation to governance."

**Better (unfolded):**
> AI can now generate a lot of work very quickly.
>
> But companies still need ways to:
> - review that work
> - approve it
> - trace where it came from
> - understand what changed
> - know whether they can trust it
>
> So a lot of the new value may end up sitting around review, tracking, and governance — not generation itself.

Same insight. The reader actually absorbs it.

---

## Attention preservation

The goal is **not** maximum signal per sentence.
The goal **is** maximum understanding per unit of attention.

The reader should feel:
> "I get this immediately."

NOT:
> "This sounds smart but I need to unpack it."

---

## Create the reader context before drafting

For a substantive summary, plan, spec, RCA, skill, or UI proposal, read
`references/human-readable-verification.md` and create the required reader-context
JSON before writing the draft.

Set an attention budget and choose two to four points the human should retain. Keep the
visible readout within that budget; move proof and secondary detail behind progressive
disclosure. Record how long the reader has been away. Record work completed since the
reader last saw the output as human-visible outcomes in `unseenChanges`, not as commit
hashes, file names, raw errors, logs, or code identifiers.

When the reader returns after four or more hours, give the resume in three blocks: one
status line saying when the work paused, where it stopped, and what was rechecked since;
two short columns, already done and still open; and one line naming what you need from
them. Do not give each fact its own card — when it paused, where it stopped and what
changed since are the same question in three tenses, and six equal cards leave the eye
nowhere to land.

State which phase the work is in every time you report status, not only after a long
absence. This reader runs several sessions at once, so they lose the thread in minutes
rather than hours, and a reply that reports progress without naming the phase leaves
them unable to tell planning from building.

Build the terminology list from the conversation, the product's visible words, and the
repository. Prefer the conversation and product terms in visible prose. Use repository
terms only when the exact identifier helps an engineer locate evidence.

The verifier uses `references/stop-slop-rules.json` as a versioned adaptation of
<https://github.com/hardikpandya/stop-slop>. Use its phrase and structure checks. Do not
adopt blanket rules that make the output compressed or jagged. This skill permits a
useful adverb, an em dash, or a complete three-item list when it improves the engineer's
first-read understanding.

For a product-facing technical spec, include marked user stories written with the same
terms a person sees in the product. Do not rename the user's goal or the UI merely to
match a repository identifier. Put that identifier in supporting evidence when it helps
an engineer locate the implementation.

For a technical spec or RCA, include one marked load-bearing visual before
implementation detail. Choose the smallest useful visual for the relationship: a
comparison table for repeated fields or options, a timeline for events, before/after
panels for a state change, a swimlane for ownership, or an architecture diagram only
when the reader must understand a real multi-part system relationship. When presenting
UI, lead with a UI mock-up before implementation detail.

---

## How to actually produce output

This is the operational part. Use it as a checklist after you draft.

1. **Lead with the thing that matters.** First line or two should tell the reader what this is and why they should keep reading. No throat-clearing.

2. **One idea per sentence.** If you find yourself using "and" or a comma to glue two strategic concepts together — split them.

3. **Concrete over abstract.** Prefer "the support queue grew from 40 to 120 unresolved tickets" over "support volume has materially increased."

4. **Use lists when the items are genuinely parallel.** Don't use lists to make prose look organized. Use them when the reader will benefit from being able to scan a set of similar things.

5. **Make transitions carry information.** Prefer "The problem appears after the user clicks Stop" over a generic line such as "Here is why that matters."

6. **Vary paragraph length on purpose.** A 3-line paragraph followed by a 1-line punch is much easier to read than three matched 4-line paragraphs.

7. **Stop when the point is complete.** Do not add a punchline, teaser, or tidy conclusion merely to create rhythm.

8. **Cut the AI tells.** Search your draft for the banned phrases above. Also cut: hedging filler ("it's worth noting", "in many cases"), tidy-bow summaries ("In conclusion..."), and forced parallelism ("Not only X, but also Y"). Then run the sentence-level tests above — the phrase list is the floor; the tests are the gate.

---

## Final verification pass

Run this after drafting and before delivery. Do not treat it as optional.

1. **Deterministic gate.** Save the draft and reader context, then run
   `scripts/verify-human-readable-output.mjs --input <draft> --context <context>`.
   Fix every reported line and rerun it. A passing report is required, but it does not
   replace the human cold read.
2. **Cold read.** Read every visible sentence as a first-time reader. If it needs
   implementation knowledge or a second read, rewrite it before shipping.
3. **Actor and referent check.** For each important sentence, identify the actor,
   object, action, and result. Replace unclear "it," "this," "that," or invented
   labels with the real noun. Apply the check to headings, diagram labels, and
   buttons as well. Use "Identify the affected product and repositories" for
   ticket intake. When a person must make a decision, name the role and the
   decision, for example "Ask the developer to confirm the base branch."
4. **Literal-language check.** Search for analogies, metaphors, story language,
   rhetorical reveals, and human qualities assigned to software. Remove them unless
   the user requested them and the literal explanation already appears first.
5. **Jargon check.** Keep ordinary explanations in all user-facing prose, including
   expanders. Exact source identifiers may appear inside code formatting as evidence.
   Search specifically for "browser reader," "retire," "terminalize," "typewriter
   caught up," and "stream remained active." Rewrite them in literal product terms.
6. **Internal-language check.** Remove workflow labels and unexplained acronyms that
   matter only to the author, such as "forward render" or "EDD." Name the actual
   activity: revised page, browser check, automated test, or human review.
7. **Compression and meaning check.** Apply the STE-inspired writing rules above.
   Compare the rewrite with the source for conditions, exceptions, uncertainty,
   negation, quantities, units, scope, and causal direction. Split any sentence
   that hides a condition or consequence. Concise wording must still say who did
   what and what changed. Do not invent a known actor where the source has none.
8. **Empty-sentence check.** Paraphrase each consequential sentence plainly. Delete any
   whose plain version carries no concrete claim, and any that can be removed without
   the paragraph losing meaning.
9. **Transplant check.** Flag sentences that could sit unchanged in a brief on a
   different topic and are not grounded by specifics within the next few sentences —
   a plain opening line that the following sentences immediately make concrete is
   fine. Replace an ungrounded abstraction with this brief's actor, object, number,
   or consequence, and replace verbs that merely imply motion ("streamlining",
   "accelerating", "evolving") with what actually happened.
10. **Progressive-disclosure check.** Confirm the answer and user impact come before
   mechanism and evidence. Do not bury a required distinction in supporting detail.
11. **Detail check.** Keep commit hashes, file coordinates, raw errors, logs, and unseen
   code out of the visible readout. Put them in evidence only when they help an engineer
   verify the claim.
12. **Read-aloud check.** Read the final prose at a normal speaking pace. Rewrite any
   sentence that sounds scripted, breathless, or unnaturally clipped. Watch for clusters
   of colons or dashes and long runs of same-shape sentences; a deliberate short echo
   is fine. Vary the rhythm instead of banning a mark.

The vocabulary of the writing process itself is the jargon most likely to leak, because
the author reads it before every draft. Words such as shape, spine, register and funnel,
and any name coined while working in code, belong to the method and not to the reader.
Name the thing itself, and never carry a private code-side coinage into prose as though
it were shared.

Only deliver after all twelve checks pass.

---

## Output shape (when there's a choice)

For most briefs/summaries, this shape works well:

1. **One-line headline or framing.** What is this and why does it matter.
2. **The 2–4 things that actually matter,** each unfolded enough to be absorbed.
3. **What it means / what to do next** (if relevant).

Don't force it. If the material is one thing, write one thing. If it's a list of updates, the shape is a list of updates. The skill isn't a template — it's a register.

---

## Length

There is no fixed length. The right length is whatever lets the reader absorb the material without friction.

If the input is rich, the output is sometimes longer than a "compressed" version — because unfolding takes more words than compressing. That's fine. The metric is reader attention spent, not word count produced.

If the input is thin, the output is short. Don't pad.

---

## When NOT to use this style

A few cases where the rendering style should NOT apply:
- The user asked for bullet points only, or a one-line answer
- The output is a code block, a structured data file, or a form
- The user asked for an actual analyst-style document with formal structure (e.g., "write me a McKinsey-style brief")
- The output is for a different audience the user named (e.g., "this is going in a customer email — make it formal")

In those cases, follow the user's explicit shape. Don't smuggle the rendering register in where it doesn't fit.

---

## A short before/after

**Before (typical AI summary energy):**
> The team's velocity has been impacted by competing priorities across multiple workstreams, highlighting the importance of more disciplined prioritization. Leadership should consider implementing a more structured intake process to ensure resources are allocated in alignment with strategic objectives. Key takeaway: focus is the bottleneck.

**After (cognitive-render):**
> The team is moving slower than it could.
>
> Not because anyone is underperforming. The issue is simpler: too many things are open at once.
>
> Three workstreams are running in parallel. Each one has its own deadline. Each one feels urgent. So engineers are switching contexts several times a day, and the cost of that switching is showing up as slipping dates.
>
> The fix probably isn't more process. It's picking which workstream is actually the priority for the next two weeks, and letting the other two sit.

Same content. The second version lets the reader absorb it and keep thinking.

---

## Final principle

Don't optimize for:
> "How much intelligence can fit into this sentence?"

Optimize for:
> "How naturally can the reader absorb this and keep thinking?"

If a sentence needs translation, it is not ready. Rewrite it in normal words, then
run the final verification pass again.
