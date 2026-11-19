import assert from "node:assert/strict";
import test from "node:test";
import {
  verifyHumanReadableOutput,
} from "../../../skills/cognitive-render/scripts/verify-human-readable-output.mjs";

const verificationDate = new Date("2026-08-03T12:00:00-07:00");

function context(overrides = {}) {
  return {
    schema: "superflux.human_readable_output_context.v0.1",
    document: {
      kind: "summary",
      presentsUi: false,
      ...overrides.document,
    },
    reader: {
      timeAwayHours: 0,
      attentionBudgetMinutes: 3,
      keyPoints: [
        {
          readerPhrase: "The page now labels stopped answers as incomplete.",
        },
      ],
      unseenChanges: [],
      ...overrides.reader,
    },
    terminology: {
      conversation: ["stopped answer"],
      product: ["Acme", "answer"],
      repository: ["isStreaming"],
      forbidden: [],
      ...overrides.terminology,
    },
  };
}

function findingCodes(result) {
  return result.findings.map((finding) => finding.code);
}

test("STE review signals do not reject a clear sentence above 25 words", () => {
  const text = "If the server has not confirmed that the answer is complete, the page must keep the incomplete label visible so the user can distinguish it from a finished answer.";
  assert.ok(text.split(/\s+/).length > 25);
  const result = verifyHumanReadableOutput({
    text,
    context: context({ reader: { keyPoints: [{ readerPhrase: text }] } }),
    relativePath: "ste-explanation.md",
    now: verificationDate,
  });
  assert.equal(result.ok, true, JSON.stringify(result.findings));
});

test("accepts cohesive engineering prose without applying stop-slop absolutes", () => {
  const text = `# What changed

The page now labels stopped answers as incomplete. The server can directly keep the received text visible, and the status tells the user that the answer did not finish — no code knowledge is needed.

The page removes the working indicator after the user clicks Stop. Copy remains available because the text may still be useful.`;

  const result = verifyHumanReadableOutput({
    text,
    context: context(),
    relativePath: "summary.md",
    now: verificationDate,
  });

  assert.equal(result.ok, true, JSON.stringify(result.findings, null, 2));
});

test("reports slop phrases and jagged compressed prose with line coordinates", () => {
  const text = `# Update

Here's the thing: the execution spine unlocks leverage.

Speed. Trust. Scale.

The page now labels stopped answers as incomplete.`;

  const result = verifyHumanReadableOutput({
    text,
    context: context(),
    relativePath: "compressed.md",
    now: verificationDate,
  });

  assert.equal(result.ok, false);
  assert.ok(findingCodes(result).includes("slop_phrase"));
  assert.ok(findingCodes(result).includes("ungrounded_term"));
  assert.ok(findingCodes(result).includes("jagged_flow"));
  assert.ok(result.findings.every((finding) => Number.isInteger(finding.line)));
});

test("allows a suspicious label only when the conversation or product already uses it", () => {
  const text = `# Update

The execution spine routes each request through the same worker. The page now labels stopped answers as incomplete.`;

  const ungrounded = verifyHumanReadableOutput({
    text,
    context: context(),
    relativePath: "ungrounded.md",
    now: verificationDate,
  });
  assert.ok(findingCodes(ungrounded).includes("ungrounded_term"));

  const grounded = verifyHumanReadableOutput({
    text,
    context: context({
      terminology: {
        conversation: ["execution spine", "stopped answer"],
      },
    }),
    relativePath: "grounded.md",
    now: verificationDate,
  });
  assert.equal(grounded.ok, true, JSON.stringify(grounded.findings, null, 2));
});

test("keeps commit hashes, raw errors, and file coordinates out of the visible readout", () => {
  const text = `# Update

The page now labels stopped answers as incomplete.

Commit abc1234 changed example.ts:12. Error: stream closed unexpectedly.`;

  const result = verifyHumanReadableOutput({
    text,
    context: context(),
    relativePath: "implementation-debris.md",
    now: verificationDate,
  });

  assert.equal(result.ok, false);
  assert.ok(findingCodes(result).includes("visible_commit_hash"));
  assert.ok(findingCodes(result).includes("visible_file_coordinate"));
  assert.ok(findingCodes(result).includes("visible_raw_error"));
});

