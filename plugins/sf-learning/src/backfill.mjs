// Backfill the `reply` field onto rows captured before reply capture existed.
//
// Why: 888 of the 892 rows in the live corpus were captured before the hook
// learned to store the assistant's reply. Without it, "i am lost" records that
// the user was lost but not what lost them, and the process pass would be
// reading reactions with the thing reacted to missing.
//
// The join key is the row's TIMESTAMP, not its text. Stored text is redacted
// before it is written, capped at 4000 characters, and for a `wrapped` row
// holds only the user's part of the payload — so matching on text would fail on
// exactly the rows worth backfilling. The transcript's own user records carry a
// timestamp, and the capture hook fires within a second or two of the runtime
// appending one.
//
// When nothing matches inside the window the row records `backfill-no-match`
// and keeps an empty reply. A wrong reply is worse than no reply: the process
// pass would then reason confidently about a pair that never happened.

import fs from "node:fs";
import path from "node:path";

import { shapeReply } from "./capture.mjs";
import { lastReplyBefore, readTranscript, resolveTranscriptPath } from "./context.mjs";
import { assertDistributionStable, distributionOf } from "./rescore.mjs";

// How far from the row's timestamp a transcript record may sit and still be
// considered the same turn. The hook fires at prompt submit and the runtime
// appends its record immediately after, so the real gap is under a second; two
// minutes is slack for a slow disk, not for a different turn.
export const MATCH_WINDOW_MS = 120_000;

// True when this row still needs a reply. A row that already carries reply text
// is never touched, whatever its reason field says.
export function needsReply(row) {
  if (!row || typeof row !== "object") {
    return false;
  }
  if (row.reply === undefined || row.reply === null) {
    return true;
  }
  return typeof row.reply.text !== "string" || row.reply.text.length === 0;
}

// A transcript record that is the user typing, rather than a tool result.
// Tool results are also `type: "user"` but their content is an array; that is
// the same rule context.mjs uses to tell them apart.
function isTypedPrompt(record) {
  return record && record.type === "user" && typeof record.message?.content === "string";
}

// The user record closest in time to `ts`, within the window. Pure.
// Returns null when the transcript has no typed prompt that close.
export function nearestPromptRecord(records, ts, windowMs = MATCH_WINDOW_MS) {
  const target = Date.parse(ts);
  if (Number.isNaN(target) || !Array.isArray(records)) {
    return null;
  }
  let best = null;
  let bestGap = Infinity;
  for (const record of records) {
    if (!isTypedPrompt(record) || typeof record.timestamp !== "string") {
      continue;
    }
    const gap = Math.abs(Date.parse(record.timestamp) - target);
    if (Number.isNaN(gap) || gap > windowMs) {
      continue;
    }
    if (gap < bestGap) {
      best = record;
      bestGap = gap;
    }
  }
  return best;
}

// Find the reply for one row inside one transcript. Pure.
// Returns a shaped reply object, always carrying `backfilled: true`.
export function replyForRow(row, records, windowMs = MATCH_WINDOW_MS) {
  const prompt = nearestPromptRecord(records, row.ts, windowMs);
  if (prompt === null) {
    return { ...shapeReply(null, "backfill-no-match"), backfilled: true };
  }
  const reply = lastReplyBefore(records, prompt.uuid ?? null);
  if (reply === null) {
    return { ...shapeReply(null, "no-reply"), backfilled: true };
  }
  return { ...shapeReply(reply), backfilled: true };
}

// Everything except `reply`, so a caller can prove nothing else changed.
function withoutReply(row) {
  const { reply, ...rest } = row;
  return rest;
}

// Backfill one row. Pure. Returns the same object when nothing applies, so a
// caller can count untouched rows by identity.
export function backfillRow(row, records, windowMs = MATCH_WINDOW_MS) {
  if (!needsReply(row)) {
    return row;
  }
  const next = { ...row, reply: replyForRow(row, records, windowMs) };
  // Belt and braces: the one thing this pass promises is that it changes
  // nothing but `reply`. Prove it rather than assert it in a comment.
  if (JSON.stringify(withoutReply(next)) !== JSON.stringify(withoutReply(row))) {
    throw new Error(`backfill changed a field other than reply on row ${row.ts}`);
  }
  return next;
}

