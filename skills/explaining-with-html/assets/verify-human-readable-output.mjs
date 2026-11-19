import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const adaptationPath = path.resolve(
  __dirname,
  "../references/stop-slop-rules.json",
);
const stopSlopAdaptation = JSON.parse(
  fs.readFileSync(adaptationPath, "utf8"),
);
const contextSchema = "superflux.human_readable_output_context.v0.1";
// The resume is three blocks: one status line, two columns, one ask. Three of
// the old six labels — when we last worked, where we stopped, what changed
// since — are the same question in three tenses, so they belong in one
// sentence. The reader reported the six-card version as redundant and slow to
// scan, and nothing in it carried more weight than anything else.
const resumeLabels = [
  "picking up",
  "already done",
  "still open",
  "need from you",
];

// The six-label shape every page used until 2026-10. It is still accepted
// because pages written in that shape still exist, and re-checking them under a
// new rule would assert a verification that never ran. New pages get
// the three-block shape: the template and both skills teach only that. This
// branch can be deleted once the remaining pages are migrated.
const legacyResumeLabels = [
  "when we last worked",
  "where we stopped",
  "what is already done",
  "what remains open",
  "what changed since",
  "what you need from",
];

function normalize(value) {
  return value
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function lineNumberAt(text, index) {
  return text.slice(0, Math.max(0, index)).split(/\r?\n/).length;
}

function finding(code, message, line, excerpt = "") {
  return {
    code,
    message,
    line,
    excerpt: excerpt.trim().slice(0, 180),
  };
}

function assertStringArray(value, fieldName) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`${fieldName} must be an array of strings`);
  }
}

function validateContext(context) {
  if (context?.schema !== contextSchema) {
    throw new Error(`context.schema must be ${contextSchema}`);
  }
  if (typeof context.document?.kind !== "string") {
    throw new Error("context.document.kind must be a string");
  }
  if (typeof context.document?.presentsUi !== "boolean") {
    throw new Error("context.document.presentsUi must be a boolean");
  }
  if (!Number.isFinite(context.reader?.timeAwayHours)) {
    throw new Error("context.reader.timeAwayHours must be a number");
  }
  if (!Number.isFinite(context.reader?.attentionBudgetMinutes)) {
    throw new Error("context.reader.attentionBudgetMinutes must be a number");
  }
  if (context.reader.attentionBudgetMinutes <= 0) {
    throw new Error("context.reader.attentionBudgetMinutes must be greater than zero");
  }
  if (!Array.isArray(context.reader?.keyPoints)) {
    throw new Error("context.reader.keyPoints must be an array");
  }
  if (!Array.isArray(context.reader?.unseenChanges)) {
    throw new Error("context.reader.unseenChanges must be an array");
  }
  for (const [index, entry] of context.reader.keyPoints.entries()) {
    if (typeof entry?.readerPhrase !== "string" || entry.readerPhrase.trim() === "") {
      throw new Error(`context.reader.keyPoints[${index}].readerPhrase is required`);
    }
  }
  for (const [index, entry] of context.reader.unseenChanges.entries()) {
    if (typeof entry?.readerPhrase !== "string" || entry.readerPhrase.trim() === "") {
      throw new Error(`context.reader.unseenChanges[${index}].readerPhrase is required`);
    }
    if (typeof entry?.evidence !== "string" || entry.evidence.trim() === "") {
      throw new Error(`context.reader.unseenChanges[${index}].evidence is required`);
    }
  }
  for (const fieldName of ["conversation", "product", "repository", "forbidden"]) {
    assertStringArray(
      context.terminology?.[fieldName],
      `context.terminology.${fieldName}`,
    );
  }
  const knownTermCount = [
    ...context.terminology.conversation,
    ...context.terminology.product,
    ...context.terminology.repository,
  ].length;
  if (knownTermCount === 0) {
    throw new Error("context.terminology must contain conversation, product, or repository terms");
  }
}

