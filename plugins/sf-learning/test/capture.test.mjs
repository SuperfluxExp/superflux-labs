import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { MAX_REPLY, MAX_TEXT, buildRecord, captureFromInput, lookupReply, shapeReply } from "../src/capture.mjs";
import { corpusFile } from "../src/paths.mjs";
import { AWS_KEY_ID } from "./fake-secrets.mjs";

const NOW = new Date("2026-08-03T22:10:00Z");

function tempHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "sf-learning-test-"));
}

test("builds a record from a normal prompt", () => {
  const record = buildRecord(
    { prompt: "make the cadence section shorter", session_id: "s1", cwd: "C:/repo" },
    { now: NOW, env: {} }
  );
  assert.equal(record.text, "make the cadence section shorter");
  assert.equal(record.session, "s1");
  assert.equal(record.cwd, "C:/repo");
  assert.equal(record.ts, "2026-08-03T22:10:00.000Z");
  assert.equal(record.is_correction, false);
  assert.equal(record.is_comprehension, false);
  assert.equal(record.is_slash_command, false);
  assert.equal(record.truncated, false);
  assert.equal(record.chars, 32);
  assert.equal(record.raw_chars, 32);
  assert.equal(record.provenance, "human");
  assert.equal(record.wrapper, null);
  assert.equal(record.clf, 3);
});

test("a wrapped prompt stores only the human text, and chars measures that text", () => {
  const raw = '<in-app-browser-context source="ambient-ui-state">\n# In app browser:\n- url: x\n</in-app-browser-context>\n## My request:\nso the impact is that the whole batch would stall ?';
  const record = buildRecord({ prompt: raw }, { now: NOW, env: {} });
  assert.equal(record.provenance, "wrapped");
  assert.equal(record.wrapper, "in-app-browser-context");
  assert.equal(record.text, "so the impact is that the whole batch would stall ?");
  assert.equal(record.chars, record.text.length);
  assert.equal(record.raw_chars, raw.length);
  assert.ok(record.raw_chars > record.chars, "raw_chars must include the wrapper");
});

test("a machine payload is still written — with empty text and no flags — so it can be counted", () => {
  const record = buildRecord(
    { prompt: "<task-notification>\n<task-id>abc</task-id>\n</task-notification>" },
    { now: NOW, env: {} }
  );
  assert.notEqual(record, null, "machine rows are kept for counting");
  assert.equal(record.provenance, "machine");
  assert.equal(record.wrapper, "task-notification");
  assert.equal(record.text, "");
  assert.equal(record.chars, 0);
  assert.equal(record.is_correction, false);
  assert.equal(record.is_comprehension, false);
});

test("provenance runs BEFORE truncation — a wrapper closing past the cap still yields the human prompt", () => {
  const filler = "x".repeat(MAX_TEXT + 200);
  const raw = `<in-app-browser-context source="ambient-ui-state">\n${filler}\n</in-app-browser-context>\n## My request:\nokay lets not touch it.. then`;
  const record = buildRecord({ prompt: raw }, { now: NOW, env: {} });
  assert.equal(record.provenance, "wrapped");
  assert.equal(record.text, "okay lets not touch it.. then");
  assert.equal(record.truncated, false, "the human text is short; only the wrapper was long");
});

test("flags comprehension separately from correction", () => {
  const record = buildRecord({ prompt: "i am totally lost.. explain this in plain terms" }, { now: NOW, env: {} });
  assert.equal(record.is_comprehension, true);
  assert.equal(record.is_correction, false);
});

// ---- reply context (gap 1: what the user was reacting to) ----

test("a row without a reply says so, with a reason — never a bare null", () => {
  const record = buildRecord({ prompt: "hello" }, { now: NOW, env: {} });
  assert.deepEqual(record.reply, { text: null, chars: 0, truncated: false, ts: null, reason: "no-reply" });
});

