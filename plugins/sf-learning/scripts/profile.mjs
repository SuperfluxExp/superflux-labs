// CLI: build the style profile from the corpus.
//
//   node plugins/sf-learning/scripts/profile.mjs              # $HOME/.superflux/sf-learning
//   node plugins/sf-learning/scripts/profile.mjs <home-dir>   # any SF_LEARNING_HOME
//   node plugins/sf-learning/scripts/profile.mjs --json       # JSON only, no report
//
// Reads every corpus/*.jsonl, writes profile.json beside the corpus directory,
// prints a short human-readable report. Fails fast on IO errors — this is a
// maintenance command, not the hook.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { learningHome } from "../src/paths.mjs";
import { buildProfile } from "../src/profile.mjs";

function readCorpus(dir) {
  if (!fs.existsSync(dir)) {
    throw new Error(`corpus directory not found: ${dir}`);
  }
  const rows = [];
  for (const name of fs.readdirSync(dir).filter((n) => n.endsWith(".jsonl")).sort()) {
    const lines = fs.readFileSync(path.join(dir, name), "utf8").split("\n");
    for (const line of lines) {
      if (line.trim().length === 0) {
        continue;
      }
      rows.push(JSON.parse(line));
    }
  }
  return rows;
}

function report(p) {
  const sw = p.sentence_words;
  const pw = p.prompt_words;
  const pct = (x) => `${Math.round(x * 100)}%`;
  const lines = [
    `style profile v${p.profile_version} — ${p.generated_at}`,
    `rows used ${p.rows_used} of ${p.rows_seen} · ${p.total_words} words`,
    ``,
    `sentence length (words): median ${sw.median} · mean ${sw.mean} · p90 ${sw.p90} · spread ±${sw.stddev} · range ${sw.min}–${sw.max} · n=${sw.count}`,
    `prompt length  (words): median ${pw.median} · mean ${pw.mean} · p90 ${pw.p90} · max ${pw.max}`,
    `paragraphs per prompt : median ${p.paragraphs_per_prompt.median} · p90 ${p.paragraphs_per_prompt.p90}`,
    ``,
    `casing: ${pct(p.casing.starts_lowercase_ratio)} of prompts start lowercase · "i" ${p.casing.lower_i} vs "I" ${p.casing.upper_i}`,
    `top terminator: ${p.terminators.top}  (${Object.entries(p.terminators.counts).map(([k, v]) => `${k} ${v}`).join(", ")})`,
    `punctuation per 1k words: ${Object.entries(p.punct_per_1k_words).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([k, v]) => `${k} ${v}`).join(" · ")}`,
    ``,
    `vocabulary: ${p.vocabulary.distinct} distinct of ${p.vocabulary.tokens} tokens (TTR ${p.vocabulary.type_token_ratio})`,
    `top words: ${p.vocabulary.top.slice(0, 20).map((w) => `${w.word}(${w.count})`).join(" ")}`,
    ``,
    `cadence (prose runs, ${p.cadence.prompts_measured} multi-sentence prompts, ${p.cadence.transitions} transitions):`,
    `  beat: short ${pct(p.cadence.bucket_share.short)} · mid ${pct(p.cadence.bucket_share.mid)} · long ${pct(p.cadence.bucket_share.long)}   (short<=5w, long>=15w)`,
    `  swing between consecutive sentences: ${p.cadence.mean_abs_delta} words on average`,
    `  long→short landings: ${p.cadence.long_then_short.count} (${pct(p.cadence.long_then_short.rate)} of transitions) · short→long: ${p.cadence.short_then_long.count} (${pct(p.cadence.short_then_long.rate)})`,
    `  starts short ${pct(p.cadence.starts_short_ratio)} · ends short ${pct(p.cadence.ends_short_ratio)} · longest same-beat run: median ${p.cadence.max_run_same_bucket.median}, max ${p.cadence.max_run_same_bucket.max}`,
    `  ".." used as a mid-thought pause: ${p.cadence.pause_marks_per_prompt} per prompt`,
    `  most common 3-beat shapes: ${p.cadence.top_shapes.slice(0, 5).map((s) => `[${s.shape}]×${s.count}`).join("  ")}`,
  ];
  for (const [rt, r] of Object.entries(p.by_runtime)) {
    lines.push(``, `[${rt}] rows ${r.rows} · sentence median ${r.sentence_words.median} (±${r.sentence_words.stddev}) · prompt median ${r.prompt_words.median} · lowercase-start ${pct(r.casing.starts_lowercase_ratio)} · top terminator ${r.terminators.top} · long→short ${pct(r.cadence.long_then_short.rate)} · swing ${r.cadence.mean_abs_delta}w`);
  }
  return `${lines.join("\n")}\n`;
}

function main(argv) {
  const jsonOnly = argv.includes("--json");
  const positional = argv.slice(2).filter((a) => !a.startsWith("--"));
  const home = positional[0] ? path.resolve(positional[0]) : learningHome();
  const corpusDir = path.join(home, "corpus");
  const outFile = path.join(home, "profile.json");

  const rows = readCorpus(corpusDir);
  const profile = buildProfile(rows);
  fs.writeFileSync(outFile, `${JSON.stringify(profile, null, 2)}\n`, "utf8");

  if (jsonOnly) {
    process.stdout.write(`${JSON.stringify(profile)}\n`);
    return;
  }
  process.stdout.write(report(profile));
  process.stdout.write(`\nwrote ${outFile}\n`);
}

// realpath on both sides, so a run through a junction, symlink or differently cased drive still starts.
const invokedAs = process.argv[1] ? pathToFileURL(fs.realpathSync(process.argv[1])).href : "";
if (invokedAs === pathToFileURL(fs.realpathSync(new URL(import.meta.url))).href) {
  main(process.argv);
}
