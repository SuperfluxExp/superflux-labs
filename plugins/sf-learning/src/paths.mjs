// Where the corpus lives, and which runtime a capture came from.
//
// The ledger MUST NOT live inside the plugin directory. A plugin is copied into
// the runtime's plugin cache on install (Claude Code's or Codex's) and that copy is replaced on reinstall, so a
// plugin-relative ledger would be silently destroyed by a routine update. It
// also must not live in the repo: the corpus is raw prompt text, and the repo
// gets committed and pushed.
//
// So it sits at a stable user-level path, overridable with SF_LEARNING_HOME
// (which is also what the tests use).

import os from "node:os";
import path from "node:path";

export function learningHome(env = process.env) {
  return env.SF_LEARNING_HOME || path.join(os.homedir(), ".superflux", "sf-learning");
}

// One file per UTC month. UTC rather than local time so the partition a row
// lands in does not depend on the machine that captured it.
export function corpusFile(home, date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return path.join(home, "corpus", `${year}-${month}.jsonl`);
}

export function errorLog(home) {
  return path.join(home, "capture-errors.log");
}

// Name the runtime from the plugin cache path the hook is running out of.
// Returns "unknown" rather than assuming a default — a wrong runtime label is
// worse than an absent one when comparing style across harnesses.
export function detectRuntime(env = process.env) {
  const root = env.CLAUDE_PLUGIN_ROOT;
  if (typeof root === "string" && root.length > 0) {
    const normalized = root.replace(/\\/g, "/");
    if (/\/\.codex\//.test(normalized)) {
      return "codex";
    }
    if (/\/\.claude\//.test(normalized)) {
      return "claude-code";
    }
  }
  if (env.CLAUDE_PROJECT_DIR) {
    return "claude-code";
  }
  return "unknown";
}
