import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";

import {
  SKILL_SCOPE,
  buildProposalView,
  escapeHtml,
  hypothesisFor,
  locateRule,
  sizeImpact,
  splitLedger,
} from "../src/proposalReview.mjs";
import { renderProposalReview } from "../src/proposalReviewHtml.mjs";
import { readyToPropose } from "../src/process.mjs";

const SKILL = [
  "# cognitive-render",
  "",
  "## Plain before clever",
  "",
  "Use the actor, object, action, and result. Do not replace them with implementation",
  "shorthand.",
  "",
  "## Concise, not compressed",
].join("\n");

function observation(overrides = {}) {
  return {
    id: "obs-2026-08-0002",
    skill: "cognitive-render",
    verdict: "refine",
    status: "open",
    rule_text: "Name where the action runs: which system, which environment, and who runs it.",
    existing_rule_quote: "Use the actor, object, action, and result.",
    sightings: [
      {
        ts: "2026-08-06T21:33:00.000Z",
        session: "aaaa1111",
        prompt: "what si sthis.. and where will you run it",
        reasoning: "The rule lists actor, object, action and result, and a sentence can satisfy all four while leaving the location unstated.",
      },
      { ts: "2026-08-12T09:00:00.000Z", session: "bbbb2222", prompt: "where does that run" },
    ],
    ...overrides,
  };
}

