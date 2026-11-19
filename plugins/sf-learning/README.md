# sf-learning

Learns writing rules from your own conversations, and proposes reviewed diffs to
the writing skills. It never edits a skill file directly.

**Status: v0.5.** Every prompt you write is captured, redacted, provenance-tagged
and classified. A style profile can be built on demand. `/sf-learning:process`
reads captured prompts with their replies and records what they say about writing.
An observation seen in two different sessions becomes a proposal on a review page,
and one guarded script applies an approved rule, only on a `sf-learning/propose-*`
branch. Nothing changes a skill file without your approval.

## The two streams

Capture feeds two different things, and they need different gates.

| | Stream 1 — style corpus | Stream 2 — rule observations |
|---|---|---|
| What | every prompt you write | only the ones flagged `is_correction` |
| Used for | sentence-length spread, punctuation habits, vocabulary, paragraph size | candidate rules to propose against a skill |
| Gate | none — it is statistics, and next week's data corrects last week's | **your approval, always** |
| Growth | fixed-size profile, recomputed | append-only, thresholded |

Stream 1 needs no approval because it never changes an instruction — it updates a
descriptive profile that self-corrects. Stream 2 rewrites instructions that
persist until a human removes them. Different blast radius, different gate.

That split is also why skill bloat is bounded: only stream 2 can grow a skill
file, and stream 2 is the small stream.

## The style profile (stream 1)

```bash
node plugins/sf-learning/scripts/profile.mjs
```

Reads every `corpus/*.jsonl`, writes `$HOME/.superflux/sf-learning/profile.json`, and
prints a short report. Rows with `provenance: machine`, slash commands, and empty
text are excluded; `wrapped` rows are used, because their stored text is the
user's.

What it computes — all counts and ratios, no model:

| field | meaning |
|---|---|
| `sentence_words` | distribution of words per sentence: median, mean, p90, stddev, range |
| `prompt_words` | the same for whole prompts |
| `paragraphs_per_prompt` | blank-line-separated blocks |
| `casing` | share of prompts starting lowercase; `i` vs `I` counts |
| `terminators` | which sentence-ender the user actually uses most |
| `punct_per_1k_words` | punctuation habits normalised so corpora of different sizes compare |
| `vocabulary` | distinct words, type-token ratio, top 40 words with stopwords removed |
| `cadence` | the beat: bucket share, swing between consecutive sentences, long→short and short→long landing rates, same-beat run length, mid-thought pause marks, most common 3-beat shapes |
| `by_runtime` | the same breakdown per harness, so voice can be compared across them |

**Cadence is measured on the sequence, not the spread.** Two texts with identical
sentence-length spread can read in opposite ways — "long long short" and "short
long short" have the same numbers. So the `cadence` block looks at consecutive
sentences: how big the swing is, how often a long one lands on a short one, how
long the user stays in one beat, and which three-beat shapes recur.

It is measured over **prose runs only**. The corpus is full of numbered lists,
bullets, pasted logs and paths, which produce `1 1 1 1` sentence runs that are not
writing and would bury the signal. A list item, bullet, code-ish line, or bare
URL/path breaks the run. Buckets are short ≤5 words, mid 6–14, long ≥15 —
set from the corpus (sentence median 8, p90 22), not from convenience.

`..` followed by more text is counted as a mid-thought pause; at the end of a
prompt it is a stop. In the first two weeks it was a pause 453 times and a stop 71
— it is the user's comma-and-a-half, not their period.

What cadence does NOT capture: **flow** — whether each sentence earns the next.
That is a judgment about meaning, not a count, and stays in human reading.

**Tokenizer decisions are grounded in the corpus, not assumed.** `..` is treated
as a sentence terminator because in the first two weeks it appeared 541 times —
it is the user's own separator, not a typo. A period only terminates when followed
by whitespace or end-of-text, so paths, URLs, and version numbers stay whole.

**Two caveats the consumer must respect:**

- **Em dashes are almost certainly not the user's.** Prompt capture cannot tell a
  typed character from one pasted back out of an agent's reply. Report the count;
  do not read it as habit.
- **This profile goes to the voice skills only** — any skills that write in your
  own voice. It must not be handed to `cognitive-render` or
  `explaining-with-html`. Those optimise for a reader understanding, and a
  profile of "lowercase fragments, low tolerance for polish" would push them
  toward mimicry.

`profile_version` is stamped so a consumer can tell which computation produced
the file. Nothing consumes it yet; that wiring is the next step.

## Where the corpus lives

```
$HOME/.superflux/sf-learning/
  corpus/YYYY-MM.jsonl     one JSON row per prompt, partitioned by UTC month
  profile.json             the stream-1 style profile, rebuilt on demand
  process-state.json       how far the process pass got, and when it last reminded you
  process-runs.jsonl       one line per process run, including the drops it counted
  capture-errors.log       written only when a capture fails
```

