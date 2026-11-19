import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  MATCH_WINDOW_MS,
  backfillCorpus,
  backfillFile,
  backfillRow,
  nearestPromptRecord,
  needsReply,
  replyForRow,
} from "../src/backfill.mjs";
import { ANTHROPIC_KEY_SHORT } from "./fake-secrets.mjs";

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "sf-learning-backfill-"));
}

// A row as capture wrote it before the reply field existed.
function oldRow(ts, extra = {}) {
  return {
    ts,
    runtime: "claude-code",
    session: "s1",
    cwd: "C:/repo",
    provenance: "human",
    wrapper: null,
    chars: 10,
    raw_chars: 10,
    truncated: false,
    is_correction: false,
    is_comprehension: false,
    is_slash_command: false,
    clf: 3,
    text: "i am lost",
    ...extra,
  };
}

// Transcript records in the real Claude Code format.
function assistantRecord(uuid, parentUuid, ts, text) {
  return {
    type: "assistant",
    uuid,
    parentUuid,
    timestamp: ts,
    message: { content: [{ type: "thinking", thinking: "hidden" }, { type: "text", text }] },
  };
}

function userRecord(uuid, parentUuid, ts, content) {
  return { type: "user", uuid, parentUuid, timestamp: ts, message: { content } };
}

function toolResultRecord(uuid, parentUuid, ts) {
  return { type: "user", uuid, parentUuid, timestamp: ts, message: { content: [{ type: "tool_result", content: "ok" }] } };
}

test("needsReply is true for a row with no reply, and for one whose reply is empty", () => {
  assert.equal(needsReply(oldRow("2026-08-10T10:00:00.000Z")), true);
  assert.equal(needsReply({ ...oldRow("2026-08-10T10:00:00.000Z"), reply: null }), true);
  assert.equal(
    needsReply({ ...oldRow("2026-08-10T10:00:00.000Z"), reply: { text: null, reason: "no-reply" } }),
    true
  );
  assert.equal(
    needsReply({ ...oldRow("2026-08-10T10:00:00.000Z"), reply: { text: "already here", reason: null } }),
    false
  );
});

test("nearestPromptRecord picks the closest typed prompt and ignores tool results", () => {
  const records = [
    userRecord("u1", null, "2026-08-10T10:00:00.000Z", "first prompt"),
    toolResultRecord("t1", "u1", "2026-08-10T10:00:30.000Z"),
    userRecord("u2", "t1", "2026-08-10T10:01:00.000Z", "second prompt"),
  ];
  assert.equal(nearestPromptRecord(records, "2026-08-10T10:00:58.000Z").uuid, "u2");
  assert.equal(nearestPromptRecord(records, "2026-08-10T10:00:02.000Z").uuid, "u1");
});

test("nearestPromptRecord returns null when nothing falls inside the window", () => {
  const records = [userRecord("u1", null, "2026-08-10T10:00:00.000Z", "prompt")];
  assert.equal(nearestPromptRecord(records, "2026-08-10T10:05:00.000Z"), null);
  assert.ok(nearestPromptRecord(records, "2026-08-10T10:01:59.000Z"), "just inside two minutes");
});

test("replyForRow stores the last assistant text before the matched prompt", () => {
  const records = [
    userRecord("u1", null, "2026-08-10T10:00:00.000Z", "first prompt"),
    assistantRecord("a1", "u1", "2026-08-10T10:00:10.000Z", "interim narration while a tool runs"),
    assistantRecord("a2", "a1", "2026-08-10T10:00:20.000Z", "the answer the user actually read"),
    userRecord("u2", "a2", "2026-08-10T10:00:25.000Z", "i am lost"),
  ];
  const reply = replyForRow(oldRow("2026-08-10T10:00:24.000Z"), records);
  assert.equal(reply.text, "the answer the user actually read");
  assert.equal(reply.reason, null);
  assert.equal(reply.backfilled, true);
});

test("replyForRow records backfill-no-match rather than guessing", () => {
  const records = [
    userRecord("u1", null, "2026-08-10T10:00:00.000Z", "first prompt"),
    assistantRecord("a1", "u1", "2026-08-10T10:00:10.000Z", "some answer"),
  ];
  const reply = replyForRow(oldRow("2026-08-10T11:30:00.000Z"), records);
  assert.equal(reply.text, null);
  assert.equal(reply.reason, "backfill-no-match");
  assert.equal(reply.backfilled, true);
});