test("shapeReply redacts and caps the reply, and records the true length", () => {
  const long = "x".repeat(MAX_REPLY + 100);
  const r = shapeReply({ text: `${AWS_KEY_ID} ${long}`, ts: "2026-08-18T10:00:00.000Z" });
  assert.ok(!r.text.includes(AWS_KEY_ID), "secret in a reply is redacted");
  assert.equal(r.text.length, MAX_REPLY);
  assert.equal(r.truncated, true);
  assert.equal(r.chars, `[redacted:aws-key] ${long}`.length);
  assert.equal(r.ts, "2026-08-18T10:00:00.000Z");
  assert.equal(r.reason, null);
});

test("shapeReply passes an explicit reason through when there is no reply", () => {
  assert.equal(shapeReply(null, "no-transcript").reason, "no-transcript");
});

test("buildRecord attaches a shaped reply when given one", () => {
  const record = buildRecord(
    { prompt: "i am lost" },
    { now: NOW, env: {}, reply: shapeReply({ text: "here is a dense wall of text", ts: "t" }) }
  );
  assert.equal(record.reply.text, "here is a dense wall of text");
  assert.equal(record.is_comprehension, true);
});

test("lookupReply reads the transcript and returns the newest assistant text", () => {
  const home = tempHome();
  const transcript = path.join(home, "s1.jsonl");
  const recs = [
    { uuid: "u1", parentUuid: null, type: "user", timestamp: "t1", message: { role: "user", content: "first" } },
    { uuid: "a1", parentUuid: "u1", type: "assistant", timestamp: "t2", message: { role: "assistant", content: [{ type: "thinking", thinking: "hmm" }, { type: "text", text: "the reply you read" }] } },
  ];
  fs.writeFileSync(transcript, recs.map((r) => JSON.stringify(r)).join("\n") + "\n");
  const r = lookupReply({ prompt: "next", transcript_path: transcript }, {});
  assert.equal(r.text, "the reply you read");
  assert.equal(r.ts, "t2");
  assert.equal(r.reason, null);
  fs.rmSync(home, { recursive: true, force: true });
});

test("lookupReply reports no-transcript when the path cannot be resolved", () => {
  assert.equal(lookupReply({ prompt: "x" }, {}).reason, "no-transcript");
  assert.equal(lookupReply({ prompt: "x", transcript_path: path.join(os.tmpdir(), "missing-" + process.pid + ".jsonl") }, {}).reason, "no-transcript");
});

