import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ProposeRefused,
  applyToSkill,
  assertProposeBranch,
  findFlexible,
  insertAfterParagraph,
  markDeferred,
  markProposed,
  wrapAt,
} from "../src/propose.mjs";

// A skill file with the wrapping a real one has: rules span two lines, and the
// paragraphs are separated by blank lines.
const SKILL = [
  "# cognitive-render",
  "",
  "## Plain before clever",
  "",
  "Use the actor, object, action, and result. Do not replace them with implementation",
  "shorthand.",
  "",
  "**Bad:**",
  "> some example",
  "",
  "## Concise, not compressed",
  "",
  "Remove repetition and filler.",
  "",
].join("\n");

function refine(overrides = {}) {
  return {
    id: "obs-1",
    skill: "cognitive-render",
    verdict: "refine",
    existing_rule_quote: "Use the actor, object, action, and result. Do not replace them with implementation shorthand.",
    rule_text: "Name where the action runs: which system, which environment, and who runs it.",
    ...overrides,
  };
}

test("the guard refuses every branch that is not a proposal branch", () => {
  assert.throws(() => assertProposeBranch("main"), ProposeRefused);
  assert.throws(() => assertProposeBranch("claude/some-work"), ProposeRefused);
  assert.throws(() => assertProposeBranch(null), ProposeRefused);
  assert.equal(assertProposeBranch("sf-learning/propose-cognitive-render-2026-08-24"), true);
});

test("the refusal says which branch it saw, so the fix is obvious", () => {
  assert.throws(() => assertProposeBranch("main"), /refusing to write a skill file from branch "main"/);
});

test("findFlexible matches a rule that is wrapped across two lines", () => {
  const spans = findFlexible(SKILL, "Use the actor, object, action, and result. Do not replace them with implementation shorthand.");
  assert.equal(spans.length, 1);
  assert.equal(SKILL.slice(spans[0].start, spans[0].end).includes("\n"), true, "the match really does span the wrap");
});

test("findFlexible matches quoted rule text inside a Markdown-emphasized heading", () => {
  const skillText = [
    "6. **Internal-language check.** Remove workflow labels and unexplained acronyms that",
    "matter only to the author.",
  ].join("\n");
  const spans = findFlexible(
    skillText,
    "Internal-language check. Remove workflow labels and unexplained acronyms that matter only to the author.",
  );
  assert.equal(spans.length, 1);
  assert.match(skillText.slice(spans[0].start, spans[0].end), /^\*\*Internal-language/);
});

test("findFlexible matches a quote that stops before the source token's punctuation", () => {
  const skillText = "Name the actual activity: revised page, browser check, or human review.";
  const spans = findFlexible(skillText, "Name the actual activity");
  assert.equal(spans.length, 1);
  assert.equal(skillText.slice(spans[0].start, spans[0].end), "Name the actual activity:");
});

test("findFlexible preserves meaningful punctuation in an approved quote", () => {
  const spans = findFlexible("Rule text?", "Rule text.");
  assert.equal(spans.length, 0);
});

test("findFlexible allows a source colon only after an unpunctuated quote token", () => {
  assert.equal(findFlexible("Rule text?:", "Rule text?").length, 0);
  assert.equal(findFlexible("Rule text.:", "Rule text.").length, 0);
});

test("findFlexible reports every occurrence, so an ambiguous quote can be refused", () => {
  const twice = `${SKILL}\nRemove repetition and filler.\n`;
  assert.equal(findFlexible(twice, "Remove repetition and filler.").length, 2);
});

test("REGRESSION: a refine adds its sentence and deletes nothing", () => {
  // The first real proposal replaced the quoted span, which deleted "Do not
  // replace them with implementation shorthand" — a rule the new text never
  // claimed to cover — and, where a quote stopped mid-sentence, stranded the
  // rest of it on its own line.
  const after = applyToSkill(SKILL, refine());
  assert.ok(after.includes("Do not replace them with implementation"), "the existing rule survives");
  assert.ok(after.includes("shorthand."), "including the half that was on the next line");
  assert.ok(after.includes("Name where the action runs"), "and the new rule is there");
  // Every line that was there before is still there: the point of the fix.
  for (const line of SKILL.split("\n")) {
    assert.ok(after.includes(line), `kept: ${line}`);
  }
  assert.ok(after.length > SKILL.length, "and it grew");
});

test("a refine lands directly after the rule it sharpens, not at the end of the file", () => {
  const after = applyToSkill(SKILL, refine());
  const ruleAt = after.indexOf("Do not replace them with implementation");
  const newAt = after.indexOf("Name where the action runs");
  const nextHeadingAt = after.indexOf("**Bad:**");
  assert.ok(ruleAt < newAt && newAt < nextHeadingAt, "it sits between the rule and whatever followed it");
});

test("a refine whose quote is gone is refused rather than guessed at", () => {
  assert.throws(
    () => applyToSkill(SKILL, refine({ existing_rule_quote: "a rule that was edited away last week" })),
    /is not in the skill file/
  );
});

test("a refine whose quote appears twice is refused", () => {
  const twice = `${SKILL}\nRemove repetition and filler.\n`;
  assert.throws(
    () => applyToSkill(twice, refine({ existing_rule_quote: "Remove repetition and filler." })),
    /appears 2 times/
  );
});

test("a new rule without somewhere to go is refused", () => {
  assert.throws(
    () => applyToSkill(SKILL, refine({ verdict: "new", existing_rule_quote: null })),
    /needs somewhere to go/
  );
});

test("a new rule lands after the text it was told to follow", () => {
  const after = applyToSkill(SKILL, refine({ verdict: "new", existing_rule_quote: null }), {
    after: "Remove repetition and filler.",
  });
  assert.ok(after.indexOf("Remove repetition and filler.") < after.indexOf("Name where the action runs"));
});

test("example and drop can never produce a diff, even if something asks them to", () => {
  for (const verdict of ["example", "drop"]) {
    assert.throws(() => applyToSkill(SKILL, refine({ verdict })), /never produces a diff/);
  }
});

test("insertAfterParagraph keeps the blank line that separates paragraphs", () => {
  const spans = findFlexible(SKILL, "Remove repetition and filler.");
  const after = insertAfterParagraph(SKILL, spans[0], "A new sentence.");
  assert.match(after, /Remove repetition and filler\.\n\nA new sentence\./);
});

test("wrapAt breaks at the file's column instead of writing one long line", () => {
  const wrapped = wrapAt("word ".repeat(40));
  for (const line of wrapped.split("\n")) {
    assert.ok(line.length <= 88, `line of ${line.length} characters`);
  }
});

test("an approved record carries the branch and who approved it", () => {
  const marked = markProposed({ id: "obs-1", status: "open" }, { now: "2026-08-24T00:00:00.000Z", branch: "sf-learning/propose-x" });
  assert.equal(marked.status, "proposed");
  assert.equal(marked.proposal.branch, "sf-learning/propose-x");
  assert.equal(marked.proposal.approved_by, "user");
});

test("a deferred record stays open and says the user asked to wait", () => {
  const marked = markDeferred({ id: "obs-2", status: "open" }, { now: "2026-08-24T00:00:00.000Z" });
  assert.equal(marked.status, "open", "still collecting, not rejected");
  assert.equal(marked.deferred_by, "user");
});
