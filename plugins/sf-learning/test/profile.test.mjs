// The profile is the bookkeeping a real style system should keep:
// sentence-length spread, punctuation habits, casing, vocabulary. Every
// number here is a plain count or ratio — no model, no judgment — so the
// tests can assert exact values.

import { test } from "node:test";
import assert from "node:assert/strict";

import { PROFILE_VERSION, buildProfile, cadenceOf, extractFeatures, proseRuns, splitSentences } from "../src/profile.mjs";

// ---- cadence: the beat pattern, not just the spread ----
//
// Cadence is where a writer pauses, speeds up and lands hard. Two texts with
// identical sentence-length spread can have opposite shapes. So cadence is
// measured on the SEQUENCE of sentence lengths, and only over prose runs —
// numbered lists and pasted output produce "1 1 1 1" runs that are not
// writing and would bury the signal.

test("proseRuns drops list items and code-ish lines, keeps consecutive prose", () => {
  const text = "first real sentence here.. second one too\n1. item\n2. item\n- bullet\nthird real sentence after the list";
  const runs = proseRuns(text);
  assert.equal(runs.length, 2, "the list splits prose into two runs");
  assert.deepEqual(runs[0].map((s) => s.slice(0, 5)), ["first", "secon"]);
  assert.deepEqual(runs[1].map((s) => s.slice(0, 5)), ["third"]);
});

test("proseRuns treats a URL-only or path-only line as non-prose", () => {
  const runs = proseRuns("look at this\nhttps://example.com/x\nD:/work/x/file.mjs\nand tell me");
  assert.equal(runs.length, 2);
});

test("proseRuns returns one run for plain multi-sentence prose", () => {
  assert.equal(proseRuns("a b c. d e f. g h").length, 1);
});

test("proseRuns handles empty and non-string input", () => {
  assert.deepEqual(proseRuns(""), []);
  assert.deepEqual(proseRuns(undefined), []);
});

test("cadenceOf: a flat text has low variation and no long-short landings", () => {
  // four sentences of 6 words each
  const c = cadenceOf("a b c d e f. g h i j k l. m n o p q r. s t u v w x");
  assert.equal(c.sentences, 4);
  assert.equal(c.mean_abs_delta, 0);
  assert.equal(c.long_then_short, 0);
  assert.equal(c.max_run_same_bucket, 4);
});

// LONG is >= 15 words — set from the corpus (sentence median 8, p90 22), not
// from what makes a fixture convenient. A 12-word sentence is "mid".
const LONG = "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen";

test("cadenceOf: 'setup, pause, punch' registers as a long-then-short landing", () => {
  const c = cadenceOf(`${LONG}. Two pages in`);
  assert.deepEqual(c.buckets, ["long", "short"]);
  assert.equal(c.long_then_short, 1);
  assert.equal(c.ends_short, true);
  assert.equal(c.starts_short, false);
});

test("cadenceOf: a 12-word sentence is mid, not long — thresholds come from the corpus", () => {
  const c = cadenceOf("one two three four five six seven eight nine ten eleven twelve. Two pages in");
  assert.deepEqual(c.buckets, ["mid", "short"]);
  assert.equal(c.long_then_short, 0);
});

test("cadenceOf: alternating long/short has high mean_abs_delta", () => {
  const c = cadenceOf(`${LONG}. short one. ${LONG}. short again`);
  assert.ok(c.mean_abs_delta > 12, `expected large swings, got ${c.mean_abs_delta}`);
  assert.equal(c.long_then_short, 2);
  assert.equal(c.short_then_long, 1);
});

test("cadenceOf: buckets are short(<=5) / mid(6-14) / long(>=15) and the sequence is reported", () => {
  const c = cadenceOf("a b c. d e f g h i j k l m. one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen");
  assert.deepEqual(c.buckets, ["short", "mid", "long"]);
  assert.deepEqual(c.lengths, [3, 10, 16]);
});

test("cadenceOf: '..' mid-text counts as a pause, '..' at the end as a stop", () => {
  const c = cadenceOf("i think this works.. but not sure.. ok");
  assert.equal(c.pause_marks, 2);
  const d = cadenceOf("done with it..");
  assert.equal(d.pause_marks, 0);
});

test("cadenceOf on empty text is well-formed", () => {
  const c = cadenceOf("");
  assert.equal(c.sentences, 0);
  assert.equal(c.mean_abs_delta, 0);
  assert.equal(c.starts_short, false);
  assert.equal(c.ends_short, false);
});