Override with `SF_LEARNING_HOME`.

**Not in the plugin directory, and not in the repo.** A plugin is copied into the
runtime's cache on install and that copy is replaced on reinstall, so a
plugin-relative ledger would be destroyed by a routine update. And the corpus is
raw prompt text — the repo gets committed and pushed.

Extracted observations are a separate, reviewable artifact and live in the repo at
`docs/learning/observations/YYYY-MM.jsonl`. Raw capture does not.

### Row shape

```json
{
  "ts": "2026-08-03T22:10:00.000Z",
  "runtime": "claude-code",
  "session": "abc123",
  "cwd": "C:/repo",
  "provenance": "wrapped",
  "wrapper": "in-app-browser-context",
  "chars": 38,
  "raw_chars": 1412,
  "truncated": false,
  "is_correction": true,
  "is_comprehension": false,
  "is_slash_command": false,
  "clf": 3,
  "text": "no, use the existing eval pack instead",
  "reply": {
    "text": "I went with a new golden set because…",
    "chars": 2140,
    "truncated": false,
    "ts": "2026-08-03T22:09:41.000Z",
    "reason": null
  }
}
```

**`reply`** — what the assistant said right before this prompt. This is what
turns a reaction into evidence: "i am lost" on its own says the user was lost;
with the reply attached, it says what lost them. Read from the session
transcript on disk at capture time (the hook payload does not carry it), the
last text the assistant produced before the prompt — not the interim narration
of a long tool-heavy turn, only the final thing the user actually read. Same
redaction as the prompt; capped at 3000 chars with the true length in `chars`.
Present on every row: when there is no reply, `text` is `null` and `reason`
says why. An absent reply is never mistaken for an empty one.

| reason | meaning |
|---|---|
| `no-transcript` | the transcript could not be found or read — including a session's very first prompt, whose file does not exist yet |
| `no-reply` | the transcript was read and has no assistant text before this prompt |
| `backfill-no-match` | backfill found no typed prompt within two minutes of the row's timestamp, so it recorded that rather than guessing |

Claude Code transcripts and Codex `rollout-*.jsonl` files are both read. For
Codex, only final assistant messages (`phase: "final_answer"`, plus the older
`"final"` spelling) are eligible reply context;
interim commentary is excluded.

Rows filled after the fact carry `reply.backfilled: true`:

```bash
node plugins/sf-learning/scripts/backfill-reply.mjs --dry-run   # numbers only
node plugins/sf-learning/scripts/backfill-reply.mjs             # then apply
```

Backfill joins on the row's **timestamp**, not its text — stored text is
redacted, capped at 4000 characters, and for a `wrapped` row holds only your
part of the payload, so text matching would fail on exactly the rows worth
filling. It writes nothing but `reply`, and throws if any other field would
change. On the first real pass it filled 319 of 928 rows; the rest were Codex
(421), a missing transcript (62), a session's first prompt (89), or no match
inside the window (16).

**`provenance`** — did the user actually type this? Two weeks of real capture
showed 29% of `UserPromptSubmit` payloads were runtime-injected text: ambient
browser state, task-completion notices, subagent prompts, a scheduled agent's
system prompt. Some of those wrappers contain the user's prompt after the
block; others carry no human text at all.

| value | meaning | in the streams? |
|---|---|---|
| `human` | clean prompt, stored as-is | yes |
| `wrapped` | a known runtime block followed by the user's prompt — only the prompt is stored, `wrapper` names what was stripped | yes |
| `machine` | no human text; `text` is empty | no — kept for counting only |

An unrecognised angle-bracket block at the start of a payload is `machine`,
conservatively. A false "machine" costs one observation; a false "human" puts
runtime text into the user's voice profile.

**`chars`** is the length of the human text; **`raw_chars`** is the whole
payload, so wrapper bloat stays measurable.

