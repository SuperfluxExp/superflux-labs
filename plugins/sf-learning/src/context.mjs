// Reply context: what the assistant said right before the user's prompt.
//
// Why: capture only sees the user's side. "i am lost" tells us the user was
// lost, not what lost them. To learn from a reaction we need the thing that
// was reacted to. That is the last assistant reply, and it lives in the
// runtime's session transcript on disk — the hook payload does not carry it.
//
// Format facts, verified against a real Claude Code transcript (this plugin's
// own development session), not assumed:
//   - one JSON record per line; records link by `parentUuid`
//   - the user's typed prompt is a `type: "user"` record whose
//     `message.content` is a STRING; tool results are also `type: "user"` but
//     their content is an array of blocks — that is how the two are told apart
//   - assistant text is `type: "assistant"` with `message.content` an array;
//     only `type: "text"` blocks are what the user read — `thinking` and
//     `tool_use` blocks are skipped
//   - one visible reply can span many assistant records with tool calls in
//     between; a long turn is dozens of records deep
//
// The bug the probe caught before this was written: gathering EVERY text
// block on the walk back collects all the interim narration of a tool-heavy
// turn ("now wiring X…"), not the reply the user actually reacted to. So this
// takes the LAST text-bearing assistant record before the prompt, and only
// that one.
//
// Everything here returns null / [] on failure. It runs inside the capture
// hook, and the hook must never break the user's turn.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Read a JSONL transcript. Malformed lines are skipped, order preserved.
export function readTranscript(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    return [];
  }
  const out = [];
  for (const line of raw.split("\n")) {
    if (line.trim().length === 0) {
      continue;
    }
    try {
      out.push(JSON.parse(line));
    } catch {
      // skip
    }
  }
  const isCodexRollout = out.some(
    (record) =>
      record?.type === "response_item" && record.payload?.type === "message"
  );
  return isCodexRollout ? normalizeCodexRecords(out) : out;
}

function codexMessageText(record, contentType) {
  if (!Array.isArray(record?.payload?.content)) {
    return null;
  }
  const parts = record.payload.content
    .filter(
      (block) =>
        block?.type === contentType &&
        typeof block.text === "string" &&
        block.text.length > 0
    )
    .map((block) => block.text);
  return parts.length > 0 ? parts.join("\n\n") : null;
}

// Convert the user-visible parts of a Codex rollout into the small transcript
// shape used by the rest of this module. Commentary is deliberately excluded:
// the user reacts to the completed answer, which Codex marks `phase: "final"`.
function normalizeCodexRecords(records) {
  const normalized = [];
  let latestUserUuid = null;
  let latestAssistantUuid = null;
  for (let index = 0; index < records.length; index++) {
    const record = records[index];
    if (record?.type !== "response_item" || record.payload?.type !== "message") {
      continue;
    }

    const uuid = `codex-${index}`;
    if (record.payload.role === "user") {
      const text = codexMessageText(record, "input_text");
      if (text === null) {
        continue;
      }
      normalized.push({
        uuid,
        parentUuid: latestAssistantUuid,
        type: "user",
        timestamp: record.timestamp ?? null,
        message: { role: "user", content: text },
      });
      latestUserUuid = uuid;
      continue;
    }

    if (
      record.payload.role !== "assistant" ||
      !["final", "final_answer"].includes(record.payload.phase)
    ) {
      continue;
    }
    const text = codexMessageText(record, "output_text");
    if (text === null) {
      continue;
    }
    normalized.push({
      uuid,
      parentUuid: latestUserUuid,
      type: "assistant",
      timestamp: record.timestamp ?? null,
      message: { role: "assistant", content: [{ type: "text", text }] },
    });
    latestAssistantUuid = uuid;
  }
  return normalized;
}

function isHumanPrompt(rec) {
  return rec && rec.type === "user" && typeof rec.message?.content === "string";
}

