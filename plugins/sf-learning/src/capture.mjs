// Build and append one corpus row per user prompt.
//
// Error policy — this is the one place in the plugin that deliberately swallows
// a failure. The capture hook runs on the prompt-submit path in a live session.
// If it throws, the user loses their turn. So runCaptureHook() catches
// everything and exits 0, but it is NOT a silent fallback: the failure is
// written to capture-errors.log with its stack, so a broken capture is
// diagnosable rather than invisible. Only if the error log itself cannot be
// written does the failure go unrecorded, and by then the disk is the problem.
//
// Everything above runCaptureHook is pure or plainly IO, and throws normally.

import fs from "node:fs";
import path from "node:path";

import { CLASSIFIER_VERSION, isComprehension, isCorrection, isSlashCommand } from "./classify.mjs";
import { lastReplyBefore, readTranscript, resolveTranscriptPath } from "./context.mjs";
import { corpusFile, detectRuntime, errorLog, learningHome } from "./paths.mjs";
import { classifyProvenance } from "./provenance.mjs";
import { redact } from "./redact.mjs";

// A prompt longer than this is a paste, not writing. The overflow is dropped
// from the stored text because it would swamp the style profile with material
// the user did not write, but `chars` keeps the true length so the row is still
// honest about what came in.
export const MAX_TEXT = 4000;

// The assistant's reply is stored so a reaction can be tied to what caused it.
// Replies are long (this session's median is in the thousands of chars) and
// the user reacts to what they read first, so the head is kept and the true
// length recorded. Same redaction as the prompt: replies quote things back.
export const MAX_REPLY = 3000;

// Shape a raw reply into what gets stored on the row. Pure. `null` in → a
// row that says plainly there was no reply, with the reason, so an absent
// reply is never mistaken for an empty one.
export function shapeReply(reply, reason = null) {
  if (!reply || typeof reply.text !== "string" || reply.text.length === 0) {
    return { text: null, chars: 0, truncated: false, ts: null, reason: reason ?? "no-reply" };
  }
  const redacted = redact(reply.text);
  const truncated = redacted.length > MAX_REPLY;
  return {
    text: truncated ? redacted.slice(0, MAX_REPLY) : redacted,
    chars: redacted.length,
    truncated,
    ts: reply.ts ?? null,
    reason: null,
  };
}

// Pure. Returns null when there is nothing worth storing.
//
// Order is load-bearing: redact → provenance → truncate. Provenance must see
// the whole redacted prompt, because a wrapper's closing tag can sit past the
// truncation cap; truncating first would turn a "wrapped" row into a bogus
// "machine" one and lose the user's prompt. Redaction runs first so no secret
// is ever held in an intermediate we go on to store.
//
// `reply` is looked up by the caller (it is IO); this stays pure.
export function buildRecord(input, { now, env, reply = null }) {
  const raw = typeof input?.prompt === "string" ? input.prompt : "";
  if (raw.trim().length === 0) {
    return null;
  }

  const redacted = redact(raw);
  const { provenance, text: extracted, wrapper } = classifyProvenance(redacted);
  const truncated = extracted.length > MAX_TEXT;
  const text = truncated ? extracted.slice(0, MAX_TEXT) : extracted;

  return {
    ts: now.toISOString(),
    runtime: detectRuntime(env),
    session: typeof input.session_id === "string" ? input.session_id : null,
    cwd: typeof input.cwd === "string" ? input.cwd : null,
    provenance,
    wrapper,
    // `chars` is the length of the HUMAN text (post-extraction, pre-truncation),
    // so it means the same thing on human, wrapped and machine rows.
    chars: extracted.length,
    // How much the whole payload was, so wrapper bloat stays measurable.
    raw_chars: redacted.length,
    truncated,
    // Classified from the STORED text, not the raw prompt, so that re-scoring a
    // row later from the ledger alone reproduces the same answer. Machine rows
    // have empty text and therefore never classify as anything.
    is_correction: isCorrection(text),
    is_comprehension: isComprehension(text),
    is_slash_command: isSlashCommand(text),
    clf: CLASSIFIER_VERSION,
    text,
    // What the assistant said right before this prompt. Present on every row
    // (with text: null and a reason when there is none) so a consumer can
    // always tell "no reply captured" from "reply was empty".
    reply: reply ?? shapeReply(null),
  };
}

// Find the assistant's last reply for this prompt from the session transcript.
// Returns a shaped reply object; never throws. Reasons a reply can be absent:
//   no-transcript   the path could not be resolved or the file is unreadable
//   no-reply        the transcript has no assistant text before this prompt
//                   (normally the first prompt of a session)
export function lookupReply(input, env) {
  const file = resolveTranscriptPath(
    { ...input, runtime: detectRuntime(env) },
    env
  );
  if (file === null) {
    return shapeReply(null, "no-transcript");
  }
  const records = readTranscript(file);
  if (records.length === 0) {
    return shapeReply(null, "no-transcript");
  }
  // The hook fires before the runtime appends the user record, so the prompt's
  // own uuid is not in the file yet; lastReplyBefore falls back to the newest
  // assistant text, which is exactly the reply the user just read.
  return shapeReply(lastReplyBefore(records, null));
}

// Appends one JSON line. JSON.stringify escapes newlines, so a multi-line prompt
// stays a single JSONL row.
export function captureFromInput(input, { now, env }) {
  const record = buildRecord(input, { now, env, reply: lookupReply(input, env) });
  if (record === null) {
    return { written: false, file: null };
  }

  const file = corpusFile(learningHome(env), now);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(record)}\n`, "utf8");
  return { written: true, file };
}

function readStdin() {
  try {
    const raw = fs.readFileSync(0, "utf8");
    if (!raw || raw.trim().length === 0) {
      return null;
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function recordFailure(env, error) {
  try {
    const file = errorLog(learningHome(env));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${new Date().toISOString()} ${error?.stack || error}\n`, "utf8");
  } catch {
    // The ledger location itself is unwritable. Nothing left to write to.
  }
}

// The hook entry point. Never prints, never exits non-zero.
export function runCaptureHook(env = process.env, now = new Date()) {
  try {
    const input = readStdin();
    if (input === null || typeof input !== "object") {
      return;
    }
    captureFromInput(input, { now, env });
  } catch (error) {
    recordFailure(env, error);
  }
}
