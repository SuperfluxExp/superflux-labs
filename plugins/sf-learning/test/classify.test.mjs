// Cases marked (corpus) follow the shape of prompts seen in real capture. The
// wording is invented, so no private chat content is published.

import { test } from "node:test";
import assert from "node:assert/strict";

import { CLASSIFIER_VERSION, isComprehension, isCorrection, isSlashCommand } from "../src/classify.mjs";

test("classifier version is 3 so older rows can be found and re-scored", () => {
  assert.equal(CLASSIFIER_VERSION, 3);
});

test("v3: flags 'i absolutely hate these kind of language' — pushback in every human sense (corpus)", () => {
  assert.equal(isCorrection("i absolutely hate these kind of language.. it reads like filler"), true);
});

test("v3: flags 'this one too.. its annoying' (corpus)", () => {
  assert.equal(isCorrection("Done. --> this one too.. i understand it but its annoying.."), true);
});

test("v3: flags 'stop using X'", () => {
  assert.equal(isCorrection("stop using the word spine"), true);
});

// ---- is_correction: pushback / redirection ----

test("flags a blunt contradiction", () => {
  assert.equal(isCorrection("no, that's wrong — the validator only checks wording"), true);
});

test("flags 'no this is not what i wanted' (corpus)", () => {
  assert.equal(isCorrection("no this is not what i wanted.."), true);
});

test("flags 'no actually i want the default to be 300-600' (corpus)", () => {
  assert.equal(isCorrection("no actually i want the limit to be 50 items"), true);
});

test("flags a redirect with 'instead of'", () => {
  assert.equal(isCorrection("use the existing eval pack instead of building a new one"), true);
});

test("flags a scope correction phrased as a preference (corpus)", () => {
  assert.equal(isCorrection("thats being too conservative, we need logging from the start"), true);
});

test("flags 'revert the merge' (corpus)", () => {
  assert.equal(isCorrection("revert the merge.. the old wording was clearer.."), true);
});

test("flags 'my bad, wrong screenshot' (corpus)", () => {
  assert.equal(isCorrection("my bad.. i attached the wrong file.."), true);
});

test("flags 'i misread' (corpus)", () => {
  assert.equal(isCorrection("i misread the earlier step"), true);
});

test("flags a do-not instruction that redirects output (corpus)", () => {
  assert.equal(isCorrection("dont write it as wall of text.. just say it plainly"), true);
});

test("flags 'try again' (corpus)", () => {
  assert.equal(isCorrection("try again"), true);
});

test("v2: does NOT flag 'dont worry about this' — it is reassurance, not a correction (corpus)", () => {
  assert.equal(isCorrection("plus untracked notes/ dont worry about this.."), false);
});

test("v2: does NOT flag 'make sure you dont assume' inside an instruction", () => {
  assert.equal(isCorrection("write it clearly and make sure you dont assume prior context"), false);
});

test("v2: does NOT flag 'actually' as a bare intensifier", () => {
  assert.equal(isCorrection("this actually looks fine to ship"), false);
});

test("stays quiet on a neutral request", () => {
  assert.equal(isCorrection("write a summary of the release notes for this branch"), false);
});

test("stays quiet on plain approval (corpus)", () => {
  assert.equal(isCorrection("go — start with the capture hook"), false);
  assert.equal(isCorrection("okay i am sold go ahead and take Option A"), false);
});

test("stays quiet on a question with no correction in it", () => {
  assert.equal(isCorrection("what about the second row of that table"), false);
});

test("does not fire on 'instead' buried inside an unrelated word", () => {
  assert.equal(isCorrection("the homestead migration finished"), false);
});

// ---- is_comprehension: the user could not follow ----

test("flags 'i am lost' (corpus)", () => {
  assert.equal(isComprehension("i am lost there are three branches.. whats the diff ?"), true);
});

test("flags 'i am totally lost.. explain this in crisp concise' (corpus)", () => {
  assert.equal(isComprehension("i am totally lost.. explain this in plain clear language"), true);
});

test("flags 'wall of text' (corpus)", () => {
  assert.equal(isComprehension("dont write it as wall of text.. bullet points please"), true);
});

test("flags 'i dont understand your question' (corpus)", () => {
  assert.equal(isComprehension("i dont understand your question what is the second option"), true);
});

test("flags 'what do you mean by this' (corpus)", () => {
  assert.equal(isComprehension("the second column reuses the first id what do you mean by thsi ?"), true);
});

test("flags 'help me parse this instruction' (corpus)", () => {
  assert.equal(isComprehension("help me parse this instruction 'retry only if the upload failed'"), true);
});

test("flags 'the colors dont make sense' as comprehension (this session)", () => {
  assert.equal(isComprehension("the colors you chose dont make sense. sometimes you pick red for something that should not be red"), true);
});

test("flags 'i have no clue why' (this session)", () => {
  assert.equal(isComprehension("I have no clue why the cadence does not apply to the sf-learning plugin"), true);
});

test("flags 'explaing simply' style requests", () => {
  assert.equal(isComprehension("explain simply"), true);
  assert.equal(isComprehension("can you explain this to me"), true);
});

test("does not flag a comprehension question that is really a technical question", () => {
  assert.equal(isComprehension("why is codex transcript only and not hooks ?"), false);
});

test("does not flag ordinary requests", () => {
  assert.equal(isComprehension("run the tests and open a PR"), false);
});

test("a row can be both correction and comprehension", () => {
  const t = "no this is not what i wanted.. i am lost";
  assert.equal(isCorrection(t), true);
  assert.equal(isComprehension(t), true);
});

// ---- misc ----

test("handles non-string input without throwing", () => {
  assert.equal(isCorrection(undefined), false);
  assert.equal(isComprehension(null), false);
  assert.equal(isCorrection(7), false);
});

test("detects a slash command", () => {
  assert.equal(isSlashCommand("/my-plugin:log"), true);
  assert.equal(isSlashCommand("  /review"), true);
});

test("does not treat a path or a fraction as a slash command", () => {
  assert.equal(isSlashCommand("look at plugins/sf-learning/src"), false);
  assert.equal(isSlashCommand("2/3 of the cases pass"), false);
});
