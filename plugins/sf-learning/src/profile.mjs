// Stream 1: the style profile.
//
// The bookkeeping a production style system should
// keep — sentence-length spread, punctuation habits, casing, vocabulary,
// paragraph size — computed from the user's own prompts. Every number is a
// count or a ratio. No model, no judgment, nothing to approve: it is a
// description of how the user writes, and next month's corpus corrects this
// month's.
//
// It is NOT a rule set. Nothing here edits a skill. The profile is data that
// any skills that write in the user's voice can be handed at
// runtime. It must not be fed to cognitive-render or explaining-with-html —
// those optimise for a reader understanding, and a profile of "lowercase
// fragments, low tolerance for polish" would push them toward mimicry.
//
// Tokenizer decisions are grounded in the real corpus, not assumed:
//   - ".." is the user's PRIMARY sentence terminator (541 uses vs 488 single
//     periods in the first two weeks). It is a split point, not noise.
//   - 72% of prompts start lowercase; "i" outnumbers "I" ~4:1. Casing is a
//     voice fact worth reporting, not an error to correct.
//   - Em dashes in the corpus are almost certainly text the user pasted back
//     from an agent, not typed. The profile reports the count; the consumer
//     should not read it as the user's habit. That caveat is in the README.

export const PROFILE_VERSION = 2;

// Sentence terminators: "..", "...", ".", "?", "!", and newlines. A period is
// only a terminator when followed by whitespace or end-of-text, so URLs,
// paths, and version numbers ("v0.2.0", "capture.mjs") stay intact.
const TERMINATOR = /(?:\.{2,}|[.?!])(?=\s|$)|\n+/g;

const WORD = /[A-Za-z0-9][A-Za-z0-9'’_-]*/g;

// Function words excluded from the "top words" list so it surfaces the
// user's actual vocabulary rather than the English language.
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "so", "to", "of", "in", "on", "at", "by", "for",
  "with", "as", "is", "are", "was", "were", "be", "been", "being", "it", "its", "this", "that",
  "these", "those", "i", "you", "we", "they", "he", "she", "me", "my", "your", "our", "us",
  "them", "their", "do", "does", "did", "dont", "don't", "not", "no", "yes", "can", "could",
  "should", "would", "will", "have", "has", "had", "what", "which", "who", "how", "when", "where",
  "why", "there", "here", "then", "than", "also", "just", "into", "from", "up", "out", "about",
  "all", "any", "some", "more", "one", "now", "get", "go", "ok", "okay", "like", "make", "need",
  "want", "im", "i'm", "its", "it's", "thats", "that's", "s", "t", "u", "r",
]);

export function splitSentences(text) {
  if (typeof text !== "string") {
    return [];
  }
  return text
    .split(TERMINATOR)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function countWords(text) {
  return (text.match(WORD) || []).length;
}

function words(text) {
  return (text.match(WORD) || []).map((w) => w.toLowerCase());
}

// Per-text features. Pure.
export function extractFeatures(text) {
  const t = typeof text === "string" ? text : "";
  const sentences = splitSentences(t);
  const sentenceWords = sentences.map(countWords).filter((n) => n > 0);
  const paragraphs = t.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length > 0).length;
  const count = (rx) => (t.match(rx) || []).length;

  return {
    chars: t.length,
    words: countWords(t),
    sentences: sentenceWords.length,
    sentence_words: sentenceWords,
    paragraphs,
    starts_lowercase: /^\s*[a-z]/.test(t),
    lower_i: count(/\bi\b/g),
    upper_i: count(/\bI\b/g),
    punct: {
      double_dot: count(/\.\.(?!\.)/g),
      ellipsis: count(/\.\.\./g),
      period: count(/(?<!\.)\.(?!\.)(?=\s|$)/g),
      question: count(/\?/g),
      exclaim: count(/!/g),
      comma: count(/,/g),
      semicolon: count(/;/g),
      colon: count(/:/g),
      em_dash: count(/—/g),
      spaced_hyphen: count(/ - /g),
      paren: count(/\(/g),
    },
  };
}

// ---- cadence ----
//
// Cadence is where a writer pauses, speeds up and lands hard — the BEAT of
// consecutive sentences, not their average. Two texts with identical
// sentence-length spread can read in opposite ways ("long long short" vs
// "short long short"). So cadence is measured on the sequence.
//
// Measured over PROSE RUNS only. The corpus is full of numbered lists,
// bullets, pasted logs and paths; those produce "1 1 1 1" sentence runs that
// are not writing and would bury the signal. A run is a maximal stretch of
// consecutive prose lines; a list item, bullet, code-ish line, or bare
// URL/path breaks the run.
//
// Buckets: short <= 5 words, mid 6–14, long >= 15. Chosen from the corpus,
// where the sentence median is 8 and p90 is 22.

const SHORT_MAX = 5;
const LONG_MIN = 15;

const NON_PROSE_LINE = /^\s*(?:[-*•]\s|\d+[.)]\s|#{1,6}\s|```|[|>]|https?:\/\/\S+\s*$|[A-Za-z]:[\\/]\S+\s*$|\/\S+\s*$|[{}[\]]|\$\s|>>>)/;

function bucket(n) {
  if (n <= SHORT_MAX) {
    return "short";
  }
  if (n >= LONG_MIN) {
    return "long";
  }
  return "mid";
}

// Split text into runs of consecutive prose sentences.
export function proseRuns(text) {
  if (typeof text !== "string" || text.trim().length === 0) {
    return [];
  }
  const runs = [];
  let current = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || NON_PROSE_LINE.test(line)) {
      if (current.length > 0) {
        runs.push(current);
        current = [];
      }
      continue;
    }
    for (const s of splitSentences(trimmed)) {
      if (countWords(s) > 0) {
        current.push(s);
      }
    }
  }
  if (current.length > 0) {
    runs.push(current);
  }
  return runs;
}