function decodeHtml(text) {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function blankEmbeddedHtmlBlocks(text) {
  return text.replace(
    /<(script|style|pre)\b[\s\S]*?<\/\1>/gi,
    (value) => value.replace(/[^\r\n]/g, " "),
  );
}

function readableLines(text) {
  const state = {
    fenced: false,
  };
  const results = [];
  const readableText = blankEmbeddedHtmlBlocks(text).replace(
    /<\/(?:text|tspan)>/gi,
    "$&\n",
  );
  for (const [index, originalLine] of readableText.split(/\r?\n/).entries()) {
    const trimmed = originalLine.trim();
    if (/^```/.test(trimmed)) {
      state.fenced = !state.fenced;
      continue;
    }
    if (state.fenced) {
      continue;
    }
    const withoutInlineCode = originalLine
      .replace(/`[^`]*`/g, " ")
      .replace(/<code\b[^>]*>[\s\S]*?<\/code>/gi, " ");
    const plain = decodeHtml(withoutInlineCode.replace(/<[^>]+>/g, " "))
      .replace(/^\s*(?:#{1,6}|[-*+]\s|\d+\.\s|>\s*)/, "")
      .replace(/\*\*/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (plain !== "") {
      results.push({ line: index + 1, text: plain });
    }
  }
  return results;
}

function removeHtmlDepth(text) {
  return text
    .replace(/<details\b[\s\S]*?<\/details>/gi, " ")
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, " ")
    .replace(/<(?:script|style|pre)\b[\s\S]*?<\/(?:script|style|pre)>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function removeMarkdownDepth(text) {
  const evidenceHeading = text.search(
    /^#{1,3}\s+(?:Evidence|Technical details?|Implementation evidence)\b/im,
  );
  const withoutDepth = evidenceHeading >= 0 ? text.slice(0, evidenceHeading) : text;
  return withoutDepth
    .replace(/<details\b[\s\S]*?<\/details>/gi, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ");
}

function visibleSpine(text) {
  const looksLikeHtml = /<!doctype html|<html\b|<body\b/i.test(text);
  return decodeHtml(
    looksLikeHtml ? removeHtmlDepth(text) : removeMarkdownDepth(text),
  ).replace(/\s+/g, " ").trim();
}

function addLineChecks(text, context, findings) {
  const knownTerms = [
    ...context.terminology.conversation,
    ...context.terminology.product,
    ...context.terminology.repository,
  ].map(normalize);
  // `adopted` holds rules taken from upstream stop-slop and `localAdditions`
  // holds Superflux's own. The rules file keeps them apart for the upstream
  // review; a page fails the same way on either.
  const forbiddenTerms = [
    ...context.terminology.forbidden,
    ...stopSlopAdaptation.localAdditions.compressedLabels,
  ];
  const slopPhrases = [
    ...stopSlopAdaptation.adopted.phrases,
    ...stopSlopAdaptation.localAdditions.phrases,
  ];
  for (const entry of readableLines(text)) {
    const normalizedLine = normalize(entry.text);
    for (const phrase of slopPhrases) {
      if (normalizedLine.includes(normalize(phrase))) {
        findings.push(finding(
          "slop_phrase",
          `Remove the stop-slop phrase: ${phrase}`,
          entry.line,
          entry.text,
        ));
      }
    }
    for (const term of forbiddenTerms) {
      const normalizedTerm = normalize(term);
      if (
        normalizedLine.includes(normalizedTerm)
        && !knownTerms.includes(normalizedTerm)
      ) {
        findings.push(finding(
          "ungrounded_term",
          `Replace or ground the invented label: ${term}`,
          entry.line,
          entry.text,
        ));
      }
    }
    if (
      /\bnot because\b.{0,100}\bbecause\b/i.test(entry.text)
      || /\b(?:the answer|the problem|the question) isn['’]t\b.{0,100}\bit['’]?s\b/i.test(entry.text)
      || /\bnot\b[^.?!]{0,70}\b(?:but|it['’]?s)\b/i.test(entry.text)
    ) {
      findings.push(finding(
        "formulaic_contrast",
        "State the conclusion directly instead of using a setup-and-reveal contrast.",
        entry.line,
        entry.text,
      ));
    }
    const fragments = entry.text
      .split(/[.!?]+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence !== "")
      .filter((sentence) => sentence.split(/\s+/).length <= 3);
    if (fragments.length >= 3) {
      findings.push(finding(
        "jagged_flow",
        "Join or unfold the short fragments so the thought reads as one cohesive passage.",
        entry.line,
        entry.text,
      ));
    }
    const longSentences = entry.text
      .split(/[.!?]+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.split(/\s+/).length > 38);
    if (longSentences.length > 0) {
      findings.push(finding(
        "compressed_sentence",
        "Split the sentence without removing its actor, condition, or result.",
        entry.line,
        longSentences[0],
      ));
    }
  }
}

function addReaderContextChecks(text, context, findings) {
  const normalizedText = normalize(readableLines(text).map((entry) => entry.text).join(" "));
  const visibleWords = visibleSpine(text)
    .split(/\s+/)
    .filter((word) => word !== "");
  const visibleWordBudget = Math.floor(context.reader.attentionBudgetMinutes * 220);
  if (visibleWords.length > visibleWordBudget) {
    findings.push(finding(
      "reader_budget_exceeded",
      `The visible readout has ${visibleWords.length} words for a ${context.reader.attentionBudgetMinutes}-minute attention budget (${visibleWordBudget} words). Move supporting detail behind progressive disclosure.`,
      1,
    ));
  }
  if (context.reader.keyPoints.length > 4) {
    findings.push(finding(
      "reader_load_exceeded",
      "Keep the visible readout to no more than four new points, then layer supporting detail.",
      1,
    ));
  }
  for (const keyPoint of context.reader.keyPoints) {
    if (!normalizedText.includes(normalize(keyPoint.readerPhrase))) {
      findings.push(finding(
        "missing_key_point",
        `The draft does not state the planned reader outcome: ${keyPoint.readerPhrase}`,
        1,
      ));
    }
  }
  for (const unseenChange of context.reader.unseenChanges) {
    if (!normalizedText.includes(normalize(unseenChange.readerPhrase))) {
      findings.push(finding(
        "missing_unseen_outcome",
        `Explain unseen work as a human-visible outcome: ${unseenChange.readerPhrase}`,
        1,
      ));
    }
  }
  if (context.reader.timeAwayHours >= 4) {
    const missingLabels = resumeLabels.filter((label) => !normalizedText.includes(label));
    const missingLegacy = legacyResumeLabels.filter((label) => !normalizedText.includes(label));
    // Either shape satisfies the gate. A page is only missing its reader reset
    // when it carries neither.
    if (missingLabels.length > 0 && missingLegacy.length > 0) {
      findings.push(finding(
        "missing_reader_reset",
        `Work resumed after ${context.reader.timeAwayHours} hours. Add a resume: one status line, two columns ` +
          `(already done, still open), one ask. Missing: ${missingLabels.join(", ")}.`,
        1,
      ));
    }
  }
}

function addVisibleDetailChecks(text, findings) {
  const spine = visibleSpine(text);
  const checks = [
    {
      code: "visible_commit_hash",
      message: "Move commit hashes into supporting evidence and explain the human-visible change first.",
      pattern: /\b[0-9a-f]{7,40}\b/i,
    },
    {
      code: "visible_file_coordinate",
      message: "Move file and line coordinates into supporting evidence.",
      pattern: /\b(?:[\w.-]+[\\/])?[\w.-]+\.(?:css|go|html|java|js|json|md|mjs|py|rs|ts|tsx|ya?ml):\d+\b/i,
    },
    {
      code: "visible_raw_error",
      message: "Explain what failed in product terms and move the raw error into supporting evidence.",
      pattern: /\b(?:error|exception|traceback):\s*\S/i,
    },
  ];
  for (const check of checks) {
    const match = spine.match(check.pattern);
    if (match !== null) {
      const sourceIndex = text.search(check.pattern);
      findings.push(finding(
        check.code,
        check.message,
        lineNumberAt(text, sourceIndex),
        match[0],
      ));
    }
  }
  const blankButKeepLines = (value) => value.replace(/[^\r\n]/g, " ");
  const paragraphSource = text
    .replace(
      /<(script|style|svg|pre)\b[\s\S]*?<\/\1>/gi,
      blankButKeepLines,
    )
    .replace(/```[\s\S]*?```/g, blankButKeepLines)
    .replace(/<[^>]+>/g, (value) => " ".repeat(value.length))
    .replace(/`[^`]*`/g, (value) => " ".repeat(value.length));
  const visibleParagraphs = paragraphSource
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== "");
  for (const paragraph of visibleParagraphs) {
    if (paragraph.split(/\s+/).length > 140) {
      const paragraphIndex = paragraphSource.indexOf(paragraph);
      findings.push(finding(
        "visible_wall_of_text",
        "Break the visible wall into a short readout and supporting detail.",
        lineNumberAt(text, paragraphIndex),
        paragraph,
      ));
    }
  }
}

function addDocumentShapeChecks(text, context, findings) {
  const documentKind = normalize(context.document.kind);
  if (["spec", "rca"].includes(documentKind)) {
    const visualRoles = "architecture|component-deployment|request-sequence|ownership|decision-tree|workflow|comparison-table|timeline|before-after|swimlane|cause-effect|ui-mockup";
    const hasMarkedHtmlVisual = new RegExp(
      `<(?:figure|svg|table|section|div|pre)\\b[^>]*data-visual-role\\s*=\\s*["'](?:${visualRoles})["']`,
      "i",
    ).test(text);
    const hasLegacyArchitectureVisual = (
      /data-diagram\s*=\s*["']architecture["']/i.test(text)
      && /<svg\b/i.test(text)
    ) || (
      /<!--\s*architecture-diagram\s*-->/i.test(text)
      && /```(?:mermaid|d2)\b/i.test(text)
    );
    const hasMarkedMarkdownVisual = new RegExp(
      `<!--\\s*primary-visual:(?:${visualRoles})\\s*-->`,
      "i",
    ).test(text) && (/```(?:mermaid|d2)\b/i.test(text) || /\|[^\n]+\|/i.test(text));
    if (!hasMarkedHtmlVisual && !hasLegacyArchitectureVisual && !hasMarkedMarkdownVisual) {
      findings.push(finding(
        "missing_load_bearing_visual",
        "A technical spec or RCA must include one marked load-bearing visual chosen for the relationship: comparison table, timeline, before/after, swimlane, cause-and-effect, UI mock-up, or architecture.",
        1,
      ));
    }
  }
  if (documentKind === "spec") {
    const hasUserStories = /data-section\s*=\s*["']user-stories["']/i.test(text)
      || /<!--\s*user-stories\s*-->/i.test(text);
    if (!hasUserStories) {
      findings.push(finding(
        "missing_user_stories",
        "A technical spec must include marked user stories written with the product words the user already knows.",
        1,
      ));
    }
  }
  if (context.document.presentsUi) {
    const mockupMatch = text.match(
      /<!--\s*ui-mockup\s*-->|data-visual-role\s*=\s*["']ui-mockup["']/i,
    );
    const implementationMatch = text.match(
      /^#{1,6}\s+Implementation\b|data-section\s*=\s*["']implementation["']/im,
    );
    if (mockupMatch === null) {
      findings.push(finding(
        "missing_ui_mockup",
        "Lead a UI presentation with a marked mock-up before implementation detail.",
        1,
      ));
    } else if (
      implementationMatch !== null
      && (mockupMatch.index ?? Number.MAX_SAFE_INTEGER)
        > (implementationMatch.index ?? Number.MIN_SAFE_INTEGER)
    ) {
      findings.push(finding(
        "ui_mockup_not_first",
        "Move the UI mock-up before implementation detail.",
        lineNumberAt(text, mockupMatch.index ?? 0),
      ));
    }
  }
}

function addSourceFreshnessCheck(now, findings) {
  const reviewedAt = new Date(`${stopSlopAdaptation.source.reviewedAt}T00:00:00Z`);
  const ageInDays = (now.getTime() - reviewedAt.getTime()) / 86_400_000;
  if (ageInDays > stopSlopAdaptation.source.reviewWithinDays) {
    findings.push(finding(
      "stop_slop_source_review_overdue",
      `Review ${stopSlopAdaptation.source.repository}; the pinned rule adaptation is ${Math.floor(ageInDays)} days old.`,
      1,
    ));
  }
}

export function verifyHumanReadableOutput({
  text,
  context,
  relativePath = "draft",
  now = new Date(),
}) {
  if (typeof text !== "string" || text.trim() === "") {
    throw new Error("text must be a non-empty string");
  }
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error("now must be a valid Date");
  }
  validateContext(context);
  const findings = [];
  addLineChecks(text, context, findings);
  addReaderContextChecks(text, context, findings);
  addVisibleDetailChecks(text, findings);
  addDocumentShapeChecks(text, context, findings);
  addSourceFreshnessCheck(now, findings);
  return {
    schema: "superflux.human_readable_output_verification.v0.1",
    ok: findings.length === 0,
    relativePath,
    findings,
    source: stopSlopAdaptation.source,
  };
}

function parseCliArgs(argv) {
  const pairs = argv.reduce((result, value, index) => {
    if (value.startsWith("--")) {
      result[value] = argv[index + 1];
    }
    return result;
  }, {});
  if (typeof pairs["--input"] !== "string" || typeof pairs["--context"] !== "string") {
    throw new Error(
      "Usage: node verify-human-readable-output.mjs --input <draft> --context <context.json>",
    );
  }
  return {
    inputPath: path.resolve(pairs["--input"]),
    contextPath: path.resolve(pairs["--context"]),
  };
}

// realpath on both sides, so a run through a junction, symlink or differently cased drive still starts.
const invokedAs = process.argv[1] ? pathToFileURL(fs.realpathSync(process.argv[1])).href : "";
if (invokedAs === pathToFileURL(fs.realpathSync(new URL(import.meta.url))).href) {
  const args = parseCliArgs(process.argv.slice(2));
  const result = verifyHumanReadableOutput({
    text: fs.readFileSync(args.inputPath, "utf8"),
    context: JSON.parse(fs.readFileSync(args.contextPath, "utf8")),
    relativePath: args.inputPath,
  });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ok ? 0 : 1;
}
