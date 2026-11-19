// CLI: attach the assistant's reply to rows captured before reply capture existed.
//
//   node plugins/sf-learning/scripts/backfill-reply.mjs --dry-run
//   node plugins/sf-learning/scripts/backfill-reply.mjs
//   node plugins/sf-learning/scripts/backfill-reply.mjs <dir> --dry-run
//   SF_LEARNING_HOME=... node plugins/sf-learning/scripts/backfill-reply.mjs
//
// Reads each row's session transcript, finds the typed prompt nearest the row's
// timestamp, and stores the last assistant text before it. Only rows without a
// reply are touched, and only the `reply` field is written — the pass throws if
// anything else would change.
//
// Run --dry-run first. It prints the same numbers and writes nothing.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { backfillCorpus } from "../src/backfill.mjs";
import { learningHome } from "../src/paths.mjs";
import { DistributionShiftError } from "../src/rescore.mjs";

function main(argv) {
  const args = argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const positional = args.filter((a) => !a.startsWith("--"));
  const dir = positional[0] ? path.resolve(positional[0]) : path.join(learningHome(), "corpus");

  const results = backfillCorpus(dir, { dryRun });
  if (results.length === 0) {
    process.stdout.write(`no .jsonl files under ${dir}\n`);
    return;
  }
  for (const r of results) {
    process.stdout.write(
      `${path.basename(r.file)}: ${r.total} rows` +
        (r.dryRun ? " (dry run, nothing written)" : ` — backup ${path.basename(r.backup)}`) +
        "\n" +
        `  already had a reply: ${r.alreadyHadReply}\n` +
        `  filled from transcript: ${r.filled}\n` +
        `  no matching prompt in the transcript: ${r.noMatch}\n` +
        `  transcript missing or unreadable: ${r.noTranscript}\n` +
        `  first prompt of a session, nothing before it: ${r.noReply}\n` +
        `  other runtime, no reader yet: ${r.skippedRuntime}\n` +
        `  malformed lines preserved: ${r.malformed}\n`
    );
    const { guard } = r;
    if (guard.checked) {
      const worst = guard.moves[0];
      process.stdout.write(
        `  distribution guard: passed over ${guard.comparedRows} rows` +
          (worst ? ` (largest move ${worst.bucket} ${worst.points.toFixed(1)} points)` : "") +
          "\n"
      );
    } else {
      process.stdout.write(`  distribution guard: NOT CHECKED — ${guard.reason}\n`);
    }
  }
}

// realpath on both sides, so a run through a junction, symlink or differently cased drive still starts.
const invokedAs = process.argv[1] ? pathToFileURL(fs.realpathSync(process.argv[1])).href : "";
if (invokedAs === pathToFileURL(fs.realpathSync(new URL(import.meta.url))).href) {
  try {
    main(process.argv);
  } catch (error) {
    if (error instanceof DistributionShiftError) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    } else {
      throw error;
    }
  }
}