// Cadence features for one text. Pure.
export function cadenceOf(text) {
  const t = typeof text === "string" ? text : "";
  const runs = proseRuns(t);
  const lengths = runs.flat().map(countWords);
  const buckets = lengths.map(bucket);

  let longThenShort = 0;
  let shortThenLong = 0;
  let deltaSum = 0;
  let maxRun = lengths.length > 0 ? 1 : 0;
  let run = 1;
  for (let i = 1; i < lengths.length; i++) {
    deltaSum += Math.abs(lengths[i] - lengths[i - 1]);
    if (lengths[i - 1] >= LONG_MIN && lengths[i] <= SHORT_MAX) {
      longThenShort++;
    }
    if (lengths[i - 1] <= SHORT_MAX && lengths[i] >= LONG_MIN) {
      shortThenLong++;
    }
    if (buckets[i] === buckets[i - 1]) {
      run++;
      maxRun = Math.max(maxRun, run);
    } else {
      run = 1;
    }
  }

  // ".." followed by more text is a pause mid-thought; at the end it is a stop.
  const pauseMarks = (t.match(/\.\.(?!\.)(?=\s+\S)/g) || []).length;

  return {
    sentences: lengths.length,
    lengths,
    buckets,
    mean_abs_delta: lengths.length > 1 ? round(deltaSum / (lengths.length - 1)) : 0,
    long_then_short: longThenShort,
    short_then_long: shortThenLong,
    max_run_same_bucket: maxRun,
    starts_short: lengths.length > 0 && lengths[0] <= SHORT_MAX,
    ends_short: lengths.length > 0 && lengths[lengths.length - 1] <= SHORT_MAX,
    pause_marks: pauseMarks,
  };
}

function aggregateCadence(rows) {
  const measured = rows.map((r) => cadenceOf(r.text)).filter((c) => c.sentences >= 2);
  const transitions = measured.reduce((a, c) => a + Math.max(0, c.sentences - 1), 0);
  const allBuckets = measured.flatMap((c) => c.buckets);
  const bucketCount = { short: 0, mid: 0, long: 0 };
  for (const b of allBuckets) {
    bucketCount[b]++;
  }
  const total = allBuckets.length || 1;

  const shapes = new Map();
  for (const c of measured) {
    for (let i = 0; i + 2 < c.buckets.length; i++) {
      const key = `${c.buckets[i]} ${c.buckets[i + 1]} ${c.buckets[i + 2]}`;
      shapes.set(key, (shapes.get(key) || 0) + 1);
    }
  }
  const topShapes = [...shapes.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([shape, count]) => ({ shape, count }));

  const rate = (n) => (transitions === 0 ? 0 : round(n / transitions));
  const sumLTS = measured.reduce((a, c) => a + c.long_then_short, 0);
  const sumSTL = measured.reduce((a, c) => a + c.short_then_long, 0);
  const deltas = measured.map((c) => c.mean_abs_delta);

  return {
    prompts_measured: measured.length,
    transitions,
    mean_abs_delta: deltas.length ? round(deltas.reduce((a, b) => a + b, 0) / deltas.length) : 0,
    long_then_short: { count: sumLTS, rate: rate(sumLTS) },
    short_then_long: { count: sumSTL, rate: rate(sumSTL) },
    bucket_share: {
      short: round(bucketCount.short / total),
      mid: round(bucketCount.mid / total),
      long: round(bucketCount.long / total),
    },
    starts_short_ratio: measured.length ? round(measured.filter((c) => c.starts_short).length / measured.length) : 0,
    ends_short_ratio: measured.length ? round(measured.filter((c) => c.ends_short).length / measured.length) : 0,
    max_run_same_bucket: stats(measured.map((c) => c.max_run_same_bucket)),
    pause_marks_per_prompt: measured.length ? round(measured.reduce((a, c) => a + c.pause_marks, 0) / measured.length) : 0,
    top_shapes: topShapes,
  };
}

