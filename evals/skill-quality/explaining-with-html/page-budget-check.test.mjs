import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { checkPageBudget, pageBudget } from "../../../skills/explaining-with-html/assets/page-budget-check.mjs";
import { verifyHumanReadableOutput } from "../../../skills/explaining-with-html/assets/verify-human-readable-output.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const checkerPath = path.join(root, "skills/explaining-with-html/assets/page-budget-check.mjs");
const templatePath = path.join(root, "skills/explaining-with-html/template.html");

const svgFigure = (caption) => `<figure class="fig" data-visual-role="workflow">
  <svg viewBox="0 0 400 100" role="img" aria-label="A sends to B"><rect x="0" y="0" width="100" height="40"/><text x="10" y="24">Service A</text></svg>
  <figcaption>${caption}</figcaption>
</figure>`;

const words = (count) => Array.from({ length: count }, (_, index) => `word${index}`).join(" ");

function page({ hero = svgFigure("<b>A sends jobs to B.</b> B retries twice."), sections = [], body = "" } = {}) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Fixture</title>
<style>.fig { margin: 0; }</style></head><body><main>
<header><h1>Queue retry review</h1><p class="lede">B retries each job twice before it gives up.</p></header>
${hero}
${sections.join("\n")}
${body}
<footer><p>${words(400)}</p></footer>
<script>const filler = "${words(50)}";</script>
</main></body></html>`;
}

const section = (inner, attributes = "") => `<section ${attributes}><h2>Section heading</h2>${inner}</section>`;

test("a compact picture-first page passes", () => {
  const result = checkPageBudget(page({ sections: [section(svgFigure("<b>One relationship.</b> Its meaning."))] }));
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.figureCount, 2);
  assert.deepEqual(result.errors, []);
});

test("the default budget is the ceiling measured on the approved redesign", () => {
  assert.deepEqual(pageBudget, {
    maxVisibleWords: 1200,
    maxCaptionSentences: 2,
    maxParagraphWords: 60,
    minFigures: 1,
  });
});

test("a section with an H2 and no figure fails", () => {
  const result = checkPageBudget(page({ sections: [section("<p>Only words here.</p>")] }));
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors.map((error) => error.code), ["section_without_figure"]);
  assert.match(result.errors[0].excerpt, /Section heading/);
});

test("a marked visual such as a decision matrix counts as the section figure", () => {
  const matrix = `<table data-visual-role="comparison-table"><tr><td>(a)</td><td>Low</td></tr></table>`;
  const result = checkPageBudget(page({ sections: [section(matrix)] }));
  assert.equal(result.ok, true, JSON.stringify(result.errors));
});

test("a section may opt out only with a stated reason", () => {
  const exempt = checkPageBudget(page({ sections: [section("<p>Pick one.</p>", 'data-figure-exempt="review form"')] }));
  assert.equal(exempt.ok, true, JSON.stringify(exempt.errors));
  const blank = checkPageBudget(page({ sections: [section("<p>Pick one.</p>", 'data-figure-exempt=""')] }));
  assert.deepEqual(blank.errors.map((error) => error.code), ["section_without_figure"]);
});

test("a figure hidden in an expander does not count for its section", () => {
  const hidden = `<details><summary>Proof</summary>${svgFigure("Hidden.")}</details>`;
  const result = checkPageBudget(page({ sections: [section(hidden)] }));
  assert.deepEqual(result.errors.map((error) => error.code), ["section_without_figure"]);
});

test("a caption longer than two sentences fails", () => {
  const caption = "<b>First sentence.</b> Second sentence. Third sentence.";
  const result = checkPageBudget(page({ hero: svgFigure(caption) }));
  assert.deepEqual(result.errors.map((error) => error.code), ["caption_too_long"]);
  assert.equal(result.errors[0].sentences, 3);
});

test("abbreviations and evidence tags do not count as extra caption sentences", () => {
  const caption = `<b>Checked 29–30 Oct 2026, e.g. on vendor pages.</b> Prices can change. <span class="tag">Reported</span> <span class="status observed">Observed</span>`;
  const result = checkPageBudget(page({ hero: svgFigure(caption) }));
  assert.equal(result.ok, true, JSON.stringify(result.errors));
});

test("visible words above the ceiling fail, counted outside expanders, diagrams, code, forms and footer", () => {
  const paragraphs = Array.from({ length: 25 }, () => `<p>${words(50)}</p>`).join("");
  const result = checkPageBudget(page({ body: paragraphs }));
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors.map((error) => error.code), ["too_many_visible_words"]);
  assert.ok(result.visibleWords > 1200);

  const depth = `<details><summary>Proof</summary><p>${words(50)}</p></details>`.repeat(30)
    + `<pre>${words(500)}</pre><template><p>${words(500)}</p></template>`
    + `<fieldset><legend>Decision</legend><label>${words(40)}</label><textarea>${words(500)}</textarea></fieldset>`
    + `<!-- ${words(500)} -->`;
  const hiddenDepth = checkPageBudget(page({ body: depth }));
  assert.equal(hiddenDepth.ok, true, JSON.stringify(hiddenDepth.errors));
  assert.ok(hiddenDepth.visibleWords < 120, `counted ${hiddenDepth.visibleWords}`);
});

test("a visible paragraph longer than sixty words fails", () => {
  const result = checkPageBudget(page({ body: `<p>${words(61)}</p>` }));
  assert.deepEqual(result.errors.map((error) => error.code), ["paragraph_too_long"]);
  assert.equal(result.errors[0].words, 61);
});

test("a page without any inline SVG figure fails", () => {
  const result = checkPageBudget(page({ hero: "<p>No picture.</p>" }));
  assert.deepEqual(result.errors.map((error) => error.code), ["missing_figure"]);
});

test("the shipped template passes once the kit comment and unused modules are removed", () => {
  const template = fs.readFileSync(templatePath, "utf8");
  const raw = checkPageBudget(template);
  assert.deepEqual(
    [...new Set(raw.errors.map((error) => error.code))].sort(),
    ["leftover_kit_comment", "leftover_template_module"],
  );
  const page = template
    .replace(/<!-- explaining-with-html STARTING KIT[\s\S]*?-->/, "")
    .replace(/<template data-module[\s\S]*?<\/template>/g, "");
  const result = checkPageBudget(page);
  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2));
  assert.ok(result.figureCount >= 3, `template shows ${result.figureCount} figures`);
});

test("a delivered page that still carries the kit comment or a module fails", () => {
  const withModule = checkPageBudget(page({ body: "<template data-module=\"timeline\"><p>STEP</p></template>" }));
  assert.deepEqual(withModule.errors.map((error) => error.code), ["leftover_template_module"]);
  const withKit = checkPageBudget(page({ body: "<!-- explaining-with-html STARTING KIT — notes -->" }));
  assert.deepEqual(withKit.errors.map((error) => error.code), ["leftover_kit_comment"]);
});

test("readingWords is the count the prose verifier compares with the attention budget", () => {
  const html = page({
    sections: [section(svgFigure("<b>One relationship.</b> Its meaning."))],
    body: `<section data-figure-exempt="review form"><h2>Reply</h2><fieldset><legend>Pick one</legend><label><input type="radio"> Ready</label></fieldset></section>`,
  });
  const result = checkPageBudget(html);
  const verifier = verifyHumanReadableOutput({
    text: html,
    relativePath: "fixture.html",
    context: {
      schema: "superflux.human_readable_output_context.v0.1",
      document: { kind: "report", presentsUi: false },
      reader: { timeAwayHours: 0, attentionBudgetMinutes: 0.01, keyPoints: [], unseenChanges: [] },
      terminology: { conversation: ["queue retry"], product: [], repository: [], forbidden: [] },
    },
  });
  const budgetFinding = verifier.findings.find((finding) => finding.code === "reader_budget_exceeded");
  const counted = Number(budgetFinding.message.match(/has (\d+) words/)[1]);
  assert.equal(result.readingWords, counted);
  assert.ok(result.readingWords > result.visibleWords, "diagram labels and form text count toward reading time");
});

test("the command line reports JSON and exits non-zero on a failing page", () => {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "page-budget-")));
  try {
    const failing = path.join(directory, "failing.html");
    fs.writeFileSync(failing, page({ sections: [section("<p>Only words.</p>")] }));
    assert.throws(
      () => execFileSync(process.execPath, [checkerPath, failing], { encoding: "utf8", stdio: "pipe" }),
      (error) => error.status === 1 && JSON.parse(error.stdout).errors[0].code === "section_without_figure",
    );
    const passing = path.join(directory, "passing.html");
    fs.writeFileSync(passing, page());
    const output = JSON.parse(execFileSync(process.execPath, [checkerPath, passing], { encoding: "utf8" }));
    assert.equal(output.ok, true);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
