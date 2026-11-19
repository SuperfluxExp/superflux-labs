// CLI: re-score the corpus with the current classifier.
//
//   node plugins/sf-learning/scripts/rescore.mjs            # $HOME/.superflux/sf-learning/corpus
//   node plugins/sf-learning/scripts/rescore.mjs <dir>      # any corpus directory
//   node plugins/sf-learning/scripts/rescore.mjs --allow-distribution-shift
//   SF_LEARNING_HOME=... node plugins/sf-learning/scripts/rescore.mjs
//
// Writes a one-time .bak beside each file, then rewrites it atomically.
// Prints a per-file summary. Exits non-zero on any failure.
//
// Refuses to write when the rewrite would move any provenance or flag bucket by
// more than 5 percentage points, because that is what a corrupting rescore looks
// like from the outside. `--allow-distribution-shift` is the escape hatch for a
// deliberate classifier change; it prints what it let through.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { learningHome } from "../src/paths.mjs";
import { DistributionShiftError, rescoreCorpus } from "../src/rescore.mjs";

function main(argv) {
  const args = argv.slice(2);
  const allowDistributionShift = args.includes("--allow-distribution-shift");
  const positional = args.filter((a) => !a.startsWith("--"));
  const dir = positional[0] ? path.resolve(positional[0]) : path.join(learningHome(), "corpus");
  const results = rescoreCorpus(dir, { allowDistributionShift });
  if (results.length === 0) {
    process.stdout.write(`no .jsonl files under ${dir}\n`);
    return;
  }
  for (const r of results) {
    process.stdout.write(
      `${path.basename(r.file)}: ${r.total} rows — rescored ${r.rescored}, unchanged ${r.unchanged}, malformed ${r.malformed}` +
        ` | human ${r.provenance.human}, wrapped ${r.provenance.wrapped}, machine ${r.provenance.machine}` +
        ` | backup ${path.basename(r.backup)}\n`
    );
    const { guard } = r;
    if (guard.checked) {
      const worst = guard.moves[0];
      process.stdout.write(
        `  distribution guard: passed over ${guard.comparedRows} comparable rows` +
          (worst ? ` (largest move ${worst.bucket} ${worst.points.toFixed(1)} points)` : "") +
          "\n"
      );
    } else if (guard.reason === "small-sample") {
      process.stdout.write(
        `  distribution guard: NOT CHECKED — only ${guard.comparedRows} comparable rows\n`
      );
    } else if (guard.reason === "override") {
      const worst = guard.moves[0];
      process.stdout.write(
        "  distribution guard: OVERRIDDEN by --allow-distribution-shift" +
          (worst ? ` (largest move ${worst.bucket} ${worst.points.toFixed(1)} points)` : "") +
          "\n"
      );
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
