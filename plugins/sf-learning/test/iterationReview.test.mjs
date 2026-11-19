import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";

import { renderIterationReview, specimenBody } from "../src/iterationReviewHtml.mjs";

function model(overrides = {}) {
  return {
    skill: "cognitive-render",
    iteration: "001",
    generatedAt: "2026-08-24T00:00:00.000Z",
    artifactName: "before-and-after.html",
    cases: [
      {
        id: "where-the-command-runs",
        ruleId: "obs-2026-08-0002",
        title: "Where the command runs",
        reaction: "where should i run that git stash push command ? in which dir",
        rule: "Name where an action runs.",
        baseline: "# Baseline\n\nsome preamble\n\n---\n\nrun this:\n\n```bash\ngit stash push\n```",
        revised: "# Revised\n\nsome preamble\n\n---\n\nRun this in your api-server checkout:\n\n```bash\ngit stash push\n```",
        grade: {
          baselineBreaksTheRule: true,
          revisedFollowsTheRule: true,
          how: "No directory named.",
          howRevised: "Names the checkout.",
        },
      },
    ],
    notRun: [{ id: "obs-2026-08-0020", rule: "State the phase.", why: "The reply that caused it was never captured." }],
    deterministic: {
      reproducedFromGit: { before: { exit: 1, phrasesPresent: 0, of: 4 }, after: { exit: 0, phrasesPresent: 4, of: 4 } },
      skillSize: { before: 469, after: 487, budget: 515 },
    },
    humanReview: { status: "awaiting", note: "It is not a pass until the reader has read the pairs." },
    ...overrides,
  };
}

test("specimenBody takes the text after the separator, not the explanation above it", () => {
  assert.equal(specimenBody("# Title\n\nwhy this exists\n\n---\n\nthe real text"), "the real text");
  assert.equal(specimenBody("no separator here"), "no separator here");
});

test("both texts appear, and the reader's own words sit above them", () => {
  const html = renderIterationReview(model());
  assert.match(html, /where should i run that git stash push command/);
  assert.match(html, /What I wrote — the real text/);
  assert.match(html, /What it would say under the new rule/);
  assert.ok(
    html.indexOf("where should i run that git stash") < html.indexOf("What I wrote"),
    "the complaint comes before the pair, because it is the reason the case exists"
  );
});

test("the page says the grading is the author's own, before the pairs", () => {
  const html = renderIterationReview(model());
  assert.match(html, /I wrote the rules, I wrote the rewrites, and I graded them/);
  assert.ok(
    html.indexOf("I wrote the rules") < html.indexOf('class="pair"'),
    "the caveat is above the thing it qualifies, not in a footnote"
  );
});

test("a rule that could not be tested says so, with the reason", () => {
  const html = renderIterationReview(model());
  assert.match(html, /could not be tested this way/);
  assert.match(html, /The reply that caused it was never captured/);
});

test("the deterministic result is shown as a before and an after", () => {
  const html = renderIterationReview(model());
  assert.match(html, /exit 1/);
  assert.match(html, /exit 0/);
  assert.match(html, /\.det \.cell \.big\{display:block/);
  assert.match(html, /0 of 4 rules present/);
  assert.match(html, /4 of 4 rules present/);
  assert.match(html, /487 lines/);
});

test("every pair asks whether the new text actually reads better, including a way to reject the rule", () => {
  const html = renderIterationReview(model());
  assert.match(html, /Does the new text actually read better to you\?/);
  assert.match(html, /value="better"/);
  assert.match(html, /value="worse"/);
  assert.match(html, /value="rule-wrong"/);
});

test("an approved iteration records the decision instead of saying approval is still waiting", () => {
  const html = renderIterationReview(model({
    humanReview: {
      status: "approved",
      note: "The user approved the recommended change.",
    },
  }));
  assert.match(html, /Your approval is recorded/);
  assert.doesNotMatch(html, /awaits yours/);
});

test("the page is self-contained and light, and its script parses", () => {
  const html = renderIterationReview(model());
  assert.match(html, /color-scheme:\s*light/);
  assert.match(html, /<link rel="icon" href="data:,">/);
  assert.doesNotMatch(html, /prefers-color-scheme:\s*dark/);
  assert.doesNotMatch(html, /https?:\/\/(?!www\.w3\.org)/, "no external resources");
  const marker = "<script>";
  const open = html.indexOf(marker);
  const body = html.slice(open + marker.length, html.indexOf("</script>", open));
  assert.doesNotThrow(() => new vm.Script(body), "the shared chrome still parses when embedded here");
});

test("captured text containing markup is escaped, in both columns", () => {
  const nasty = model();
  nasty.cases[0].baseline = "# t\n\n---\n\n<img src=x onerror=alert(1)>";
  nasty.cases[0].revised = "# t\n\n---\n\n<script>alert(2)</script>";
  nasty.cases[0].reaction = "<b>not bold</b>";
  const html = renderIterationReview(nasty);
  assert.doesNotMatch(html, /<img src=x/);
  assert.doesNotMatch(html, /<script>alert\(2\)/);
  assert.doesNotMatch(html, /<b>not bold<\/b>/);
  assert.match(html, /&lt;img src=x/);
});


test('REGRESSION: the script is a classic one, never a module', () => {
  // These pages are read by opening the file. Chrome refuses to run a module
  // script on a file:// page, so the script never executes and every button is
  // dead with nothing on screen to say why. It imports nothing; it has no
  // reason to be a module. Reported twice by the user before this was found.
  const html = renderIterationReview(model());
  assert.doesNotMatch(html, /<script[^>]*type=["']module["']/);
  assert.match(html, /<script>/);
});