function stats(values) {
  if (values.length === 0) {
    return { count: 0, min: 0, max: 0, mean: 0, median: 0, p90: 0, stddev: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
  const median = n % 2 === 1 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const p90 = sorted[Math.min(n - 1, Math.floor(n * 0.9))];
  const variance = sorted.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  return {
    count: n,
    min: sorted[0],
    max: sorted[n - 1],
    mean: round(mean),
    median: round(median),
    p90,
    stddev: round(Math.sqrt(variance)),
  };
}

function round(x) {
  return Math.round(x * 100) / 100;
}

function usable(row) {
  return (
    row &&
    row.provenance !== "machine" &&
    row.is_slash_command !== true &&
    typeof row.text === "string" &&
    row.text.trim().length > 0
  );
}

function aggregate(rows) {
  const feats = rows.map((r) => extractFeatures(r.text));
  const sentenceWords = feats.flatMap((f) => f.sentence_words);
  const promptWords = feats.map((f) => f.words);
  const paragraphs = feats.map((f) => f.paragraphs);
  const totalWords = promptWords.reduce((a, b) => a + b, 0);

  const punct = {};
  for (const f of feats) {
    for (const [k, v] of Object.entries(f.punct)) {
      punct[k] = (punct[k] || 0) + v;
    }
  }
  const per1k = {};
  for (const [k, v] of Object.entries(punct)) {
    per1k[k] = totalWords === 0 ? 0 : round((v / totalWords) * 1000);
  }

  const terminatorCounts = {
    double_dot: punct.double_dot || 0,
    period: punct.period || 0,
    question: punct.question || 0,
    ellipsis: punct.ellipsis || 0,
    exclaim: punct.exclaim || 0,
  };
  const top = Object.entries(terminatorCounts).sort((a, b) => b[1] - a[1])[0];

  const freq = new Map();
  let tokenCount = 0;
  for (const r of rows) {
    for (const w of words(r.text)) {
      tokenCount++;
      freq.set(w, (freq.get(w) || 0) + 1);
    }
  }
  const topWords = [...freq.entries()]
    .filter(([w]) => !STOPWORDS.has(w) && w.length > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([word, count]) => ({ word, count }));

  const lowerStarts = feats.filter((f) => f.starts_lowercase).length;

  return {
    rows: rows.length,
    total_words: totalWords,
    sentence_words: stats(sentenceWords),
    prompt_words: stats(promptWords),
    paragraphs_per_prompt: stats(paragraphs),
    casing: {
      starts_lowercase_ratio: rows.length === 0 ? 0 : round(lowerStarts / rows.length),
      lower_i: feats.reduce((a, f) => a + f.lower_i, 0),
      upper_i: feats.reduce((a, f) => a + f.upper_i, 0),
    },
    punct_counts: punct,
    punct_per_1k_words: per1k,
    terminators: { counts: terminatorCounts, top: top ? top[0] : null },
    vocabulary: {
      tokens: tokenCount,
      distinct: freq.size,
      type_token_ratio: tokenCount === 0 ? 0 : round(freq.size / tokenCount),
      top: topWords,
    },
    cadence: aggregateCadence(rows),
  };
}

// Build the profile from corpus rows. Pure apart from `now`.
export function buildProfile(rows, { now = new Date() } = {}) {
  const seen = Array.isArray(rows) ? rows : [];
  const used = seen.filter(usable);

  const byRuntime = {};
  for (const r of used) {
    const key = r.runtime || "unknown";
    (byRuntime[key] ||= []).push(r);
  }

  const overall = aggregate(used);
  const perRuntime = {};
  for (const [rt, rs] of Object.entries(byRuntime)) {
    perRuntime[rt] = aggregate(rs);
  }

  return {
    profile_version: PROFILE_VERSION,
    generated_at: now.toISOString(),
    rows_seen: seen.length,
    rows_used: used.length,
    ...overall,
    by_runtime: perRuntime,
  };
}
