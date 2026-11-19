// Record shapes below are lifted from a real Claude Code transcript (this
// session's), so these tests pin the format the runtime actually writes.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { lastReplyBefore, readTranscript, resolveTranscriptPath } from "../src/context.mjs";

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "sf-learning-ctx-"));
}

// Minimal but faithful record builders.
let n = 0;
const id = () => `u${++n}`;
function human(text, parent) {
  return { uuid: id(), parentUuid: parent ?? null, type: "user", timestamp: "2026-08-18T10:00:00.000Z", sessionId: "s1", message: { role: "user", content: text } };
}
function toolResult(parent) {
  return { uuid: id(), parentUuid: parent, type: "user", timestamp: "2026-08-18T10:00:01.000Z", sessionId: "s1", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "ok" }] } };
}
function assistant(blocks, parent) {
  return { uuid: id(), parentUuid: parent, type: "assistant", timestamp: "2026-08-18T10:00:02.000Z", sessionId: "s1", message: { role: "assistant", content: blocks } };
}
const text = (t) => ({ type: "text", text: t });
const thinking = (t) => ({ type: "thinking", thinking: t });
const toolUse = () => ({ type: "tool_use", id: "t1", name: "Bash", input: {} });

function writeTranscript(dir, records) {
  const file = path.join(dir, "s1.jsonl");
  fs.writeFileSync(file, records.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
  return file;
}

test("finds the assistant text directly before the human prompt", () => {
  const h1 = human("first question");
  const a1 = assistant([text("the answer to the first question")], h1.uuid);
  const h2 = human("second question", a1.uuid);
  const recs = [h1, a1, h2];
  const r = lastReplyBefore(recs, h2.uuid);
  assert.equal(r.text, "the answer to the first question");
  assert.equal(r.ts, a1.timestamp);
});

test("skips thinking and tool_use blocks — only text is what the user read", () => {
  const h1 = human("q");
  const a1 = assistant([thinking("private reasoning"), toolUse(), text("visible reply")], h1.uuid);
  const h2 = human("next", a1.uuid);
  assert.equal(lastReplyBefore([h1, a1, h2], h2.uuid).text, "visible reply");
});

test("walks back through tool_result user records and tool-only assistant records", () => {
  const h1 = human("q");
  const a1 = assistant([text("here is what i will do")], h1.uuid);
  const a2 = assistant([toolUse()], a1.uuid);
  const tr = toolResult(a2.uuid);
  const a3 = assistant([toolUse()], tr.uuid);
  const tr2 = toolResult(a3.uuid);
  const a4 = assistant([text("done, here is the final reply")], tr2.uuid);
  const h2 = human("thanks", a4.uuid);
  assert.equal(lastReplyBefore([h1, a1, a2, tr, a3, tr2, a4, h2], h2.uuid).text, "done, here is the final reply");
});

test("takes only the LAST text block before the prompt, not every interim narration in the turn", () => {
  // Real bug caught in probing: a long tool-heavy turn has many interim text
  // blocks ("now wiring X…"). The user reacted to the FINAL one.
  const h1 = human("q");
  const a1 = assistant([text("interim: starting")], h1.uuid);
  const a2 = assistant([toolUse()], a1.uuid);
  const tr = toolResult(a2.uuid);
  const a3 = assistant([text("interim: half way")], tr.uuid);
  const a4 = assistant([toolUse()], a3.uuid);
  const tr2 = toolResult(a4.uuid);
  const a5 = assistant([text("final: here is the result you asked for")], tr2.uuid);
  const h2 = human("i am lost", a5.uuid);
  const r = lastReplyBefore([h1, a1, a2, tr, a3, a4, tr2, a5, h2], h2.uuid);
  assert.equal(r.text, "final: here is the result you asked for");
});

test("stops at the previous human prompt — never reaches back into an earlier turn", () => {
  const h0 = human("much earlier");
  const a0 = assistant([text("an old reply")], h0.uuid);
  const h1 = human("new prompt with no reply between", a0.uuid);
  // h1 follows a0 directly — a0 IS the reply before h1. That is correct.
  assert.equal(lastReplyBefore([h0, a0, h1], h1.uuid).text, "an old reply");
  // But a prompt whose parent chain hits a human first gets null.
  const h2 = human("second", h1.uuid);
  assert.equal(lastReplyBefore([h0, a0, h1, h2], h2.uuid), null);
});

test("returns null when the prompt uuid is unknown", () => {
  const h1 = human("q");
  assert.equal(lastReplyBefore([h1], "nope"), null);
});

test("returns null for the first prompt in a session (nothing before it)", () => {
  const h1 = human("first ever");
  assert.equal(lastReplyBefore([h1], h1.uuid), null);
});

test("joins multiple text blocks WITHIN one assistant record", () => {
  const h1 = human("q");
  const a1 = assistant([text("part one."), text("part two.")], h1.uuid);
  const h2 = human("ok", a1.uuid);
  assert.equal(lastReplyBefore([h1, a1, h2], h2.uuid).text, "part one.\n\npart two.");
});

test("when the prompt uuid is not yet in the file (hook fires before it is written), falls back to the newest assistant text", () => {
  // UserPromptSubmit can fire before the runtime appends the user record.
  const h1 = human("q");
  const a1 = assistant([text("latest reply on disk")], h1.uuid);
  const r = lastReplyBefore([h1, a1], null);
  assert.equal(r.text, "latest reply on disk");
});

test("readTranscript tolerates malformed lines and returns records in order", () => {
  const dir = tmp();
  const h1 = human("q");
  const file = path.join(dir, "s1.jsonl");
  fs.writeFileSync(file, `${JSON.stringify(h1)}\nnot json\n${JSON.stringify(assistant([text("a")], h1.uuid))}\n`, "utf8");
  const recs = readTranscript(file);
  assert.equal(recs.length, 2);
  assert.equal(recs[0].uuid, h1.uuid);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("readTranscript returns [] for a missing file — never throws", () => {
  assert.deepEqual(readTranscript(path.join(os.tmpdir(), "definitely-missing-" + process.pid + ".jsonl")), []);
});

test("resolveTranscriptPath prefers transcript_path from the payload", () => {
  const dir = tmp();
  const file = writeTranscript(dir, [human("x")]);
  assert.equal(resolveTranscriptPath({ transcript_path: file, session_id: "s1", cwd: "C:/nope" }, {}), file);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("resolveTranscriptPath falls back to <projects>/<encoded cwd>/<session_id>.jsonl", () => {
  const dir = tmp();
  const projects = path.join(dir, "projects");
  const cwd = "C:\\Users\\me\\src\\repo";
  const encoded = "C--Users-me-src-repo";
  fs.mkdirSync(path.join(projects, encoded), { recursive: true });
  const file = path.join(projects, encoded, "s9.jsonl");
  fs.writeFileSync(file, "", "utf8");
  const got = resolveTranscriptPath({ session_id: "s9", cwd }, { CLAUDE_PROJECTS_DIR: projects });
  assert.equal(got, file);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("resolveTranscriptPath returns null when nothing can be resolved", () => {
  assert.equal(resolveTranscriptPath({}, {}), null);
  assert.equal(resolveTranscriptPath({ session_id: "s1" }, {}), null);
});

test("readTranscript normalizes Codex final assistant output and skips commentary", () => {
  const dir = tmp();
  const file = path.join(dir, "rollout-s-codex.jsonl");
  const records = [
    {
      timestamp: "2026-08-18T10:00:00.000Z",
      type: "response_item",
      payload: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "first prompt" }],
      },
    },
    {
      timestamp: "2026-08-18T10:00:01.000Z",
      type: "response_item",
      payload: {
        type: "message",
        role: "assistant",
        phase: "commentary",
        content: [{ type: "output_text", text: "interim status" }],
      },
    },
    {
      timestamp: "2026-08-18T10:00:02.000Z",
      type: "response_item",
      payload: {
        type: "message",
        role: "assistant",
        phase: "final_answer",
        content: [{ type: "output_text", text: "the final reply" }],
      },
    },
    {
      timestamp: "2026-08-18T10:00:02.500Z",
      type: "response_item",
      payload: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "<environment_context>injected</environment_context>" }],
      },
    },
    {
      timestamp: "2026-08-18T10:00:03.000Z",
      type: "response_item",
      payload: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "i am lost" }],
      },
    },
  ];
  fs.writeFileSync(file, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");

  const normalized = readTranscript(file);
  assert.equal(normalized.length, 4);
  assert.equal(lastReplyBefore(normalized, normalized[3].uuid).text, "the final reply");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("resolveTranscriptPath finds a Codex rollout by session id", () => {
  const dir = tmp();
  const sessions = path.join(dir, "sessions");
  const day = path.join(sessions, "2026", "08", "18");
  fs.mkdirSync(day, { recursive: true });
  const file = path.join(day, "rollout-2026-08-18T10-00-00-s-codex.jsonl");
  fs.writeFileSync(file, "", "utf8");

  assert.equal(
    resolveTranscriptPath(
      { runtime: "codex", session_id: "s-codex", cwd: "C:/repo" },
      { CODEX_SESSIONS_DIR: sessions }
    ),
    file
  );
  fs.rmSync(dir, { recursive: true, force: true });
});
