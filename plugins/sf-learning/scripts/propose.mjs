// CLI: apply approved observations to their skill file.
//
//   node plugins/sf-learning/scripts/propose.mjs --repo . --month 2026-08 \
//     --approve obs-2026-08-0002,obs-2026-08-0004 --dry-run
//
//   node plugins/sf-learning/scripts/propose.mjs --repo . --month 2026-08 \
//     --approve obs-2026-08-0011 --after "Use the actor, object, action, and result."
//
//   --defer obs-2026-08-0019      the user said keep collecting; nothing is written
//                                 to the skill, the record stays open and says why
//
// Refuses to run outside a branch named `sf-learning/propose-*`. That is what
// makes "never edits a skill file directly" a rule rather than a promise.
//
// Writes nothing until every approved change has been resolved against the
// current file. A half-applied proposal is worse than none: the skill would
// carry a rule the ledger does not know about.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { observationsPath, readJsonl, writeObservations } from "../src/processStore.mjs";
import { SKILL_SCOPE } from "../src/proposalReview.mjs";
import { ProposeRefused, applyToSkill, assertProposeBranch, markDeferred, markProposed } from "../src/propose.mjs";

function currentBranch(repo) {
  const result = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: repo, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const valueFor = (name) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const list = (name) => (valueFor(name) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return {
    repo: valueFor("--repo") ?? process.cwd(),
    month: valueFor("--month") ?? new Date().toISOString().slice(0, 7),
    approve: list("--approve"),
    defer: list("--defer"),
    after: valueFor("--after"),
    dryRun: args.includes("--dry-run"),
  };
}

export function propose(options, branch, now = new Date().toISOString()) {
  assertProposeBranch(branch);

  const ledgerPath = observationsPath(options.repo, options.month);
  const observations = readJsonl(ledgerPath);
  const byId = new Map(observations.map((o) => [o.id, o]));

  for (const id of [...options.approve, ...options.defer]) {
    if (!byId.has(id)) {
      throw new ProposeRefused(`${id} is not in ${ledgerPath}`);
    }
  }

  // Resolve every change against the current files first. Nothing is written
  // until all of them succeed.
  const edits = new Map();
  const applied = [];
  for (const id of options.approve) {
    const observation = byId.get(id);
    const scope = SKILL_SCOPE[observation.skill];
    if (!scope) {
      throw new ProposeRefused(`${id}: no skill scope for "${observation.skill}"`);
    }
    const file = path.join(options.repo, scope.file);
    const before = edits.get(file) ?? fs.readFileSync(file, "utf8");
    const after = applyToSkill(before, observation, { after: options.after });
    edits.set(file, after);
    applied.push({ id, skill: observation.skill, file: scope.file, verdict: observation.verdict });
  }

  const nextObservations = observations.map((observation) => {
    if (options.approve.includes(observation.id)) {
      return markProposed(observation, { now, branch });
    }
    if (options.defer.includes(observation.id)) {
      return markDeferred(observation, { now });
    }
    return observation;
  });

  if (options.dryRun) {
    return { written: false, applied, deferred: options.defer, edits: [...edits.keys()] };
  }

  for (const [file, text] of edits) {
    fs.writeFileSync(file, text, "utf8");
  }
  writeObservations(ledgerPath, nextObservations);
  return { written: true, applied, deferred: options.defer, edits: [...edits.keys()] };
}

// realpath on both sides, so a run through a junction, symlink or differently cased drive still starts.
const invokedAs = process.argv[1] ? pathToFileURL(fs.realpathSync(process.argv[1])).href : "";
if (invokedAs === pathToFileURL(fs.realpathSync(new URL(import.meta.url))).href) {
  const options = parseArgs(process.argv);
  try {
    const result = propose(options, currentBranch(options.repo));
    process.stdout.write(result.written ? "applied\n" : "dry run — nothing written\n");
    for (const change of result.applied) {
      process.stdout.write(`  ${change.id} · ${change.verdict} · ${change.file}\n`);
    }
    for (const id of result.deferred) {
      process.stdout.write(`  ${id} · deferred by you, still collecting\n`);
    }
  } catch (error) {
    if (error instanceof ProposeRefused) {
      process.stderr.write(`REFUSED: ${error.message}\n`);
      process.exitCode = 1;
    } else {
      throw error;
    }
  }
}
