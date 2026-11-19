// CLI: print the next batch of captured rows for the model to judge.
//
//   node plugins/sf-learning/scripts/process-batch.mjs
//   node plugins/sf-learning/scripts/process-batch.mjs --size 20
//   node plugins/sf-learning/scripts/process-batch.mjs --repo <path>
//
// Prints one JSON object: the rows since the watermark, each with the assistant
// reply that preceded it, and the observations already open for the two target
// skills so a repeat can be matched to the rule it repeats.
//
// This script does no judging. It reads and prints; the model decides; then
// process-record.mjs writes. Keeping those apart is what makes the pass
// testable without a model in the loop.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { learningHome } from "../src/paths.mjs";
import { DEFAULT_BATCH_SIZE, isUsableRow, nextBatch, openObservationsForModel, rowForModel } from "../src/process.mjs";
import { observationsPath, readJsonl, readState, statePath, watermarkFor } from "../src/processStore.mjs";

function parseArgs(argv) {
  const args = argv.slice(2);
  const valueFor = (name) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  return {
    size: Number.parseInt(valueFor("--size") ?? "", 10) || DEFAULT_BATCH_SIZE,
    repo: valueFor("--repo") ?? process.cwd(),
    corpusDir: valueFor("--corpus") ?? path.join(learningHome(), "corpus"),
    home: valueFor("--home") ?? learningHome(),
  };
}

export function buildBatch(options) {
  const corpusFiles = fs.existsSync(options.corpusDir)
    ? fs.readdirSync(options.corpusDir).filter((n) => n.endsWith(".jsonl")).sort()
    : [];
  const state = readState(statePath(options.home));

  for (const name of corpusFiles) {
    const rows = readJsonl(path.join(options.corpusDir, name));
    const watermark = watermarkFor(state, name);
    const batch = nextBatch(rows, watermark, options.size);
    if (batch.length === 0) {
      continue;
    }
    const month = name.replace(/\.jsonl$/, "");
    const observations = readJsonl(observationsPath(options.repo, month));
    const remaining = rows.filter(
      (row) => isUsableRow(row) && typeof row.ts === "string" && (!watermark || row.ts > watermark)
    ).length;
    return {
      corpus_file: name,
      month,
      watermark,
      batch_size: batch.length,
      rows_remaining_after_this_batch: Math.max(0, remaining - batch.length),
      last_ts_in_batch: batch[batch.length - 1].ts,
      open_observations: openObservationsForModel(observations),
      rows: batch.map(rowForModel),
    };
  }

  return { corpus_file: null, rows: [], batch_size: 0, rows_remaining_after_this_batch: 0 };
}

// realpath on both sides, so a run through a junction, symlink or differently cased drive still starts.
const invokedAs = process.argv[1] ? pathToFileURL(fs.realpathSync(process.argv[1])).href : "";
if (invokedAs === pathToFileURL(fs.realpathSync(new URL(import.meta.url))).href) {
  const options = parseArgs(process.argv);
  process.stdout.write(`${JSON.stringify(buildBatch(options), null, 2)}\n`);
}