test("replyForRow says no-reply for the first prompt of a session", () => {
  const records = [userRecord("u1", null, "2026-08-10T10:00:00.000Z", "first prompt")];
  const reply = replyForRow(oldRow("2026-08-10T10:00:01.000Z"), records);
  assert.equal(reply.text, null);
  assert.equal(reply.reason, "no-reply");
});

test("the stored reply is redacted the same way the prompt is", () => {
  const records = [
    userRecord("u1", null, "2026-08-10T10:00:00.000Z", "prompt"),
    assistantRecord(
      "a1",
      "u1",
      "2026-08-10T10:00:05.000Z",
      `your token is ${ANTHROPIC_KEY_SHORT} and it works`
    ),
    userRecord("u2", "a1", "2026-08-10T10:00:10.000Z", "i am lost"),
  ];
  const reply = replyForRow(oldRow("2026-08-10T10:00:09.000Z"), records);
  assert.ok(!reply.text.includes("SECRETVALUE"), "the secret is not stored");
});

test("backfillRow leaves a row that already has a reply untouched, by identity", () => {
  const row = { ...oldRow("2026-08-10T10:00:00.000Z"), reply: { text: "already here", reason: null } };
  assert.equal(backfillRow(row, []), row);
});

test("backfillRow changes nothing but the reply field", () => {
  const records = [
    userRecord("u1", null, "2026-08-10T10:00:00.000Z", "prompt"),
    assistantRecord("a1", "u1", "2026-08-10T10:00:05.000Z", "an answer"),
    userRecord("u2", "a1", "2026-08-10T10:00:10.000Z", "i am lost"),
  ];
  const row = oldRow("2026-08-10T10:00:09.000Z");
  const next = backfillRow(row, records);
  const { reply: _ignored, ...restBefore } = row;
  const { reply: _also, ...restAfter } = next;
  assert.deepEqual(restAfter, restBefore);
  assert.equal(next.reply.text, "an answer");
});