test("buildProfile aggregates cadence across rows and reports transition rates", () => {
  const p = buildProfile([
    row(`${LONG}. Two pages in`), // long→short
    row("a b c d e f. g h i j k l"), // flat
  ]);
  assert.ok(p.cadence, "cadence block present");
  assert.equal(p.cadence.prompts_measured, 2);
  assert.equal(p.cadence.long_then_short.count, 1);
  assert.ok(p.cadence.long_then_short.rate > 0 && p.cadence.long_then_short.rate <= 1);
  assert.ok(typeof p.cadence.mean_abs_delta === "number");
  assert.ok(p.cadence.bucket_share.short + p.cadence.bucket_share.mid + p.cadence.bucket_share.long > 0.99);
});

test("buildProfile cadence ignores single-sentence prompts — no beat to measure", () => {
  const p = buildProfile([row("just one sentence"), row("another lone one")]);
  assert.equal(p.cadence.prompts_measured, 0);
});

test("buildProfile cadence reports the most common 3-beat shape", () => {
  const p = buildProfile([
    row("a b c d e f g h i j k l m n o p. a b c. a b c d e f g h i j"), // long short mid
    row("a b c d e f g h i j k l m n o p. a b c. a b c d e f g h i j"), // long short mid
    row("a b c. a b c d e f g h i j. a b c d e f g h i j k l m n o p"), // short mid long
  ]);
  assert.equal(p.cadence.top_shapes[0].shape, "long short mid");
  assert.equal(p.cadence.top_shapes[0].count, 2);
});

// ---- sentence splitting ----

test("splits on a single period followed by space", () => {
  assert.deepEqual(splitSentences("first one. second one. third"), ["first one", "second one", "third"]);
});

test("treats '..' as a sentence terminator — it is the user's primary one (corpus: 541 vs 488 single periods)", () => {
  assert.deepEqual(splitSentences("no this is not what i wanted.. try again.. plain terms"), [
    "no this is not what i wanted",
    "try again",
    "plain terms",
  ]);
});

test("treats '...' as a terminator too, and does not emit an empty sentence for it", () => {
  assert.deepEqual(splitSentences("hmm... maybe... ok"), ["hmm", "maybe", "ok"]);
});

test("splits on question marks and newlines", () => {
  assert.deepEqual(splitSentences("what is this ?\nis it merged?"), ["what is this", "is it merged"]);
});

test("does not split inside a URL, path, or version number", () => {
  assert.deepEqual(splitSentences("see plugins/sf-learning/src/capture.mjs and v0.2.0 then stop"), [
    "see plugins/sf-learning/src/capture.mjs and v0.2.0 then stop",
  ]);
  assert.deepEqual(splitSentences("open https://example.com/a.b and read"), ["open https://example.com/a.b and read"]);
});

test("returns no empty sentences for trailing punctuation or blank lines", () => {
  assert.deepEqual(splitSentences("done..\n\n"), ["done"]);
  assert.deepEqual(splitSentences(""), []);
  assert.deepEqual(splitSentences("   "), []);
});

test("does not throw on non-string input", () => {
  assert.deepEqual(splitSentences(undefined), []);
  assert.deepEqual(splitSentences(null), []);
});

// ---- per-text features ----

test("counts words and sentences on a simple text", () => {
  const f = extractFeatures("no this is not what i wanted.. try again");
  assert.equal(f.sentences, 2);
  assert.equal(f.words, 9);
  assert.deepEqual(f.sentence_words, [7, 2]);
});

test("records casing habits: lowercase start and lowercase 'i'", () => {
  const f = extractFeatures("i think it works. But I am not sure");
  assert.equal(f.starts_lowercase, true);
  assert.equal(f.lower_i, 1);
  assert.equal(f.upper_i, 1);
});

test("counts the punctuation the user actually leans on", () => {
  const f = extractFeatures("wait.. what? no — that: (this), and; more..");
  assert.equal(f.punct.double_dot, 2);
  assert.equal(f.punct.question, 1);
  assert.equal(f.punct.em_dash, 1);
  assert.equal(f.punct.colon, 1);
  assert.equal(f.punct.paren, 1);
  assert.equal(f.punct.comma, 1);
  assert.equal(f.punct.semicolon, 1);
  assert.equal(f.punct.exclaim, 0);
});

