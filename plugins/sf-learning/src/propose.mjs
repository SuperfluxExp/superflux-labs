// Applying an approved observation to a skill file.
//
// This is the only code in the plugin that writes to a SKILL.md, and it is
// deliberately hard to misuse. "It never edits a skill file directly" has been
// in the README since the first commit; until now nothing enforced it.
//
// Three refusals, in the order they fire:
//
//   1. Wrong branch. Writing only happens on a branch named
//      `sf-learning/propose-*`. On any other branch — main above all — the pass
//      stops before reading anything.
//   2. The quote is not exactly where it claims to be. A refine replaces text it
//      quoted from the file. If that text is missing, or appears more than once,
//      the change is refused rather than applied to a guess.
//   3. A new rule with nowhere to go. A rule that is genuinely missing has no
//      quoted text to replace, so the caller must say what it goes after. There
//      is no default position, because a rule dropped in the wrong section is a
//      rule nobody will find.
//
// Matching ignores how the text is wrapped, because a rule quoted out of the
// file almost always spans two lines, but it is otherwise exact.
//
// A refine ADDS its sentence after the paragraph holding the rule it sharpens.
// It does not replace it. The first real proposal proved why: replacing the
// quoted span deleted "Do not replace them with implementation shorthand" and
// "keep the six resume facts in one compact recap block" — rules the new text
// never claimed to cover — and, where the quote stopped mid-sentence, left the
// remaining half stranded on its own line. The quote marks WHERE the rule lives.
// It is not a licence to delete what it quoted. Removing text is the
// consolidation pass's job, and that is reviewed on its own.

const WRAP_AT = 88;

export class ProposeRefused extends Error {
  constructor(message) {
    super(message);
    this.name = "ProposeRefused";
  }
}

export function assertProposeBranch(branch) {
  if (typeof branch !== "string" || !/^sf-learning\/propose-/.test(branch)) {
    throw new ProposeRefused(
      `refusing to write a skill file from branch "${branch ?? "unknown"}" — ` +
        "this only runs on an sf-learning/propose-* branch, so a skill change can never land straight on main"
    );
  }
  return true;
}

// Find `quote` in `text` while allowing whitespace wrapping, Markdown emphasis
// around a token, and a source colon immediately after an unpunctuated final
// quote token. Preserve all other punctuation so a changed sentence cannot
// satisfy an approved quote.
export function findFlexible(text, quote) {
  const stripMarkdown = (value) =>
    String(value).replace(/^[*_`~]+|[*_`~]+$/g, "");
  const wanted = String(quote).trim().split(/\s+/).map(stripMarkdown).filter(Boolean);
  if (wanted.length === 0) {
    return null;
  }
  // Walk the source as a token stream, remembering where each token started and
  // ended, so a match can be mapped back to real offsets.
  const tokens = [];
  const re = /\S+/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    const value = stripMarkdown(match[0]);
    if (!value) {
      continue;
    }
    tokens.push({
      value,
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  const spans = [];
  for (let i = 0; i + wanted.length <= tokens.length; i++) {
    let hit = true;
    for (let j = 0; j < wanted.length; j++) {
      const sourceToken = tokens[i + j].value;
      const quoteToken = wanted[j];
      const finalTokenWithSourceColon = j === wanted.length - 1
        && /[A-Za-z0-9]$/.test(quoteToken)
        && sourceToken === `${quoteToken}:`;
      if (sourceToken !== quoteToken && !finalTokenWithSourceColon) {
        hit = false;
        break;
      }
    }
    if (hit) {
      spans.push({ start: tokens[i].start, end: tokens[i + wanted.length - 1].end });
    }
  }
  return spans;
}

// Wrap to the file's column, keeping the indentation the replaced text had.
export function wrapAt(textToWrap, indent = "", width = WRAP_AT) {
  const words = String(textToWrap).trim().split(/\s+/);
  const lines = [];
  let line = indent;
  for (const word of words) {
    if (line.trim().length > 0 && `${line} ${word}`.length > width) {
      lines.push(line);
      line = `${indent}${word}`;
    } else {
      line = line.trim().length === 0 ? `${indent}${word}` : `${line} ${word}`;
    }
  }
  if (line.trim().length > 0) {
    lines.push(line);
  }
  return lines.join("\n");
}

// Put `addition` in its own paragraph after the one holding `span`. Working at
// paragraph level rather than inside a sentence is what stops a wrapped rule
// from being cut in half.
export function insertAfterParagraph(text, span, addition) {
  const blank = text.indexOf("\n\n", span.end);
  if (blank === -1) {
    // The rule is the last paragraph. Trim the trailing newlines first,
    // otherwise the file ends up with a blank line too many.
    return `${text.replace(/\s+$/, "")}\n\n${wrapAt(addition)}\n`;
  }
  return `${text.slice(0, blank)}\n\n${wrapAt(addition)}${text.slice(blank)}`;
}

// Apply one observation to the skill text. Pure: returns the new text.
export function applyToSkill(skillText, observation, options = {}) {
  if (observation.verdict === "refine") {
    const spans = findFlexible(skillText, observation.existing_rule_quote);
    if (!spans || spans.length === 0) {
      throw new ProposeRefused(
        `${observation.id}: the text it quotes is not in the skill file, so there is nothing to replace. ` +
          "The skill changed since the observation was recorded — re-read it before proposing again."
      );
    }
    if (spans.length > 1) {
      throw new ProposeRefused(
        `${observation.id}: the quoted text appears ${spans.length} times, so which one to replace is a guess. Refusing.`
      );
    }
    return insertAfterParagraph(skillText, spans[0], observation.rule_text);
  }

  if (observation.verdict === "new") {
    const anchor = options.after;
    if (!anchor) {
      throw new ProposeRefused(
        `${observation.id}: a new rule needs somewhere to go. Pass the text it should follow — ` +
          "there is no default position, because a rule in the wrong section is a rule nobody finds."
      );
    }
    const spans = findFlexible(skillText, anchor);
    if (!spans || spans.length !== 1) {
      throw new ProposeRefused(
        `${observation.id}: the anchor text was found ${spans ? spans.length : 0} times; it has to match exactly once.`
      );
    }
    return insertAfterParagraph(skillText, spans[0], observation.rule_text);
  }

  throw new ProposeRefused(
    `${observation.id}: verdict "${observation.verdict}" never produces a diff. ` +
      "example records evidence and changes nothing; drop records nothing at all."
  );
}

// Mark the record as proposed. Pure.
export function markProposed(observation, meta) {
  return {
    ...observation,
    status: "proposed",
    proposed_at: meta.now,
    proposal: { branch: meta.branch, approved_by: "user" },
  };
}

// Record that the user asked to keep collecting instead. Pure.
export function markDeferred(observation, meta) {
  return {
    ...observation,
    status: "open",
    deferred_at: meta.now,
    deferred_by: "user",
  };
}