test("escapeHtml neutralises markup so a quoted prompt cannot break the page", () => {
  assert.equal(escapeHtml('<script>alert("x")</script>'), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  assert.equal(escapeHtml("a & b"), "a &amp; b");
});

test("locateRule finds the line the quoted rule sits on", () => {
  const found = locateRule(SKILL, "Use the actor, object, action, and result.");
  assert.equal(found.line, 5);
  assert.equal(found.totalLines, 8);
});

test("locateRule finds a rule that wraps across two lines", () => {
  const found = locateRule(SKILL, "Do not replace them with implementation shorthand.");
  assert.equal(found.line, 5, "reports the first line of the pair");
});

test("locateRule finds a rule that wraps across three lines", () => {
  const skill = [
    "# cognitive-render",
    "",
    "6. **Internal-language check.** Remove workflow labels and unexplained acronyms that",
    "   matter only to the author, such as \"forward render\" or \"EDD.\" Name the actual",
    "   activity: revised page, browser check, automated test, or human review.",
  ].join("\n");
  const found = locateRule(
    skill,
    "Internal-language check. Remove workflow labels and unexplained acronyms that matter only to the author, such as \"forward render\" or \"EDD.\" Name the actual activity"
  );
  assert.equal(found.line, 3, "reports the first line of the wrapped rule");
});

test("locateRule reports honestly when the quote is not in the file", () => {
  const found = locateRule(SKILL, "a rule that was never written");
  assert.equal(found.line, null);
  assert.equal(found.totalLines, 8);
});

test("every change is counted as an addition, because nothing is deleted", () => {
  // A refine used to be scored as a replacement. It is not one: it adds its
  // sentence beside the rule it sharpens, because replacing the quoted text
  // deleted parts of the old rule the new one never covered. Only the
  // consolidation pass removes text.
  const refined = sizeImpact(observation(), SKILL);
  assert.equal(refined.removed, 0, "a refine deletes nothing");
  assert.equal(refined.delta, refined.added);
  const fresh = sizeImpact(observation({ verdict: "new", existing_rule_quote: null }), SKILL);
  assert.equal(fresh.removed, 0);
  assert.equal(fresh.delta, fresh.added);
});

test("the hypothesis states how often, across how many sessions, and how to prove it wrong", () => {
  const text = hypothesisFor(observation());
  assert.match(text, /2 times/);
  assert.match(text, /2 different sessions/);
  assert.match(text, /between 2026-08-06 and 2026-08-12/);
  assert.match(text, /did not work and should come back out/);
});

test("a single sighting reads as one time, one session, on one date", () => {
  const text = hypothesisFor(observation({ sightings: [{ ts: "2026-08-06T00:00:00.000Z", session: "a", prompt: "p" }] }));
  assert.match(text, /1 time across 1 session on 2026-08-06/);
});

test("buildProposalView carries the change, the location, and the size cost", () => {
  const view = buildProposalView(observation(), SKILL);
  assert.equal(view.before, "Use the actor, object, action, and result.");
  assert.equal(view.after, "Name where the action runs: which system, which environment, and who runs it.");
  assert.equal(view.location.line, 5);
  assert.equal(view.sessions, 2);
  assert.equal(view.file, SKILL_SCOPE["cognitive-render"].file);
  assert.equal(view.size.current, 8);
  assert.equal(view.size.budget, 515);
});

test("splitLedger separates what is proposed, what changes nothing, and what is still waiting", () => {
  const ready = observation();
  const ignored = observation({ id: "obs-3", verdict: "example" });
  const waiting = observation({ id: "obs-4", sightings: [{ ts: "2026-08-06T00:00:00.000Z", session: "one", prompt: "p" }] });
  const split = splitLedger([ready, ignored, waiting], readyToPropose);
  assert.deepEqual(split.proposals.map((o) => o.id), ["obs-2026-08-0002"]);
  assert.deepEqual(split.notProposing.map((o) => o.id), ["obs-3"]);
  assert.deepEqual(split.belowThreshold.map((o) => o.id), ["obs-4"]);
});

test("the rendered page is self-contained, light, and shows both sides of the change", () => {
  const view = buildProposalView(observation(), SKILL);
  const html = renderProposalReview({
    generatedAt: "2026-08-19T10:00:00.000Z",
    ledgerPath: "docs/learning/observations/2026-08.jsonl",
    artifactName: "review.html",
    views: [view],
    notProposing: [observation({ id: "obs-9", verdict: "example" })],
    belowThreshold: [],
    totals: { records: 2, example: 1, refine: 1, new: 0 },
  });
  assert.match(html, /color-scheme:\s*light/);
  assert.match(html, /<link rel="icon" href="data:,">/);
  assert.doesNotMatch(html, /[ \t]+$/m, "generated HTML has no trailing whitespace");
  assert.doesNotMatch(html, /prefers-color-scheme:\s*dark/);
  assert.doesNotMatch(html, /https?:\/\/(?!www\.w3\.org)/, "no external resources");
  assert.match(html, /What was the problem/);
  assert.match(html, /The text that missed it/);
  assert.match(html, /What changes, and what should get better/);
  assert.match(html, /How we test the claim/);
  assert.match(html, /Name where the action runs/);
  assert.match(html, /must fail|has to fail/i, "the plan demands a case that fails before the change");
  assert.match(html, /data-review-id="obs-2026-08-0002"/);
  assert.match(html, /SKILL_PROPOSAL_REVIEW/);
  assert.match(html, /value="approve"/);
  assert.match(html, /value="reject"/);
});

test("a quoted prompt containing markup is escaped in the rendered page", () => {
  const nasty = observation({
    sightings: [{ ts: "2026-08-06T00:00:00.000Z", session: "a", prompt: "<img src=x onerror=alert(1)>" }],
  });
  const html = renderProposalReview({
    generatedAt: "now",
    ledgerPath: "l",
    artifactName: "r.html",
    views: [buildProposalView(nasty, SKILL)],
    notProposing: [],
    belowThreshold: [],
    totals: { records: 1, example: 0, refine: 1, new: 0 },
  });
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x/);
});

test("a page with nothing to approve still renders and says so", () => {
  const html = renderProposalReview({
    generatedAt: "now",
    ledgerPath: "l",
    artifactName: "r.html",
    views: [],
    notProposing: [],
    belowThreshold: [],
    totals: { records: 0, example: 0, refine: 0, new: 0 },
  });
  assert.match(html, /0 changes to your writing skills/);
});


test("the four blocks answer the questions in the order a reader needs them", () => {
  const view = buildProposalView(observation(), SKILL, { caseCount: 8, nextIteration: 1 });
  const html = renderProposalReview({
    generatedAt: "now", ledgerPath: "l", artifactName: "r.html",
    views: [view], notProposing: [], belowThreshold: [],
    totals: { records: 1, example: 0, refine: 1, new: 0 },
  });
  const order = ["What was the problem", "The text that missed it", "What changes, and what should get better", "How we test the claim"];
  let cursor = -1;
  for (const heading of order) {
    const at = html.indexOf(heading);
    assert.ok(at > cursor, `${heading} comes after the block before it`);
    cursor = at;
  }
});

