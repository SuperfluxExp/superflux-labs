// Where the process pass keeps things, and the difference between the two.
//
//   The observations ledger lives IN THE REPO. It is short, extracted, and the
//   point is that a human can read a run as a diff.
//
//   The run state and the run log live beside the corpus, OUTSIDE the repo,
//   because they describe this machine: how far the pass got, when it last
//   nagged, and what each run cost.
//
// Drops are counted per run rather than stored per row. The spec first said a
// drop is "recorded so yield stays measurable", and most captured rows are
// drops — a build brief, a question about a ticket, a paste from Sentry. Five
// hundred records of nothing-to-act-on would drown the ledger the reviewability
// argument rests on. The run log keeps the yield measurable without that.

import fs from "node:fs";
import path from "node:path";

import { learningHome } from "./paths.mjs";

export const STATE_VERSION = 1;

export function statePath(home = learningHome()) {
  return path.join(home, "process-state.json");
}

export function runLogPath(home = learningHome()) {
  return path.join(home, "process-runs.jsonl");
}

// The observations ledger, inside the repository.
export function observationsPath(repoRoot, month) {
  return path.join(repoRoot, "docs", "learning", "observations", `${month}.jsonl`);
}

export function readState(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return {
      version: parsed.version ?? STATE_VERSION,
      files: parsed.files ?? {},
      last_reminder_at: parsed.last_reminder_at ?? null,
      last_run: parsed.last_run ?? null,
    };
  } catch {
    return { version: STATE_VERSION, files: {}, last_reminder_at: null, last_run: null };
  }
}

export function writeState(file, state) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, `${JSON.stringify({ ...state, version: STATE_VERSION }, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, file);
}

export function watermarkFor(state, corpusFile) {
  return state.files?.[corpusFile]?.last_ts ?? null;
}

// The watermark moves ONLY for a batch that was recorded successfully. A failed
// batch is read again next time; re-reading rows is cheap, losing them is not.
export function advanceWatermark(state, corpusFile, lastTs, batchId) {
  return {
    ...state,
    files: {
      ...state.files,
      [corpusFile]: { last_ts: lastTs, last_batch: batchId },
    },
  };
}

export function readJsonl(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    return [];
  }
  const out = [];
  for (const line of raw.split("\n")) {
    if (line.trim().length === 0) {
      continue;
    }
    try {
      out.push(JSON.parse(line));
    } catch {
      // A malformed line in the ledger is a bug worth seeing, not worth
      // crashing the pass over; it is skipped and the file keeps it.
    }
  }
  return out;
}

export function writeObservations(file, observations) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, observations.map((o) => JSON.stringify(o)).join("\n") + (observations.length ? "\n" : ""), "utf8");
  fs.renameSync(tmp, file);
}

export function appendRunLog(file, entry) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(entry)}\n`, "utf8");
}