test("counts paragraphs as blank-line-separated blocks", () => {
  const f = extractFeatures("one\n\ntwo\n\n\nthree");
  assert.equal(f.paragraphs, 3);
});

test("does not throw on non-string input", () => {
  const f = extractFeatures(undefined);
  assert.equal(f.words, 0);
  assert.equal(f.sentences, 0);
});

// ---- aggregate profile ----

function row(text, extra = {}) {
  return { provenance: "human", is_slash_command: false, runtime: "claude-code", text, ...extra };
}

test("excludes machine rows, slash commands, and empty text from the profile", () => {
  const p = buildProfile([
    row("this counts. two sentences here"),
    row("<task>machine</task>", { provenance: "machine", text: "" }),
    row("/code-review", { is_slash_command: true }),
    row("", {}),
  ]);
  assert.equal(p.rows_used, 1);
  assert.equal(p.rows_seen, 4);
});

test("uses wrapped rows — the extracted human text is the user's", () => {
  const p = buildProfile([row("okay go ahead", { provenance: "wrapped", wrapper: "in-app-browser-context" })]);
  assert.equal(p.rows_used, 1);
});

test("computes sentence-length distribution: median, p90, mean, and spread", () => {
  const p = buildProfile([
    row("a b c. d e f g h i j k l m. n o"), // 3, 10, 2 words
    row("p q r s t"), // 5
  ]);
  // sentence word counts: 3, 10, 2, 5 -> sorted 2,3,5,10
  assert.equal(p.sentence_words.count, 4);
  assert.equal(p.sentence_words.median, 4); // (3+5)/2
  assert.equal(p.sentence_words.mean, 5);
  assert.equal(p.sentence_words.min, 2);
  assert.equal(p.sentence_words.max, 10);
  assert.ok(p.sentence_words.stddev > 0);
});

test("computes prompt-length distribution in words", () => {
  const p = buildProfile([row("one two three"), row("four"), row("five six seven eight nine")]);
  assert.equal(p.prompt_words.median, 3);
  assert.equal(p.prompt_words.min, 1);
  assert.equal(p.prompt_words.max, 5);
});

test("computes casing ratios", () => {
  const p = buildProfile([row("lower start"), row("lower again"), row("Upper start"), row("i and I")]);
  assert.equal(p.casing.starts_lowercase_ratio, 0.75);
  assert.equal(p.casing.lower_i, 1);
  assert.equal(p.casing.upper_i, 1);
});

test("computes punctuation per 1000 words so it is comparable across corpora", () => {
  // 10 words, 2 double-dots -> 200 per 1000 words
  const p = buildProfile([row("a b c d e.. f g h i j..")]);
  assert.equal(p.punct_per_1k_words.double_dot, 200);
});

test("ranks the terminator the user actually uses most", () => {
  const p = buildProfile([row("a.. b.. c.. d. e?")]);
  assert.equal(p.terminators.top, "double_dot");
});

test("reports vocabulary: distinct words, type-token ratio, and top words excluding stopwords", () => {
  const p = buildProfile([row("the cadence cadence cadence is the thing and the flow flow")]);
  assert.equal(p.vocabulary.top[0].word, "cadence");
  assert.equal(p.vocabulary.top[0].count, 3);
  assert.equal(p.vocabulary.top[1].word, "flow");
  assert.ok(!p.vocabulary.top.find((w) => w.word === "the"), "stopwords excluded from top list");
  assert.ok(p.vocabulary.type_token_ratio > 0 && p.vocabulary.type_token_ratio <= 1);
});

test("splits by runtime so voice can be compared across harnesses", () => {
  const p = buildProfile([row("claude one two", { runtime: "claude-code" }), row("codex one", { runtime: "codex" })]);
  assert.equal(p.by_runtime["claude-code"].rows, 1);
  assert.equal(p.by_runtime.codex.rows, 1);
});

test("stamps a profile version and generation metadata", () => {
  const p = buildProfile([row("x")], { now: new Date("2026-08-18T10:00:00Z") });
  assert.equal(p.profile_version, PROFILE_VERSION);
  assert.equal(p.generated_at, "2026-08-18T10:00:00.000Z");
});

test("an empty corpus yields a well-formed profile with zero counts, not a crash", () => {
  const p = buildProfile([]);
  assert.equal(p.rows_used, 0);
  assert.equal(p.sentence_words.count, 0);
  assert.equal(p.sentence_words.median, 0);
});
