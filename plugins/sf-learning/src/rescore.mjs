// Re-score existing corpus rows with the current classifier and provenance.
//
// Why this exists: the classifier will keep improving, and every improvement
// makes older rows wrong. Rather than a corpus with mixed semantics, `clf`
// marks each row's classifier version and this pass brings old rows up to date
// in place. It is the reason CLASSIFIER_VERSION is stored on every row.
//
// Safety:
//   - never writes to the file it is reading: builds the new content in memory,
//     writes a sibling .bak of the original once (never overwritten if present),
//     then replaces the corpus file atomically via rename
//   - idempotent: a row already at the current clf is passed through unchanged
//   - a malformed line is preserved verbatim, counted, and never dropped
//   - throws on any IO failure — this is a maintenance command, not the hook,
//     so fail-fast is correct here
//
// v1 → v2 field notes:
//   v1 rows have `text` = the whole (redacted, truncated) payload and no
//   `provenance`, `wrapper`, `raw_chars`, or `is_comprehension`. Re-scoring
//   runs provenance over the stored text — which for a truncated wrapper may
//   have lost its closing tag, in which case the row becomes `machine`. That is
//   the honest outcome: the human prompt was never captured. `raw_chars` on a
//   v1 row is set from the old `chars` (the payload length), which is the best
//   evidence available.

import fs from "node:fs";
import path from "node:path";

import { CLASSIFIER_VERSION, isComprehension, isCorrection, isSlashCommand } from "./classify.mjs";
import { classifyProvenance } from "./provenance.mjs";

const MAX_TEXT = 4000;

// Pure. Returns the rescored row, or the same object if already current.
//
// Provenance is derived ONCE, from the raw payload, and then preserved. A v1
// row stores the whole payload in `text`, so provenance can be derived from
// it. A v2+ row stores the already-EXTRACTED human text — a former machine row
// has text "" — and running classifyProvenance over that would relabel every
// machine row as human (an empty string is not an angle-bracket block). That
// happened once, on 2026-08-18, and turned 127 machine + 121 wrapped rows into
// "human" before it was caught. So: if the row already carries provenance,
// keep it and its text; only re-run the classifiers.
export function rescoreRow(row) {
  if (row.clf === CLASSIFIER_VERSION) {
    return row;
  }

  const hasProvenance = typeof row.provenance === "string";
  let provenance;
  let wrapper;
  let extracted;
  if (hasProvenance) {
    provenance = row.provenance;
    wrapper = row.wrapper ?? null;
    extracted = typeof row.text === "string" ? row.text : "";
  } else {
    const source = typeof row.text === "string" ? row.text : "";
    ({ provenance, text: extracted, wrapper } = classifyProvenance(source));
  }

  const truncated = extracted.length > MAX_TEXT;
  const text = truncated ? extracted.slice(0, MAX_TEXT) : extracted;
  return {
    ts: row.ts,
    runtime: row.runtime,
    session: row.session ?? null,
    cwd: row.cwd ?? null,
    provenance,
    wrapper,
    chars: hasProvenance && typeof row.chars === "number" ? row.chars : extracted.length,
    raw_chars: typeof row.raw_chars === "number" ? row.raw_chars : row.chars,
    // A row that was truncated at capture stays flagged: we cannot recover
    // what was cut, and pretending otherwise would misreport the corpus.
    truncated: truncated || row.truncated === true,
    is_correction: isCorrection(text),
    is_comprehension: isComprehension(text),
    is_slash_command: isSlashCommand(text),
    clf: CLASSIFIER_VERSION,
    text,
    // Preserve reply context if a later capture version attached it.
    ...(row.reply !== undefined ? { reply: row.reply } : {}),
  };
}

// ---------------------------------------------------------------------------
// The distribution guard.
//
// On 2026-08-18 a rescore relabelled 127 machine and 121 wrapped rows as human
// in one pass, and the summary line still read as a success because the run
// "completed". The bug is fixed and pinned by tests. This guard is the second
// line: it does not care WHY the numbers moved, only that a maintenance command
// that rewrites the whole ledger should refuse when it changes the ledger's
// character, and say so before writing anything.
//
// It compares like with like. A v1 row has no provenance and no
// is_comprehension, so a v1 -> v2 migration is not a "shift" — there was
// nothing to shift from. Only rows that already carried a field are compared,
// matched by position, which is exactly the pairing rescoring preserves.

// Two thresholds, because the two dimensions mean different things.
//
// Provenance is DERIVED ONCE and preserved, so it should barely move at all;
// a 5-point swing there is the signature of the 2026-08-18 corruption.
//
// The classifier flags are SUPPOSED to move — improving them is the whole
// reason a rescore exists. The real v2 -> v3 upgrade moved is_correction by
// well under a point on 892 rows. A threshold of 5 there would make every
// deliberate classifier bump need an override flag, and a guard that is
// routinely overridden stops being a guard. 15 points still catches a run that
// flips half the corpus.
export const DEFAULT_MAX_PROVENANCE_POINTS = 5;
export const DEFAULT_MAX_FLAG_POINTS = 15;

// Below this many comparable rows, one row moving is worth more than the whole
// threshold and the guard is noise. Skipping is REPORTED, never silent — a
// silent skip is how a guard becomes decoration.
export const MIN_ROWS_FOR_GUARD = 20;

const PROVENANCE_BUCKETS = ["human", "wrapped", "machine"];
const FLAG_BUCKETS = ["is_correction", "is_comprehension", "is_slash_command"];

export class DistributionShiftError extends Error {
  constructor(message, detail) {
    super(message);
    this.name = "DistributionShiftError";
    this.detail = detail;
  }
}