// Read the transcript for a row, with a small cache so a session with 40 rows
// is read once rather than 40 times.
function transcriptReaderFor(env) {
  const cache = new Map();
  return (row) => {
    if (
      typeof row.runtime === "string" &&
      row.runtime !== "claude-code" &&
      row.runtime !== "codex"
    ) {
      return null;
    }
    const key = `${row.session}|${row.cwd}`;
    if (cache.has(key)) {
      return cache.get(key);
    }
    const file = resolveTranscriptPath(
      { runtime: row.runtime, session_id: row.session, cwd: row.cwd },
      env
    );
    const records = file === null ? null : readTranscript(file);
    const value = records === null || records.length === 0 ? null : records;
    cache.set(key, value);
    return value;
  };
}

// Backfill one corpus file in place. Returns counts and the guard result.
//
// `dryRun` computes everything and writes nothing, so the numbers can be read
// before the ledger is touched.
export function backfillFile(file, options = {}) {
  const env = options.env ?? process.env;
  const windowMs = options.windowMs ?? MATCH_WINDOW_MS;
  const readFor = options.transcriptFor ?? transcriptReaderFor(env);
  const original = fs.readFileSync(file, "utf8");
  const counts = {
    total: 0,
    malformed: 0,
    alreadyHadReply: 0,
    filled: 0,
    noMatch: 0,
    noTranscript: 0,
    noReply: 0,
    skippedRuntime: 0,
  };
  const out = [];
  const before = [];
  const after = [];

  for (const line of original.split("\n")) {
    if (line.trim().length === 0) {
      continue;
    }
    counts.total++;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      counts.malformed++;
      out.push(line);
      continue;
    }
    if (!needsReply(row)) {
      counts.alreadyHadReply++;
      before.push(row);
      after.push(row);
      out.push(JSON.stringify(row));
      continue;
    }
    const records = readFor(row);
    let next;
    if (records === null) {
      if (
        typeof row.runtime === "string" &&
        row.runtime !== "claude-code" &&
        row.runtime !== "codex"
      ) {
        counts.skippedRuntime++;
      } else {
        counts.noTranscript++;
      }
      next = { ...row, reply: { ...shapeReply(null, "no-transcript"), backfilled: true } };
    } else {
      next = backfillRow(row, records, windowMs);
      const reason = next.reply.reason;
      if (next.reply.text) {
        counts.filled++;
      } else if (reason === "backfill-no-match") {
        counts.noMatch++;
      } else {
        counts.noReply++;
      }
    }
    before.push(row);
    after.push(next);
    out.push(JSON.stringify(next));
  }

  // The same guard the rescore uses. Backfill touches only `reply`, so every
  // bucket should read zero movement; if it does not, something else changed.
  const guard = assertDistributionStable(
    distributionOf(before.filter((row) => typeof row.provenance === "string")),
    distributionOf(after.filter((row) => typeof row.provenance === "string")),
    options
  );

  if (options.dryRun) {
    return { file, backup: null, dryRun: true, ...counts, guard };
  }

  const backup = `${file}.bak`;
  if (!fs.existsSync(backup)) {
    fs.writeFileSync(backup, original, "utf8");
  }
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, `${out.join("\n")}\n`, "utf8");
  fs.renameSync(tmp, file);
  return { file, backup, dryRun: false, ...counts, guard };
}

// Backfill every *.jsonl under a corpus directory.
export function backfillCorpus(corpusDir, options = {}) {
  return fs
    .readdirSync(corpusDir)
    .filter((name) => name.endsWith(".jsonl"))
    .map((name) => backfillFile(path.join(corpusDir, name), options));
}
