// Provenance: did the user actually type this, or did the runtime?
//
// A UserPromptSubmit payload is not always the user's words. Two weeks of real
// capture showed 29% of rows were runtime-injected text: ambient browser
// state, task-completion notices, subagent prompts, a scheduled agent's system
// prompt. Some of those wrappers CONTAIN the user's prompt after the block;
// others carry no human text at all. Both would poison a style profile, and
// the correction classifier fired on half of them.
//
// So every prompt gets one of three provenance values, and the human text is
// EXTRACTED from wrappers rather than the whole row being dropped:
//   human   — clean prompt, stored as-is
//   wrapped — a known runtime block followed by the user's prompt; only the
//             prompt is stored, and `wrapper` names what was stripped
//   machine — no human text; kept for counting, excluded from both streams
//
// Conservative by design: an unrecognised angle-bracket block at the very
// start of the text is machine. A false "machine" costs one observation; a
// false "human" puts runtime text into the user's voice profile.

// Wrappers that carry the user's prompt AFTER the block. Order matters only
// for `wrapper` naming; each is tried against the start of the text.
const WRAPPED = [
  {
    name: "in-app-browser-context",
    open: /^\s*<in-app-browser-context\b/,
    split: "</in-app-browser-context>",
  },
  {
    name: "system-reminder",
    open: /^\s*<system-reminder>/,
    split: "</system-reminder>",
  },
  {
    name: "files-mentioned",
    open: /^\s*# Files mentioned by the user:/,
    split: "## My request:",
  },
];

// Pure machine text. No human prompt inside.
const MACHINE = [
  { name: "task-notification", rx: /^\s*<task-notification>/ },
  { name: "task", rx: /^\s*<task>/ },
  { name: "codex-delegation", rx: /^\s*<codex_delegation>/ },
  { name: "codex-suggestions-prompt", rx: /^\s*# Overview\s*\n+\s*Generate 0 to 3 hyperpersonalized suggestions/ },
  { name: "attach-block", rx: /^\s*<!-- attach -->/ },
  { name: "json-payload", rx: /^\s*[[{]\s*\n?\s*["[{]/ },
];

// Any other angle-bracket block right at the start. Runtimes add new
// wrappers; the safe default for one we have not seen is machine.
const UNKNOWN_BLOCK = /^\s*<[a-z][a-z0-9_-]*(\s[^>]*)?>/i;

// A "## My request:" marker sometimes appears AFTER an in-app-browser block.
// Strip it so the stored text starts at the user's first word.
const REQUEST_MARKER = /^\s*## My request:\s*/;

function machine(wrapper) {
  return { provenance: "machine", text: "", wrapper };
}

// Returns { provenance, text, wrapper }. Never throws.
export function classifyProvenance(raw) {
  if (typeof raw !== "string") {
    return machine(null);
  }

  for (const w of WRAPPED) {
    if (!w.open.test(raw)) {
      continue;
    }
    const idx = raw.indexOf(w.split);
    if (idx === -1) {
      // Opened but never closed — a truncated wrapper. No reliable human text.
      return machine(w.name);
    }
    const after = raw.slice(idx + w.split.length).replace(REQUEST_MARKER, "").trim();
    if (after.length === 0) {
      return machine(w.name);
    }
    return { provenance: "wrapped", text: after, wrapper: w.name };
  }

  for (const m of MACHINE) {
    if (m.rx.test(raw)) {
      return machine(m.name);
    }
  }

  if (UNKNOWN_BLOCK.test(raw)) {
    return machine("unknown-block");
  }

  return { provenance: "human", text: raw, wrapper: null };
}