// Count each bucket over `rows`. Pure.
export function distributionOf(rows) {
  const provenance = { human: 0, wrapped: 0, machine: 0 };
  const flags = { is_correction: 0, is_comprehension: 0, is_slash_command: 0 };
  for (const row of rows) {
    if (typeof row?.provenance === "string" && row.provenance in provenance) {
      provenance[row.provenance]++;
    }
    for (const flag of FLAG_BUCKETS) {
      if (row?.[flag] === true) {
        flags[flag]++;
      }
    }
  }
  return { total: rows.length, provenance, flags };
}

function percent(count, total) {
  return total === 0 ? 0 : (count / total) * 100;
}

// Which buckets moved, and by how many percentage points. Pure.
export function shiftReport(before, after) {
  const moves = [];
  for (const bucket of PROVENANCE_BUCKETS) {
    moves.push({
      bucket: `provenance.${bucket}`,
      before: before.provenance[bucket],
      after: after.provenance[bucket],
      points: Math.abs(percent(after.provenance[bucket], after.total) - percent(before.provenance[bucket], before.total)),
    });
  }
  for (const bucket of FLAG_BUCKETS) {
    moves.push({
      bucket,
      before: before.flags[bucket],
      after: after.flags[bucket],
      points: Math.abs(percent(after.flags[bucket], after.total) - percent(before.flags[bucket], before.total)),
    });
  }
  return moves.sort((a, b) => b.points - a.points);
}

function formatDistribution(label, dist) {
  const p = dist.provenance;
  const f = dist.flags;
  const pct = (n) => `${percent(n, dist.total).toFixed(1)}%`;
  return (
    `${label}: human ${p.human} (${pct(p.human)}), wrapped ${p.wrapped} (${pct(p.wrapped)}), machine ${p.machine} (${pct(p.machine)})` +
    ` | corrections ${f.is_correction} (${pct(f.is_correction)}), comprehension ${f.is_comprehension} (${pct(f.is_comprehension)})`
  );
}

// Throws DistributionShiftError when any bucket moved more than maxPoints.
// Returns the guard result otherwise, including the skip case.
export function assertDistributionStable(before, after, options = {}) {
  const maxProvenance = options.maxProvenancePoints ?? DEFAULT_MAX_PROVENANCE_POINTS;
  const maxFlag = options.maxFlagPoints ?? DEFAULT_MAX_FLAG_POINTS;
  const minRows = options.minRows ?? MIN_ROWS_FOR_GUARD;
  if (before.total < minRows) {
    return { checked: false, reason: "small-sample", comparedRows: before.total, moves: [] };
  }
  const moves = shiftReport(before, after);
  const limitFor = (bucket) => (bucket.startsWith("provenance.") ? maxProvenance : maxFlag);
  const breach = moves.find((move) => move.points > limitFor(move.bucket));
  if (breach) {
    const message =
      `rescore aborted: ${breach.bucket} moved ${breach.points.toFixed(1)} points, ` +
      `past its ${limitFor(breach.bucket)}-point limit ` +
      `(${breach.before} -> ${breach.after} of ${before.total} comparable rows)\n` +
      `${formatDistribution("before", before)}\n` +
      `${formatDistribution("after ", after)}\n` +
      "Nothing was written. Re-run with --allow-distribution-shift if this change is intended.";
    throw new DistributionShiftError(message, { worst: breach, moves, before, after });
  }
  return { checked: true, comparedRows: before.total, moves };
}

// Rescore one JSONL file in place. Returns counts.
//
// `rescore` is injectable so the guard can be tested end to end without
// reintroducing the bug it exists to catch. Production callers use the default.
export function rescoreFile(file, options = {}) {
  const rescore = options.rescore ?? rescoreRow;
  const original = fs.readFileSync(file, "utf8");
  const lines = original.split("\n");
  const counts = { total: 0, rescored: 0, unchanged: 0, malformed: 0, provenance: { human: 0, wrapped: 0, machine: 0 } };
  const out = [];
  // Only rows that already carried a provenance are comparable; a v1 row has
  // nothing to compare against and would otherwise read as a 100-point move.
  const comparableBefore = [];
  const comparableAfter = [];

  for (const line of lines) {
    if (line.trim().length === 0) {
      continue;
    }
    counts.total++;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      counts.malformed++;
      out.push(line);
      continue;
    }
    const next = rescore(row);
    if (next === row) {
      counts.unchanged++;
    } else {
      counts.rescored++;
    }
    if (next.provenance in counts.provenance) {
      counts.provenance[next.provenance]++;
    }
    if (typeof row.provenance === "string") {
      comparableBefore.push(row);
      comparableAfter.push(next);
    }
    out.push(JSON.stringify(next));
  }

  const before = distributionOf(comparableBefore);
  const after = distributionOf(comparableAfter);
  const guard = options.allowDistributionShift
    ? { checked: false, reason: "override", comparedRows: before.total, moves: shiftReport(before, after) }
    : assertDistributionStable(before, after, options);

  const backup = `${file}.bak`;
  if (!fs.existsSync(backup)) {
    fs.writeFileSync(backup, original, "utf8");
  }
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, `${out.join("\n")}\n`, "utf8");
  fs.renameSync(tmp, file);
  return { file, backup, ...counts, guard, distribution: { before, after } };
}

// Rescore every *.jsonl under a corpus directory.
//
// Fails fast: if one file trips the guard, the files after it are not touched.
// A half-rescored corpus with one file rejected is easier to reason about than
// a corpus where the command carried on past a rejection.
export function rescoreCorpus(corpusDir, options = {}) {
  const files = fs
    .readdirSync(corpusDir)
    .filter((name) => name.endsWith(".jsonl"))
    .map((name) => path.join(corpusDir, name));
  return files.map((file) => rescoreFile(file, options));
}