test("requires a reader reset and human-visible outcomes after time away", () => {
  const resumedContext = context({
    reader: {
      timeAwayHours: 30,
      attentionBudgetMinutes: 3,
      keyPoints: [
        {
          readerPhrase: "The page now labels stopped answers as incomplete.",
        },
      ],
      unseenChanges: [
        {
          readerPhrase: "Copy now stays available after the user stops an answer.",
          evidence: "abc1234",
        },
      ],
    },
  });

  const missingReset = verifyHumanReadableOutput({
    text: "# Update\n\nThe page now labels stopped answers as incomplete.",
    context: resumedContext,
    relativePath: "resumed.md",
    now: verificationDate,
  });
  assert.ok(findingCodes(missingReset).includes("missing_reader_reset"));
  assert.ok(findingCodes(missingReset).includes("missing_unseen_outcome"));

  const reset = `# Picking up the work

**Picking up:** paused yesterday, after we reproduced the answer-state problem. The answer state and Copy control were rechecked today. **Already done:** The page now labels stopped answers as incomplete. Copy now stays available after the user stops an answer. **Still open:** browser verification. **Need from you:** review the visible stopped-answer treatment.`;
  const passing = verifyHumanReadableOutput({
    text: reset,
    context: resumedContext,
    relativePath: "resumed.md",
    now: verificationDate,
  });
  assert.equal(passing.ok, true, JSON.stringify(passing.findings, null, 2));
});

test("caps the visible readout at four key points", () => {
  const result = verifyHumanReadableOutput({
    text: "# Update\n\nThe page now labels stopped answers as incomplete.",
    context: context({
      reader: {
        timeAwayHours: 0,
        attentionBudgetMinutes: 3,
        keyPoints: [
          { readerPhrase: "One" },
          { readerPhrase: "Two" },
          { readerPhrase: "Three" },
          { readerPhrase: "Four" },
          { readerPhrase: "Five" },
        ],
        unseenChanges: [],
      },
    }),
    relativePath: "too-many-points.md",
    now: verificationDate,
  });

  assert.ok(findingCodes(result).includes("reader_load_exceeded"));
});

test("enforces the declared attention budget on the visible readout", () => {
  const sentence = "The page keeps the stopped answer visible and labels it incomplete for the user.";
  const text = `# Update\n\nThe page now labels stopped answers as incomplete. ${sentence.repeat(24)}`;
  const result = verifyHumanReadableOutput({
    text,
    context: context({
      reader: {
        timeAwayHours: 0,
        attentionBudgetMinutes: 1,
        keyPoints: [
          { readerPhrase: "The page now labels stopped answers as incomplete." },
        ],
        unseenChanges: [],
      },
    }),
    relativePath: "over-budget.md",
    now: verificationDate,
  });

  assert.ok(findingCodes(result).includes("reader_budget_exceeded"));
});

test("requires a marked load-bearing visual for a technical spec or RCA", () => {
  for (const kind of ["spec", "rca"]) {
    const missingVisual = verifyHumanReadableOutput({
      text: "# Answer\n\nThe page now labels stopped answers as incomplete.",
      context: context({ document: { kind, presentsUi: false } }),
      relativePath: `${kind}.md`,
      now: verificationDate,
    });
    assert.ok(findingCodes(missingVisual).includes("missing_load_bearing_visual"));

    const userStories = kind === "spec"
      ? `\n<!-- user-stories -->\n\n## User stories\n\nThe user can see when an answer is incomplete.\n`
      : "";
    const withComparisonTable = verifyHumanReadableOutput({
      text: `<!doctype html>
<main>
<h1>Answer</h1>

<p>The page now labels stopped answers as incomplete.</p>
${userStories}
<table data-visual-role="comparison-table">
  <tr><th>State</th><th>What the user sees</th></tr>
  <tr><td>Stopped</td><td>Incomplete label</td></tr>
</table>
</main>`,
      context: context({ document: { kind, presentsUi: false } }),
      relativePath: `${kind}.md`,
      now: verificationDate,
    });
    assert.equal(
      withComparisonTable.ok,
      true,
      JSON.stringify(withComparisonTable.findings, null, 2),
    );
  }
});

test("requires marked user stories in a technical spec", () => {
  const result = verifyHumanReadableOutput({
    text: `# Answer

The page now labels stopped answers as incomplete.

<!-- architecture-diagram -->

\`\`\`mermaid
flowchart LR
  Page --> Server
\`\`\``,
    context: context({ document: { kind: "spec", presentsUi: false } }),
    relativePath: "spec.md",
    now: verificationDate,
  });

  assert.ok(findingCodes(result).includes("missing_user_stories"));
});

