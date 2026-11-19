// CLI: render an eval iteration as a before-and-after page.
//
//   node plugins/sf-learning/scripts/iteration-review.mjs --repo . \
//     --skill cognitive-render --iteration 001
//
// Reads run.json, grading.json and the artifacts beside them, and writes one
// self-contained page: the reader's own words on top, the text that caused the
// complaint on the left, the same thing under the new rule on the right.
//
// The iteration on disk stays the record. This is how it gets read.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { renderIterationReview } from "../src/iterationReviewHtml.mjs";

function parseArgs(argv) {
  const args = argv.slice(2);
  const valueFor = (name) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const repo = valueFor("--repo") ?? process.cwd();
  const skill = valueFor("--skill") ?? "cognitive-render";
  const iteration = valueFor("--iteration") ?? "001";
  return {
    repo,
    skill,
    iteration,
    out:
      valueFor("--out") ??
      path.join(repo, "evals", "skill-quality", skill, "iterations", iteration, "before-and-after.html"),
  };
}

export function buildIterationModel(options, now = new Date().toISOString()) {
  const dir = path.join(options.repo, "evals", "skill-quality", options.skill, "iterations", options.iteration);
  const run = JSON.parse(fs.readFileSync(path.join(dir, "run.json"), "utf8"));
  const grading = JSON.parse(fs.readFileSync(path.join(dir, "grading.json"), "utf8"));
  const gradeById = new Map((grading.cases ?? []).map((c) => [c.id, c]));
  const ruleById = new Map((run.rulesUnderTest ?? []).map((r) => [r.id, r]));
  const read = (relative) => fs.readFileSync(path.join(dir, relative), "utf8");

  const cases = (run.cases ?? []).map((entry) => ({
    id: entry.id,
    ruleId: entry.rule,
    title: entry.id.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()),
    reaction: entry.readerReaction,
    rule: ruleById.get(entry.rule)?.rule ?? "",
    baseline: read(entry.baselineArtifact),
    revised: read(entry.revisedArtifact),
    grade: gradeById.get(entry.id) ?? {},
  }));

  const notRun = (run.rulesUnderTest ?? []).filter((r) => r.notRun);

  return {
    skill: options.skill,
    iteration: options.iteration,
    generatedAt: now,
    artifactName: path.basename(options.out),
    cases,
    notRun,
    deterministic: grading.deterministicLeg ?? {},
    humanReview: grading.humanReview ?? {},
  };
}

// realpath on both sides, so a run through a junction, symlink or differently cased drive still starts.
const invokedAs = process.argv[1] ? pathToFileURL(fs.realpathSync(process.argv[1])).href : "";
if (invokedAs === pathToFileURL(fs.realpathSync(new URL(import.meta.url))).href) {
  const options = parseArgs(process.argv);
  const model = buildIterationModel(options);
  fs.mkdirSync(path.dirname(options.out), { recursive: true });
  fs.writeFileSync(options.out, renderIterationReview(model), "utf8");
  process.stdout.write(
    `${options.out}\n  ${model.cases.length} pair(s) · ${model.notRun.length} rule(s) not tested\n`
  );
}
