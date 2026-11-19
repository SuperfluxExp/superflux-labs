// Cheap deterministic tagging of a captured prompt.
//
// This is the stream-1 / stream-2 split: every human prompt feeds the style
// corpus, but only corrections are candidates for rule proposals. Tags are
// stored on the row so the ledger stays greppable, and CLASSIFIER_VERSION is
// stored beside them so a later pass can find rows scored by an older rule set
// and re-score them.
//
// v2 (after two weeks of real capture): the v1 pattern fired on `dont` and
// `actually` regardless of what they were about, and half its hits were on
// runtime-injected text. v2 assumes the caller has already stripped wrappers
// (see provenance.mjs) and splits the signal in two:
//   is_correction    — pushback or redirection ("no", "not what i wanted",
//                      "revert", "instead")
//   is_comprehension — the user could not follow ("i am lost", "too dense",
//                      "wall of text", "what do you mean")
// A row can be both. Comprehension is the signal cognitive-render and
// explaining-with-html learn from; pushback mostly routes to the decision
// trace. Both remain deliberately conservative: a false positive pollutes the
// stream that can change a skill file, a miss costs one observation.

export const CLASSIFIER_VERSION = 3;

const CORRECTION = new RegExp(
  [
    "(?:^|[\\s(])no[,.]?\\s",
    "^\\s*no\\b",
    "\\bnope\\b",
    "that'?s\\s+(?:wrong|not\\s+right|incorrect|not\\s+what)",
    "that'?s\\s+(?:being\\s+)?too\\b",
    "\\bnot\\s+what\\s+i\\s+(?:wanted|asked|meant|said)\\b",
    "\\bthis\\s+is\\s+not\\s+what\\s+i\\b",
    "\\bmy\\s+bad\\b",
    "\\bi\\s+misread\\b",
    "\\bwrong\\s+(?:screenshot|file|branch|pr|ticket|answer)\\b",
    "\\binstead\\s+of\\b",
    "\\bactually[,]?\\s+(?:i|we|no|let|what|the)\\b",
    "\\b(?:don'?t|do\\s+not)\\s+(?:write|do|use|add|make|create|touch|turn|need|want|think)\\b",
    "\\bdoesn'?t\\s+(?:work|make\\s+sense)\\b",
    "\\bstop\\b",
    "\\bundo\\b",
    "\\brevert\\b",
    "\\btry\\s+again\\b",
    "\\bnot\\s+(?:correct|right)\\b",
    "\\bthat'?s\\s+being\\s+too\\b",
    "\\btoo\\s+conservative\\b",
    // Tolerant of the user's typos and dropped apostrophes ("aboslutely",
    // "its annoying"): an optional adverb-shaped word, then the verb.
    "\\bi\\s+(?:\\w+ly\\s+)?(?:hate|dislike)\\b",
    "\\b(?:this|that|it|its|it'?s|this\\s+one)\\s+(?:is\\s+|too\\s+)?(?:annoying|irritating)\\b",
    "\\bstop\\s+(?:using|saying|doing)\\b",
  ].join("|"),
  "i"
);

const COMPREHENSION = new RegExp(
  [
    "\\b(?:i'?m|i\\s+am)\\s+(?:a\\s+little\\s+|totally\\s+|completely\\s+)?lost\\b",
    "\\b(?:i\\s+)?(?:don'?t|do\\s+not|dont)\\s+(?:fully\\s+)?understand\\b",
    "\\bnot\\s+(?:parsing|following)\\b",
    "\\bhard\\s+to\\s+(?:read|interpret|follow|understand|parse)\\b",
    "\\bwhat\\s+do\\s+you\\s+mean\\b",
    "\\bwhat\\s+is\\s+this\\b",
    "\\bexplain\\s+(?:this|it|that|simply|to\\s+me|in\\s+plain)\\b",
    "\\bhelp\\s+me\\s+(?:parse|understand)\\b",
    "\\bwall\\s+of\\s+text\\b",
    "\\btoo\\s+(?:dense|terse|verbose|long|much\\s+text)\\b",
    "\\bin\\s+plain\\s+(?:terms|english|language|words)\\b",
    "\\b(?:crisp|concise)\\s+(?:and\\s+)?(?:concise|clear|crisp)\\b",
    "\\bno\\s+clue\\b",
    "\\bmake(?:s)?\\s+no\\s+sense\\b",
    "\\b(?:doesn'?t|dont|don'?t)\\s+make\\s+sense\\b",
    "\\bword\\s+salad\\b",
    "\\bnot\\s+sure\\s+what\\b",
  ].join("|"),
  "i"
);

const SLASH_COMMAND = /^\s*\/[A-Za-z]/;

// True when the prompt reads as the user pushing back or redirecting.
export function isCorrection(text) {
  if (typeof text !== "string") {
    return false;
  }
  return CORRECTION.test(text);
}

// True when the prompt says the user could not follow the previous output.
// This is the stream-2 signal for the comprehension skills.
export function isComprehension(text) {
  if (typeof text !== "string") {
    return false;
  }
  return COMPREHENSION.test(text);
}

// True when the prompt is a slash-command invocation rather than prose. Such
// rows are kept (they are real turns) but carry no style signal, so the style
// profile pass filters them out.
export function isSlashCommand(text) {
  if (typeof text !== "string") {
    return false;
  }
  return SLASH_COMMAND.test(text);
}
