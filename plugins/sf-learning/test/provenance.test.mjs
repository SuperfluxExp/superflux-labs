// Shapes below follow the wrappers the runtimes actually emit. Identifiers are
// invented, and no fixture contains private content.

import { test } from "node:test";
import assert from "node:assert/strict";

import { classifyProvenance } from "../src/provenance.mjs";

test("a plain prompt is human, and comes back unchanged", () => {
  const out = classifyProvenance("okay i am sold go ahead and take Option A");
  assert.equal(out.provenance, "human");
  assert.equal(out.text, "okay i am sold go ahead and take Option A");
  assert.equal(out.wrapper, null);
});

test("in-app-browser-context wrapper: the human prompt after the block is extracted", () => {
  const raw = [
    "",
    '<in-app-browser-context source="ambient-ui-state">',
    "This block is automatically supplied ambient UI state, not part of the user's request.",
    "# In app browser:",
    "- url: http://localhost:3000",
    "</in-app-browser-context>",
    "## My request:",
    "so the impact is that the whole batch would stall ?",
  ].join("\n");
  const out = classifyProvenance(raw);
  assert.equal(out.provenance, "wrapped");
  assert.equal(out.text, "so the impact is that the whole batch would stall ?");
  assert.equal(out.wrapper, "in-app-browser-context");
});

test("Files-mentioned wrapper: '## My request:' body is extracted", () => {
  const raw = [
    "",
    "# Files mentioned by the user:",
    "",
    "## codex-clipboard-abc.png: C:/Temp/codex-clipboard-abc.png",
    "",
    "## My request:",
    "you will have to do this in a new worktree",
    "",
    "In this case we have an issue where the proposal dont survive",
  ].join("\n");
  const out = classifyProvenance(raw);
  assert.equal(out.provenance, "wrapped");
  assert.equal(out.text, "you will have to do this in a new worktree\n\nIn this case we have an issue where the proposal dont survive");
  assert.equal(out.wrapper, "files-mentioned");
});

test("system-reminder prefix: text after the closing tag is the human prompt", () => {
  const raw = "<system-reminder>\nThe user started your suggested background task.\n</system-reminder>\nokay lets not touch it.. then";
  const out = classifyProvenance(raw);
  assert.equal(out.provenance, "wrapped");
  assert.equal(out.text, "okay lets not touch it.. then");
  assert.equal(out.wrapper, "system-reminder");
});

test("a wrapper with nothing after it is machine, not wrapped", () => {
  const raw = '<in-app-browser-context source="ambient-ui-state">\nstuff\n</in-app-browser-context>\n';
  const out = classifyProvenance(raw);
  assert.equal(out.provenance, "machine");
  assert.equal(out.text, "");
});

test("task-notification is machine", () => {
  const raw = "<task-notification>\n<task-id>task-1</task-id>\n<status>completed</status>\n</task-notification>";
  const out = classifyProvenance(raw);
  assert.equal(out.provenance, "machine");
  assert.equal(out.wrapper, "task-notification");
});

test("a subagent task prompt is machine", () => {
  assert.equal(classifyProvenance("<task>\nIndependent code review of two branches\n</task>").provenance, "machine");
});

test("codex_delegation is machine", () => {
  assert.equal(classifyProvenance("<codex_delegation>\n  <source_thread_id>thread-1</source_thread_id>\n</codex_delegation>").provenance, "machine");
});

test("the Codex hyperpersonalized-suggestions system prompt is machine", () => {
  const raw = "# Overview\n\nGenerate 0 to 3 hyperpersonalized suggestions for what this user can do with Codex in this local project";
  assert.equal(classifyProvenance(raw).provenance, "machine");
});

test("a bare JSON payload is machine", () => {
  const raw = '[\n  {\n    "agent_id": "agent-1",\n    "total_rows": 17\n  }\n]';
  assert.equal(classifyProvenance(raw).provenance, "machine");
});

test("an unknown angle-bracket block at the very start is machine, conservatively", () => {
  assert.equal(classifyProvenance("<some-new-runtime-block>\npayload\n</some-new-runtime-block>").provenance, "machine");
});

test("a prompt that merely CONTAINS a tag mid-text is still human", () => {
  const raw = "the response has a <details> block that never opens, can you fix it";
  const out = classifyProvenance(raw);
  assert.equal(out.provenance, "human");
  assert.equal(out.text, raw);
});

test("a prompt starting with a markdown heading you actually wrote stays human", () => {
  const raw = "# plan for today\n\n1. finish the hook\n2. run triage";
  assert.equal(classifyProvenance(raw).provenance, "human");
});

test("a slash command is human", () => {
  assert.equal(classifyProvenance("/code-review").provenance, "human");
});

test("a one-word answer is human", () => {
  assert.equal(classifyProvenance("yes").provenance, "human");
  assert.equal(classifyProvenance("A").provenance, "human");
});

test("non-string input is machine with empty text — never throws", () => {
  assert.deepEqual(classifyProvenance(undefined), { provenance: "machine", text: "", wrapper: null });
  assert.deepEqual(classifyProvenance(null), { provenance: "machine", text: "", wrapper: null });
});
