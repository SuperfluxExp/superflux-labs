// CLI: render the proposals that are waiting for approval as one HTML page.
//
//   node plugins/sf-learning/scripts/proposal-review.mjs --repo .
//   node plugins/sf-learning/scripts/proposal-review.mjs --repo . --month 2026-08 --out docs/learning/review.html
//
// Reads the observations ledger, finds every record past the threshold, reads
// the target skill file to locate the rule each one would change, and writes a
// self-contained page: current text beside proposed text, how often the problem
// happened, what it claims will change, and what it costs in lines.
//
// The page is the approval surface. Reading a JSONL to decide whether to change
// a skill that shapes every later answer is not a review, and the user said so.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { readyToPropose } from "../src/process.mjs";
import { observationsPath, readJsonl } from "../src/processStore.mjs";
import { SKILL_SCOPE, buildProposalView, splitLedger } from "../src/proposalReview.mjs";
import { renderProposalReview } from "../src/proposalReviewHtml.mjs";

function parseArgs(argv) {
  const args = argv.slice(2);
  const valueFor = (name) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const repo = valueFor("--repo") ?? process.cwd();
  const month = valueFor("--month") ?? new Date().toISOString().slice(0, 7);
  return {
    repo,
    month,
    out: valueFor("--out") ?? path.join(repo, "docs", "learning", `${month}-proposals-review.html`),
  };
}

export function buildReviewModel(options, now = new Date().toISOString()) {
  const ledger = observationsPath(options.repo, options.month);
  const observations = readJsonl(ledger);
  const { proposals, notProposing, belowThreshold, heldByUser } = splitLedger(observations, readyToPropose);

  const skillText = {};
  for (const [skill, scope] of Object.entries(SKILL_SCOPE)) {
    const file = path.join(options.repo, scope.file);
    skillText[skill] = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  }

  // Eval-pack facts, read from disk so the test plan names real numbers rather
  // than a plausible-sounding placeholder: how many cases the pack already has,
  // and which iteration this change would be recorded as.
  const evalPack = {};
  for (const [skill, scope] of Object.entries(SKILL_SCOPE)) {
    const dir = path.join(options.repo, scope.evalDir ?? "");
    let caseCount = null;
    try {
      caseCount = (JSON.parse(fs.readFileSync(path.join(dir, "evals.json"), "utf8")).cases ?? []).length;
    } catch {
      caseCount = null;
    }
    const iterationsDir = path.join(dir, "iterations");
    let highest = 0;
    if (fs.existsSync(iterationsDir)) {
      for (const name of fs.readdirSync(iterationsDir)) {
        const n = Number.parseInt(name, 10);
        if (Number.isFinite(n) && n > highest) {
          highest = n;
        }
      }
    }
    evalPack[skill] = { caseCount, nextIteration: highest + 1 };
  }

  const views = proposals.map((observation) =>
    buildProposalView(observation, skillText[observation.skill], evalPack[observation.skill] ?? {})
  );
  const totals = {
    records: observations.length,
    example: observations.filter((o) => o.verdict === "example").length,
    refine: observations.filter((o) => o.verdict === "refine").length,
    new: observations.filter((o) => o.verdict === "new").length,
  };
  return {
    generatedAt: now,
    ledgerPath: path.relative(options.repo, ledger).split(path.sep).join("/"),
    artifactName: path.basename(options.out),
    views,
    notProposing,
    belowThreshold,
    heldByUser,
    totals,
  };
}

// realpath on both sides, so a run through a junction, symlink or differently cased drive still starts.
const invokedAs = process.argv[1] ? pathToFileURL(fs.realpathSync(process.argv[1])).href : "";
if (invokedAs === pathToFileURL(fs.realpathSync(new URL(import.meta.url))).href) {
  const options = parseArgs(process.argv);
  const model = buildReviewModel(options);
  fs.mkdirSync(path.dirname(options.out), { recursive: true });
  fs.writeFileSync(options.out, renderProposalReview(model), "utf8");
  process.stdout.write(
    `${options.out}\n` +
      `  ${model.views.length} proposal(s) waiting · ${model.totals.records} observations · ` +
      `${model.totals.example} changed nothing · ${model.belowThreshold.length} below the threshold · ` +
      `${(model.heldByUser ?? []).length} held at your request\n`
  );
  for (const view of model.views) {
    process.stdout.write(`  ${view.id} · ${view.verdict} · ${view.skill} · ${view.sessions} sessions\n`);
  }
}
