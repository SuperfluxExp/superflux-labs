// CLI: record the model's judgements for one batch.
//
//   node plugins/sf-learning/scripts/process-record.mjs --input judgements.json
//   node plugins/sf-learning/scripts/process-record.mjs --input j.json --check
//
// Input is JSON: { corpus_file, month, last_ts_in_batch, batch, model,
//                  judgements: [ { ts, about_writing, skill, verdict, ... } ] }
//
// Every judgement is validated against the row it cites before anything is
// written: the quoted prompt must really appear in that row, and the rule text
// must not be a verbatim span of it. A batch with any rejection writes NOTHING
// and reports what to fix — a half-recorded batch with the watermark advanced
// would silently lose rows.
//
// `--check` validates and reports without writing, which is what the command
// uses on its first pass.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { learningHome } from "../src/paths.mjs";
import { applyBatch, exampleWarning, occurrencesOf, readyToPropose } from "../src/process.mjs";
import {
  advanceWatermark,
  appendRunLog,
  observationsPath,
  readJsonl,
  readState,
  runLogPath,
  statePath,
  writeObservations,
  writeState,
} from "../src/processStore.mjs";

function parseArgs(argv) {
  const args = argv.slice(2);
  const valueFor = (name) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  return {
    input: valueFor("--input"),
    repo: valueFor("--repo") ?? process.cwd(),
    corpusDir: valueFor("--corpus") ?? path.join(learningHome(), "corpus"),
    home: valueFor("--home") ?? learningHome(),
    check: args.includes("--check"),
  };
}

export function recordBatch(payload, options) {
  const corpusFile = path.join(options.corpusDir, payload.corpus_file);
  const rows = readJsonl(corpusFile);
  const rowsByTs = new Map(rows.map((row) => [row.ts, row]));
  const ledger = observationsPath(options.repo, payload.month);
  const existing = readJsonl(ledger);

  const { observations, report, rejected } = applyBatch(existing, payload.judgements ?? [], rowsByTs, {
    month: payload.month,
    now: new Date().toISOString(),
    batch: payload.batch ?? `batch-${payload.month}-${payload.last_ts_in_batch}`,
    model: payload.model ?? "unknown",
  });

  if (rejected.length > 0 || options.check) {
    return { written: false, ledger, report, rejected, observations };
  }

  writeObservations(ledger, observations);

  const state = readState(statePath(options.home));
  writeState(
    statePath(options.home),
    advanceWatermark(state, payload.corpus_file, payload.last_ts_in_batch, payload.batch ?? null)
  );
  appendRunLog(runLogPath(options.home), {
    at: new Date().toISOString(),
    corpus_file: payload.corpus_file,
    batch: payload.batch ?? null,
    model: payload.model ?? "unknown",
    last_ts: payload.last_ts_in_batch,
    counts: {
      read: report.read,
      new: report.new,
      refine: report.refine,
      example: report.example,
      drop: report.drop,
      merged: report.merged,
      contradictions: report.contradictions,
      drop_reasons: report.dropReasons,
    },
  });

  return { written: true, ledger, report, rejected, observations };
}

function printReport(result) {
  const { report } = result;
  const out = [];
  out.push(result.written ? `recorded to ${result.ledger}` : "NOTHING WRITTEN");
  out.push(
    `  judged ${report.read}: new ${report.new}, refine ${report.refine}, example ${report.example}, drop ${report.drop}`
  );
  out.push(`  folded into an existing observation: ${report.merged}`);
  if (Object.keys(report.dropReasons).length > 0) {
    out.push(`  drops by reason: ${Object.entries(report.dropReasons).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  }
  if (report.contradictions > 0) {
    out.push(`  contradictions raised: ${report.contradictions} (these surface now, whatever the count)`);
  }
  const warning = exampleWarning(report);
  if (warning) {
    out.push(`  WARNING: ${warning}`);
  }
  if (report.readyToPropose.length > 0) {
    out.push(`  ready to propose (seen in 2+ sessions): ${report.readyToPropose.join(", ")}`);
  } else {
    out.push("  ready to propose: none yet");
  }
  for (const rejection of result.rejected) {
    out.push(`  REJECTED ${rejection.judgement?.ts ?? "?"}:`);
    for (const error of rejection.errors) {
      out.push(`    - ${error}`);
    }
  }
  return out.join("\n");
}

// realpath on both sides, so a run through a junction, symlink or differently cased drive still starts.
const invokedAs = process.argv[1] ? pathToFileURL(fs.realpathSync(process.argv[1])).href : "";
if (invokedAs === pathToFileURL(fs.realpathSync(new URL(import.meta.url))).href) {
  const options = parseArgs(process.argv);
  if (!options.input) {
    process.stderr.write("Usage: process-record.mjs --input <judgements.json> [--check] [--repo <path>]\n");
    process.exitCode = 2;
  } else {
    const payload = JSON.parse(fs.readFileSync(options.input, "utf8"));
    const result = recordBatch(payload, options);
    process.stdout.write(`${printReport(result)}\n`);
    if (result.rejected.length > 0) {
      process.exitCode = 1;
    }
  }
}

export { printReport };