test("backfillFile fills what it can, counts the rest, and writes a backup", () => {
  const dir = tempDir();
  const file = path.join(dir, "2026-08.jsonl");
  const rows = [
    oldRow("2026-08-10T10:00:09.000Z"),
    oldRow("2026-08-10T18:00:00.000Z"), // far outside the window
    { ...oldRow("2026-08-10T10:00:09.000Z"), reply: { text: "already here", reason: null } },
    { ...oldRow("2026-08-10T10:00:09.000Z"), runtime: "hermes" },
  ];
  fs.writeFileSync(file, `${rows.map((r) => JSON.stringify(r)).join("\n")}\nnot json\n`, "utf8");

  const records = [
    userRecord("u1", null, "2026-08-10T10:00:00.000Z", "prompt"),
    assistantRecord("a1", "u1", "2026-08-10T10:00:05.000Z", "an answer"),
    userRecord("u2", "a1", "2026-08-10T10:00:10.000Z", "i am lost"),
  ];
  const transcriptFor = (row) => (row.runtime === "claude-code" ? records : null);

  const result = backfillFile(file, { transcriptFor });
  assert.equal(result.total, 5);
  assert.equal(result.malformed, 1);
  assert.equal(result.filled, 1);
  assert.equal(result.noMatch, 1);
  assert.equal(result.alreadyHadReply, 1);
  assert.equal(result.skippedRuntime, 1);
  assert.ok(fs.existsSync(`${file}.bak`), "backup written");

  const lines = fs.readFileSync(file, "utf8").trim().split("\n");
  assert.equal(lines.length, 5, "no line dropped");
  assert.equal(lines[4], "not json", "malformed line preserved verbatim");
  assert.equal(JSON.parse(lines[0]).reply.text, "an answer");
  assert.equal(JSON.parse(lines[1]).reply.reason, "backfill-no-match");
  assert.equal(JSON.parse(lines[2]).reply.text, "already here");
  assert.equal(JSON.parse(lines[3]).reply.reason, "no-transcript");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a dry run reports the same numbers and writes nothing", () => {
  const dir = tempDir();
  const file = path.join(dir, "2026-08.jsonl");
  const original = `${JSON.stringify(oldRow("2026-08-10T10:00:09.000Z"))}\n`;
  fs.writeFileSync(file, original, "utf8");
  const records = [
    userRecord("u1", null, "2026-08-10T10:00:00.000Z", "prompt"),
    assistantRecord("a1", "u1", "2026-08-10T10:00:05.000Z", "an answer"),
    userRecord("u2", "a1", "2026-08-10T10:00:10.000Z", "i am lost"),
  ];

  const result = backfillFile(file, { transcriptFor: () => records, dryRun: true });
  assert.equal(result.dryRun, true);
  assert.equal(result.filled, 1);
  assert.equal(fs.readFileSync(file, "utf8"), original, "the corpus file is untouched");
  assert.ok(!fs.existsSync(`${file}.bak`), "no backup on a dry run");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("backfill is idempotent: a second pass fills nothing new", () => {
  const dir = tempDir();
  const file = path.join(dir, "2026-08.jsonl");
  fs.writeFileSync(file, `${JSON.stringify(oldRow("2026-08-10T10:00:09.000Z"))}\n`, "utf8");
  const records = [
    userRecord("u1", null, "2026-08-10T10:00:00.000Z", "prompt"),
    assistantRecord("a1", "u1", "2026-08-10T10:00:05.000Z", "an answer"),
    userRecord("u2", "a1", "2026-08-10T10:00:10.000Z", "i am lost"),
  ];
  backfillFile(file, { transcriptFor: () => records });
  const second = backfillFile(file, { transcriptFor: () => records });
  assert.equal(second.filled, 0);
  assert.equal(second.alreadyHadReply, 1);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the distribution guard runs over the backfill and sees no movement", () => {
  const dir = tempDir();
  const file = path.join(dir, "2026-08.jsonl");
  const rows = [...Array(40)].map((_, i) =>
    oldRow("2026-08-10T10:00:09.000Z", { provenance: i < 8 ? "machine" : "human", text: i < 8 ? "" : "i am lost" })
  );
  fs.writeFileSync(file, `${rows.map((r) => JSON.stringify(r)).join("\n")}\n`, "utf8");
  const records = [
    userRecord("u1", null, "2026-08-10T10:00:00.000Z", "prompt"),
    assistantRecord("a1", "u1", "2026-08-10T10:00:05.000Z", "an answer"),
    userRecord("u2", "a1", "2026-08-10T10:00:10.000Z", "i am lost"),
  ];
  const result = backfillFile(file, { transcriptFor: () => records });
  assert.equal(result.guard.checked, true);
  assert.equal(result.guard.moves[0].points, 0, "backfill moves no bucket at all");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("backfillCorpus covers every .jsonl and ignores other files", () => {
  const dir = tempDir();
  fs.writeFileSync(path.join(dir, "2026-07.jsonl"), `${JSON.stringify(oldRow("2026-07-01T10:00:00.000Z"))}\n`);
  fs.writeFileSync(path.join(dir, "2026-08.jsonl"), `${JSON.stringify(oldRow("2026-08-01T10:00:00.000Z"))}\n`);
  fs.writeFileSync(path.join(dir, "notes.txt"), "ignore me");
  const results = backfillCorpus(dir, { transcriptFor: () => null, dryRun: true });
  assert.equal(results.length, 2);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the match window is two minutes", () => {
  assert.equal(MATCH_WINDOW_MS, 120_000);
});

test("backfillFile reads a Codex rollout and fills only reply", () => {
  const dir = tempDir();
  const corpusFile = path.join(dir, "2026-08.jsonl");
  const sessions = path.join(dir, "sessions");
  const day = path.join(sessions, "2026", "08", "18");
  fs.mkdirSync(day, { recursive: true });
  const rollout = path.join(day, "rollout-2026-08-18T10-00-00-s-codex.jsonl");
  const row = oldRow("2026-08-18T10:00:03.000Z", {
    runtime: "codex",
    session: "s-codex",
  });
  fs.writeFileSync(corpusFile, `${JSON.stringify(row)}\n`, "utf8");
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
      timestamp: "2026-08-18T10:00:02.000Z",
      type: "response_item",
      payload: {
        type: "message",
        role: "assistant",
        phase: "final_answer",
        content: [{ type: "output_text", text: "plain answer" }],
      },
    },
    {
      timestamp: "2026-08-18T10:00:04.000Z",
      type: "response_item",
      payload: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "i am lost" }],
      },
    },
  ];
  fs.writeFileSync(rollout, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");

  const result = backfillFile(corpusFile, {
    env: { CODEX_SESSIONS_DIR: sessions },
  });
  assert.equal(result.filled, 1);
  assert.equal(result.skippedRuntime, 0);
  const updated = JSON.parse(fs.readFileSync(corpusFile, "utf8"));
  const { reply: _beforeReply, ...before } = row;
  const { reply, ...after } = updated;
  assert.deepEqual(after, before);
  assert.equal(reply.text, "plain answer");
  assert.equal(reply.backfilled, true);
  fs.rmSync(dir, { recursive: true, force: true });
});