function assistantText(rec) {
  if (!rec || rec.type !== "assistant" || !Array.isArray(rec.message?.content)) {
    return null;
  }
  const parts = rec.message.content.filter((b) => b && b.type === "text" && typeof b.text === "string" && b.text.length > 0).map((b) => b.text);
  return parts.length > 0 ? parts.join("\n\n") : null;
}

// The last assistant reply before the prompt with `promptUuid`.
// If `promptUuid` is null or not found (the hook can fire before the runtime
// appends the user record), falls back to the newest assistant text in the file.
// Returns { text, ts, uuid } or null.
export function lastReplyBefore(records, promptUuid) {
  if (!Array.isArray(records) || records.length === 0) {
    return null;
  }
  const byUuid = new Map();
  for (const r of records) {
    if (r && r.uuid) {
      byUuid.set(r.uuid, r);
    }
  }

  const start = promptUuid ? byUuid.get(promptUuid) : null;

  if (start) {
    // Walk parentUuid back. Stop at the previous human prompt. Return the
    // first (i.e. most recent) assistant record that carries text.
    let cur = byUuid.get(start.parentUuid);
    let hops = 0;
    while (cur && hops < 500) {
      hops++;
      if (isHumanPrompt(cur)) {
        return null;
      }
      const t = assistantText(cur);
      if (t !== null) {
        return { text: t, ts: cur.timestamp ?? null, uuid: cur.uuid ?? null };
      }
      cur = byUuid.get(cur.parentUuid);
    }
    return null;
  }

  // Fallback: newest assistant text in file order.
  for (let i = records.length - 1; i >= 0; i--) {
    const t = assistantText(records[i]);
    if (t !== null) {
      return { text: t, ts: records[i].timestamp ?? null, uuid: records[i].uuid ?? null };
    }
  }
  return null;
}

// Claude Code encodes the project cwd into a directory name under
// the Claude Code projects folder by replacing every non-alphanumeric run with "-".
// Verified: "C:\work\src\sf\x" -> "C--work-src-sf-x".
function encodeCwd(cwd) {
  return String(cwd).replace(/[^A-Za-z0-9]/g, "-");
}

function isCodexInput(input, env) {
  if (input?.runtime === "codex") {
    return true;
  }
  const pluginRoot = env.CLAUDE_PLUGIN_ROOT;
  return (
    typeof pluginRoot === "string" &&
    /\/\.codex\//.test(pluginRoot.replace(/\\/g, "/"))
  );
}

function findCodexRollout(sessionsDir, sessionId) {
  const stack = [{ dir: sessionsDir, depth: 0 }];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current.dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const candidate = path.join(current.dir, entry.name);
      if (
        entry.isFile() &&
        entry.name.endsWith(`-${sessionId}.jsonl`)
      ) {
        return candidate;
      }
      if (entry.isDirectory() && current.depth < 3) {
        stack.push({ dir: candidate, depth: current.depth + 1 });
      }
    }
  }
  return null;
}

// Where the transcript is. Prefers `transcript_path` from the hook payload;
// otherwise derives it from session_id + cwd. Returns null if it cannot.
export function resolveTranscriptPath(input, env = process.env) {
  if (typeof input?.transcript_path === "string" && input.transcript_path.length > 0) {
    return input.transcript_path;
  }
  const sessionId = input?.session_id;
  const cwd = input?.cwd;
  if (typeof sessionId !== "string" || sessionId.length === 0) {
    return null;
  }
  if (isCodexInput(input, env)) {
    const sessions =
      env.CODEX_SESSIONS_DIR ||
      path.join(env.CODEX_HOME || path.join(os.homedir(), ".codex"), "sessions");
    return findCodexRollout(sessions, sessionId);
  }
  if (typeof cwd !== "string" || cwd.length === 0) {
    return null;
  }
  const projects = env.CLAUDE_PROJECTS_DIR || path.join(os.homedir(), ".claude", "projects");
  const candidate = path.join(projects, encodeCwd(cwd), `${sessionId}.jsonl`);
  return fs.existsSync(candidate) ? candidate : null;
}