test("lookupReply reads the final Codex assistant response, not commentary", () => {
  const home = tempHome();
  const transcript = path.join(home, "rollout-s1.jsonl");
  const records = [
    {
      timestamp: "t1",
      type: "response_item",
      payload: {
        type: "message",
        role: "assistant",
        phase: "commentary",
        content: [{ type: "output_text", text: "still working" }],
      },
    },
    {
      timestamp: "t2",
      type: "response_item",
      payload: {
        type: "message",
        role: "assistant",
        phase: "final_answer",
        content: [{ type: "output_text", text: "the answer the user read" }],
      },
    },
  ];
  fs.writeFileSync(transcript, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`);

  const reply = lookupReply(
    { prompt: "what do you mean", transcript_path: transcript },
    { CLAUDE_PLUGIN_ROOT: "C:/home/me/.codex/plugins/cache/sf-learning" }
  );
  assert.equal(reply.text, "the answer the user read");
  assert.equal(reply.ts, "t2");
  fs.rmSync(home, { recursive: true, force: true });
});

test("captureFromInput writes the reply onto the row end to end", () => {
  const home = tempHome();
  const transcript = path.join(home, "s1.jsonl");
  fs.writeFileSync(transcript, JSON.stringify({ uuid: "a1", parentUuid: null, type: "assistant", timestamp: "t2", message: { role: "assistant", content: [{ type: "text", text: "final answer" }] } }) + "\n");
  captureFromInput({ prompt: "what do you mean", session_id: "s1", transcript_path: transcript }, { now: NOW, env: { SF_LEARNING_HOME: home } });
  const row = JSON.parse(fs.readFileSync(corpusFile(home, NOW), "utf8").trim());
  assert.equal(row.reply.text, "final answer");
  assert.equal(row.is_comprehension, true);
  fs.rmSync(home, { recursive: true, force: true });
});

test("skips an empty prompt", () => {
  assert.equal(buildRecord({ prompt: "" }, { now: NOW, env: {} }), null);
});

test("skips a whitespace-only prompt", () => {
  assert.equal(buildRecord({ prompt: "   \n\t " }, { now: NOW, env: {} }), null);
});

test("skips a payload with no prompt field", () => {
  assert.equal(buildRecord({}, { now: NOW, env: {} }), null);
});

test("redacts before storing — a secret never reaches the ledger", () => {
  const record = buildRecord(
    { prompt: `deploy with ${AWS_KEY_ID} now` },
    { now: NOW, env: {} }
  );
  assert.ok(!record.text.includes(AWS_KEY_ID));
  assert.match(record.text, /\[redacted:aws-key\]/);
});

test("flags a correction so stream 2 can filter on it", () => {
  const record = buildRecord(
    { prompt: "no, that's wrong — use the existing eval pack" },
    { now: NOW, env: {} }
  );
  assert.equal(record.is_correction, true);
});

test("truncates a huge paste but records its true length", () => {
  const long = "a".repeat(MAX_TEXT + 500);
  const record = buildRecord({ prompt: long }, { now: NOW, env: {} });
  assert.equal(record.text.length, MAX_TEXT);
  assert.equal(record.truncated, true);
  assert.equal(record.chars, MAX_TEXT + 500);
});

test("records the runtime it was captured from", () => {
  const record = buildRecord(
    { prompt: "hello" },
    { now: NOW, env: { CLAUDE_PLUGIN_ROOT: path.join(os.homedir(), ".codex", "plugins", "cache", "x") } }
  );
  assert.equal(record.runtime, "codex");
});

test("appends one JSON line per capture and creates the corpus directory", () => {
  const home = tempHome();
  const first = captureFromInput(
    { prompt: "first prompt", session_id: "s1" },
    { now: NOW, env: { SF_LEARNING_HOME: home } }
  );
  const second = captureFromInput(
    { prompt: "second prompt", session_id: "s1" },
    { now: NOW, env: { SF_LEARNING_HOME: home } }
  );

  assert.equal(first.written, true);
  assert.equal(second.written, true);

  const file = corpusFile(home, NOW);
  const lines = fs.readFileSync(file, "utf8").trim().split("\n");
  assert.equal(lines.length, 2);
  assert.equal(JSON.parse(lines[0]).text, "first prompt");
  assert.equal(JSON.parse(lines[1]).text, "second prompt");

  fs.rmSync(home, { recursive: true, force: true });
});

test("reports not-written for a skipped prompt and creates no file", () => {
  const home = tempHome();
  const result = captureFromInput({ prompt: "  " }, { now: NOW, env: { SF_LEARNING_HOME: home } });
  assert.equal(result.written, false);
  assert.equal(fs.existsSync(corpusFile(home, NOW)), false);
  fs.rmSync(home, { recursive: true, force: true });
});

test("every stored line is valid JSON on one line, even with newlines in the prompt", () => {
  const home = tempHome();
  captureFromInput(
    { prompt: "line one\nline two\nline three" },
    { now: NOW, env: { SF_LEARNING_HOME: home } }
  );
  const raw = fs.readFileSync(corpusFile(home, NOW), "utf8").trim();
  assert.equal(raw.split("\n").length, 1, "a multi-line prompt must still be one JSONL row");
  assert.equal(JSON.parse(raw).text, "line one\nline two\nline three");
  fs.rmSync(home, { recursive: true, force: true });
});