**`is_correction`** is pushback or redirection ("no", "not what i wanted",
"revert"). **`is_comprehension`** is the user saying they could not follow ("i
am lost", "wall of text", "what do you mean"). A row can be both. Comprehension
is the stream-2 signal for `cognitive-render` and `explaining-with-html`.

**`clf`** is the classifier version. Every improvement to the classifier makes
older rows wrong, so:

```bash
node plugins/sf-learning/scripts/rescore.mjs
```

re-scores every row below the current version in place — one-time `.bak`
beside each file, atomic rewrite, malformed lines preserved verbatim, idempotent.

Rescore re-runs the **classifiers** only. Provenance is derived once, from the
raw payload at capture (or from a v1 row's stored text, which is the whole
payload), and then preserved — a v2+ row stores already-extracted text, and
re-deriving provenance from that would relabel every machine row as human. That
happened once and is now pinned by a regression test.

**It also refuses to write when the numbers move too far.** The run that
corrupted the ledger printed a summary that read like success, so the counts are
now checked before anything is written, and the command aborts with both
distributions on screen:

| dimension | limit | why |
|---|---|---|
| provenance buckets | 5 points | derived once and preserved, so it should barely move; a swing here is what corruption looks like |
| classifier flags | 15 points | these are *supposed* to move when the classifier improves — the real v2→v3 bump moved `is_correction` by under a point |

Only rows that already carried the field are compared, so a v1→v2 migration is
not mistaken for a shift, and the guard is skipped (and says so) below 20
comparable rows. `--allow-distribution-shift` overrides it and prints what it
let through.

## Runtimes

Both Claude Code and Codex load plugin hooks and fire `UserPromptSubmit`, so the
capture hook is written once and works in both. Codex records a `trusted_hash`
per hook in Codex's `config.toml`, which is why `hooks/capture-prompt.mjs` is a
two-line shim — all behaviour lives in `src/capture.mjs`, which can change
without asking you to re-approve the hook.

Hermes is a supported harness too, but is deliberately out of scope for now.

## Safety

- **Redaction runs before anything is written**, and before truncation, so the
  stored text is fully redacted regardless of length. Covered kinds: private-key
  blocks, bearer tokens, connection-string passwords, AWS access key ids, known
  API-key prefixes, and `NAME_KEY=`-style assignments.
- **The hook never breaks your turn.** It prints nothing, always exits 0, and
  writes failures to `capture-errors.log` with a stack. This is the one place in
  the plugin that swallows an exception, and it is not a silent fallback — a
  broken capture stays diagnosable.
- **Long pastes are truncated** at 4000 characters. A 40k paste is material you
  did not write, and storing it would swamp the style profile. `chars` records
  the true length so the row stays honest.

## Reading the corpus (stream 2)

```bash
node plugins/sf-learning/scripts/process-batch.mjs --repo .      # next batch of rows
node plugins/sf-learning/scripts/process-record.mjs --input j.json --repo . --check
node plugins/sf-learning/scripts/process-record.mjs --input j.json --repo .
```

`/sf-learning:process` drives those two: the first prints rows since the
watermark with the reply that preceded each one, the model judges them, the
second validates and records. Observations land in
`docs/learning/observations/YYYY-MM.jsonl` **in the repository**, so a pass is
reviewable as a diff. The raw corpus stays out.

Each row gets one of four verdicts: `new` (rule missing), `refine` (rule too
vague), `example` (rule exists and was ignored — **never produces a diff**), or
`drop` with a required reason. A proposal needs the same rule seen in two
different sessions, so a repeat must be matched to the observation it repeats
rather than filed as a second record.

Two rules are enforced by the recorder, not left to good behaviour:

- **Quoted evidence must appear in the row it cites.** Paraphrase is rejected.
- **Rule text must be authored, never lifted.** A rule that is a verbatim span
  of the prompt or the reply is rejected. The corpus is full of text pasted from
  other systems, and copying it into a skill file is how someone else's sentence
  becomes a standing instruction.

A batch with any rejection records nothing and the watermark does not move.
Drops are counted per run in `process-runs.jsonl` beside the corpus rather than
stored per row, so the ledger stays readable.

### Approving a change

```bash
node plugins/sf-learning/scripts/proposal-review.mjs --repo . --month 2026-08
```

Renders every observation past the threshold as one self-contained page: the
text in the skill today beside the text proposed, the file and line it would
change, how many times you hit the problem and across how many sessions, what it
costs in lines against that skill's size budget, and the claim written so a later
run can prove it wrong. Each card carries approve, reject, reword, or wait, and
the page compiles one copy-ready reply.

Approval is never asked for by pointing at the ledger. The ledger is the record;
the page is the review.

A `Stop` hook says once — and no more often than every 72 hours — when more than
150 captured prompts are waiting. Until the scheduled version is allowed, that
reminder is what stops this depending on memory.

## Known limitations

- The classifier is regex, and conservative on purpose. It will miss
  corrections phrased in ways it has not seen. Measure its hit rate against
  real capture before the threshold logic leans on it — that is what the v1→v2
  pass did, and it should be repeated.
- New runtime wrappers will appear. They land as `machine` via the
  unknown-block fallback until a shape is added to `provenance.mjs`, so a
  wrapper that carries the user's prompt loses that prompt until then. Check
  the `wrapper` field for `unknown-block` periodically.
- Truncation is a blunt instrument. A prompt that is one line of yours plus a
  long paste is stored as if it were all yours, up to the cap.
- Nothing consumes `profile.json` yet; the voice card is stream 1's next step.

## Commands

```bash
npm run test:sf-learning
```