test("requires a UI mock-up before implementation detail", () => {
  const uiContext = context({
    document: { kind: "plan", presentsUi: true },
  });
  const implementationFirst = `# Plan

The page now labels stopped answers as incomplete.

## Implementation

Update the answer component.

<!-- ui-mockup -->

## Mock-up

[Stopped answer]`;
  const failing = verifyHumanReadableOutput({
    text: implementationFirst,
    context: uiContext,
    relativePath: "ui-plan.md",
    now: verificationDate,
  });
  assert.ok(findingCodes(failing).includes("ui_mockup_not_first"));

  const mockupFirst = `# Plan

The page now labels stopped answers as incomplete.

<!-- ui-mockup -->

## Mock-up

[Stopped answer]

## Implementation

Update the answer component.`;
  const passing = verifyHumanReadableOutput({
    text: mockupFirst,
    context: uiContext,
    relativePath: "ui-plan.md",
    now: verificationDate,
  });
  assert.equal(passing.ok, true, JSON.stringify(passing.findings, null, 2));
});

test("does not count HTML styles or scripts as a visible wall of text", () => {
  const repeatedCss = ".card { color: #182033; padding: 12px; } ".repeat(40);
  const html = `<!doctype html>
<html>
<head><style>${repeatedCss}</style></head>
<body><main><h1>Update</h1><p>The page now labels stopped answers as incomplete.</p></main></body>
</html>`;
  const result = verifyHumanReadableOutput({
    text: html,
    context: context(),
    relativePath: "summary.html",
    now: verificationDate,
  });

  assert.equal(result.ok, true, JSON.stringify(result.findings, null, 2));
});

test("matches planned reader phrases across inline HTML markup", () => {
  const html = `<!doctype html>
<html><body><p>The page now labels <strong>stopped answers</strong> as <strong>incomplete</strong>.</p></body></html>`;
  const result = verifyHumanReadableOutput({
    text: html,
    context: context(),
    relativePath: "inline-markup.html",
    now: verificationDate,
  });

  assert.equal(result.ok, true, JSON.stringify(result.findings, null, 2));
});

test("checks human-visible words inside SVG diagrams", () => {
  const html = `<!doctype html>
<html><body><svg><text>Here's the thing: the page now labels stopped answers as incomplete.</text><text>Commit abc1234</text></svg></body></html>`;
  const result = verifyHumanReadableOutput({
    text: html,
    context: context(),
    relativePath: "diagram.html",
    now: verificationDate,
  });

  assert.ok(findingCodes(result).includes("slop_phrase"));
  assert.ok(findingCodes(result).includes("visible_commit_hash"));
  assert.ok(!findingCodes(result).includes("missing_key_point"));
});

test("ignores adjacent embedded SVG styles while checking diagram text", () => {
  const html = `<!doctype html>
<html><body><svg>
  <style><![CDATA[
    .node { fill: #fff; }
  ]]></style><style><![CDATA[
    .one { color: red; } .two { color: blue; } .three { color: green; }
  ]]></style><text>The page now labels stopped answers as incomplete.</text><text>The browser sends the upload request to the API process</text><text>The API process checks the current file version in the database</text><text>The worker receives the exact approved file bundle</text><text>The thumbnail job starts after the version check succeeds</text><text>The backend records that version as processed before the next step proceeds</text>
</svg></body></html>`;
  const result = verifyHumanReadableOutput({
    text: html,
    context: context(),
    relativePath: "d2-diagram.html",
    now: verificationDate,
  });

  assert.equal(result.ok, true, JSON.stringify(result.findings, null, 2));
});

test("fails fast when the required reader and terminology context is missing", () => {
  assert.throws(
    () => verifyHumanReadableOutput({
      text: "A draft",
      context: {},
      relativePath: "draft.md",
      now: verificationDate,
    }),
    /superflux\.human_readable_output_context\.v0\.1/,
  );
});

for (const role of ["architecture", "component-deployment", "request-sequence", "ownership", "decision-tree", "workflow"]) {
  test(`accepts escaped ASCII as a substantive ${role} visual`, () => {
    const text = `<p>The page now labels stopped answers as incomplete.</p><pre data-visual-role="${role}" data-diagram-format="ascii">API -&gt; Worker</pre>`;
    const result = verifyHumanReadableOutput({ text, context: context({ document: { kind: "rca" } }), relativePath: "example.html", now: verificationDate });
    assert.ok(!findingCodes(result).includes("missing_load_bearing_visual"));
  });
}