test("a new rule says nothing covers it rather than showing an empty box", () => {
  const fresh = observation({ verdict: "new", existing_rule_quote: null, id: "obs-new" });
  const html = renderProposalReview({
    generatedAt: "now", ledgerPath: "l", artifactName: "r.html",
    views: [buildProposalView(fresh, SKILL, {})], notProposing: [], belowThreshold: [],
    totals: { records: 1, example: 0, refine: 0, new: 1 },
  });
  assert.match(html, /The text that is missing/);
  assert.match(html, /Nothing in cognitive-render covers this case/);
});

test("the test plan names the real validator and the eval pack for that skill", () => {
  const view = buildProposalView(observation(), SKILL, { caseCount: 8, nextIteration: 4 });
  assert.match(view.validation.legs[0].detail, /npm run validate:cognitive-render/);
  assert.match(view.validation.legs[1].detail, /8 cases in evals\/skill-quality\/cognitive-render/);
  assert.match(view.validation.legs[2].detail, /iterations\/004\//);
  assert.match(view.validation.legs[3].detail, /obs-2026-08-0002 gains a sighting/);
});

test("the plan builds its failing case from what the user actually said", () => {
  const view = buildProposalView(observation(), SKILL, {});
  assert.equal(view.validation.newCase.from, "what si sthis.. and where will you run it");
  assert.equal(view.validation.newCase.mustFailFirst, true);
});

test("the root cause is a sentence in the skill, never a judgement about the writer", () => {
  const cause = buildProposalView(observation(), SKILL, {}).cause;
  assert.equal(cause.kind, "present-but-missed");
  assert.equal(cause.text, "Use the actor, object, action, and result.");
  assert.match(cause.why, /can satisfy all four while leaving the location unstated/);
});


// ---------------------------------------------------------------------------
// The page's own script. It runs in the reader's browser, off disk, where there
// is no clipboard API and a script-started download may be refused outright.
// These pin the behaviour that a button can never silently do nothing.

function scriptOf(html) {
  const marker = "<script>";
  const open = html.indexOf(marker);
  return html.slice(open + marker.length, html.indexOf("</script>", open));
}

function renderOne() {
  return renderProposalReview({
    generatedAt: "now", ledgerPath: "l", artifactName: "r.html",
    views: [buildProposalView(observation(), SKILL, { caseCount: 8, nextIteration: 1 })],
    notProposing: [], belowThreshold: [],
    totals: { records: 1, example: 0, refine: 1, new: 0 },
  });
}

test("the page's script parses — an escaping slip here silently kills both buttons", () => {
  // Parsed, never run: the page embeds prompts quoted from the corpus.
  assert.doesNotThrow(() => new vm.Script(scriptOf(renderOne())));
});

test("REGRESSION: the newline escape survives into the emitted script", () => {
  // A single backslash here is eaten by the template literal, which puts a real
  // newline inside a JS string and breaks the whole script. That shipped once.
  const body = scriptOf(renderOne());
  assert.ok(body.includes('.join("' + String.fromCharCode(92) + 'n")'), "join keeps its escaped newline");
});

test("the download anchor is in the document and the object URL outlives the click", () => {
  const body = scriptOf(renderOne());
  // A detached anchor does nothing in Firefox, and revoking immediately can
  // cancel the download that was just started.
  assert.match(body, /document\.body\.appendChild\(link\)/);
  assert.ok(body.indexOf("appendChild(link)") < body.indexOf("link.click()"), "appended before the click");
  assert.match(body, /setTimeout\([\s\S]*?revokeObjectURL/);
});

test("the text is selected before any copy is attempted, so a blocked clipboard still leaves it copyable", () => {
  const body = scriptOf(renderOne());
  assert.ok(body.indexOf("output.select()") < body.indexOf("navigator.clipboard"), "select first, copy second");
  assert.match(body, /press Ctrl\+C to copy it/);
});

test("the JSON button fills the visible box, so it is never a dead end", () => {
  const body = scriptOf(renderOne());
  assert.match(body, /showing = "json"/);
  assert.match(body, /jsonText\(\)/);
});


test('REGRESSION: the script is a classic one, never a module', () => {
  // These pages are read by opening the file. Chrome refuses to run a module
  // script on a file:// page, so the script never executes and every button is
  // dead with nothing on screen to say why. It imports nothing; it has no
  // reason to be a module. Reported twice by the user before this was found.
  const html = renderOne();
  assert.doesNotMatch(html, /<script[^>]*type=["']module["']/);
  assert.match(html, /<script>/);
});
