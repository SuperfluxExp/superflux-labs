import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { CLASSIFIER_VERSION } from "../src/classify.mjs";
import {
  DistributionShiftError,
  assertDistributionStable,
  distributionOf,
  rescoreCorpus,
  rescoreFile,
  rescoreRow,
  shiftReport,
} from "../src/rescore.mjs";

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "sf-learning-rescore-"));
}

// A v1 row exactly as capture v1 wrote it.
function v1(text, extra = {}) {
  return {
    ts: "2026-08-10T10:00:00.000Z",
    runtime: "claude-code",
    session: "s1",
    cwd: null,
    chars: text.length,
    truncated: false,
    is_correction: false,
    is_slash_command: false,
    clf: 1,
    text,
    ...extra,
  };
}

test("a v1 human row is upgraded in place with the new fields", () => {
  const out = rescoreRow(v1("i am lost, explain this simply"));
  assert.equal(out.clf, CLASSIFIER_VERSION);
  assert.equal(out.provenance, "human");
  assert.equal(out.wrapper, null);
  assert.equal(out.is_comprehension, true);
  assert.equal(out.raw_chars, "i am lost, explain this simply".length);
  assert.equal(out.text, "i am lost, explain this simply");
});

test("a v1 wrapped row has the human prompt extracted on rescore", () => {
  const raw = '<in-app-browser-context source="ambient-ui-state">\nstuff\n</in-app-browser-context>\n## My request:\nokay i am sold go ahead';
  const out = rescoreRow(v1(raw));
  assert.equal(out.provenance, "wrapped");
  assert.equal(out.text, "okay i am sold go ahead");
  assert.equal(out.chars, "okay i am sold go ahead".length);
  assert.equal(out.raw_chars, raw.length, "raw_chars comes from the v1 chars field");
});

test("a v1 machine row becomes provenance=machine with empty text and no flags", () => {
  const out = rescoreRow(v1("<task-notification>\n<task-id>x</task-id>\n</task-notification>", { is_correction: true }));
  assert.equal(out.provenance, "machine");
  assert.equal(out.text, "");
  assert.equal(out.is_correction, false, "a v1 false-positive on machine text is cleared");
});

test("a v1 row whose wrapper was truncated at capture becomes machine — the prompt was never captured", () => {
  const out = rescoreRow(v1('<in-app-browser-context source="ambient-ui-state">\nx'.padEnd(4000, "x"), { truncated: true }));
  assert.equal(out.provenance, "machine");
  assert.equal(out.truncated, true, "the capture-time truncation flag survives");
});

test("REGRESSION: a v2+ machine row (text already extracted to \"\") stays machine on rescore", () => {
  // The bug: rescoring re-derived provenance from stored text, and "" is not
  // an angle-bracket block, so 127 machine rows became "human" in one run.
  const v2machine = { ...v1(""), clf: 2, provenance: "machine", wrapper: "task-notification", chars: 0, raw_chars: 400 };
  const out = rescoreRow(v2machine);
  assert.equal(out.provenance, "machine");
  assert.equal(out.wrapper, "task-notification");
  assert.equal(out.text, "");
  assert.equal(out.chars, 0);
  assert.equal(out.raw_chars, 400);
});

test("REGRESSION: a v2+ wrapped row keeps its provenance and its extracted text on rescore", () => {
  const v2wrapped = { ...v1("okay go ahead"), clf: 2, provenance: "wrapped", wrapper: "in-app-browser-context", chars: 13, raw_chars: 900 };
  const out = rescoreRow(v2wrapped);
  assert.equal(out.provenance, "wrapped");
  assert.equal(out.wrapper, "in-app-browser-context");
  assert.equal(out.text, "okay go ahead");
  assert.equal(out.raw_chars, 900);
});

test("a v2+ row that carries a reply keeps it through rescore", () => {
  const withReply = { ...v1("hm"), clf: 2, provenance: "human", wrapper: null, raw_chars: 2, reply: { text: "prior reply", chars: 11, truncated: false, ts: "t", reason: null } };
  assert.deepEqual(rescoreRow(withReply).reply, withReply.reply);
});

test("a row already at the current version is returned unchanged (same object)", () => {
  const row = { ...v1("hello"), clf: CLASSIFIER_VERSION, provenance: "human", wrapper: null, raw_chars: 5, is_comprehension: false };
  assert.equal(rescoreRow(row), row);
});

test("rescoreFile writes a .bak once, rewrites atomically, and reports counts", () => {
  const dir = tempDir();
  const file = path.join(dir, "2026-08.jsonl");
  const lines = [
    JSON.stringify(v1("plain human prompt")),
    JSON.stringify(v1("<task-notification>\n<task-id>a</task-id>\n</task-notification>")),
    JSON.stringify(v1('<system-reminder>\nnote\n</system-reminder>\nokay lets not touch it')),
    "this line is not json",
  ];
  fs.writeFileSync(file, `${lines.join("\n")}\n`, "utf8");

  const r = rescoreFile(file);
  assert.equal(r.total, 4);
  assert.equal(r.rescored, 3);
  assert.equal(r.malformed, 1);
  assert.deepEqual(r.provenance, { human: 1, wrapped: 1, machine: 1 });
  assert.ok(fs.existsSync(`${file}.bak`), "backup written");
  assert.equal(fs.readFileSync(`${file}.bak`, "utf8"), `${lines.join("\n")}\n`, "backup is the untouched original");

  const after = fs.readFileSync(file, "utf8").trim().split("\n");
  assert.equal(after.length, 4, "no line dropped");
  assert.equal(after[3], "this line is not json", "malformed line preserved verbatim");
  assert.equal(JSON.parse(after[2]).text, "okay lets not touch it");

  // Second run: idempotent, backup not overwritten.
  const r2 = rescoreFile(file);
  assert.equal(r2.rescored, 0);
  assert.equal(r2.unchanged, 3);
  assert.equal(fs.readFileSync(`${file}.bak`, "utf8"), `${lines.join("\n")}\n`, "backup untouched on rerun");

  fs.rmSync(dir, { recursive: true, force: true });
});

test("rescoreCorpus handles every .jsonl in the directory and ignores other files", () => {
  const dir = tempDir();
  fs.writeFileSync(path.join(dir, "2026-07.jsonl"), `${JSON.stringify(v1("a"))}\n`);
  fs.writeFileSync(path.join(dir, "2026-08.jsonl"), `${JSON.stringify(v1("b"))}\n`);
  fs.writeFileSync(path.join(dir, "notes.txt"), "ignore me");
  const results = rescoreCorpus(dir);
  assert.equal(results.length, 2);
  assert.ok(!fs.existsSync(path.join(dir, "notes.txt.bak")));
  fs.rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// The distribution guard.

// A v2 row: already carries provenance, so it is comparable across a rescore.
function v2(text, extra = {}) {
  return {
    ts: "2026-08-10T10:00:00.000Z",
    runtime: "claude-code",
    session: "s1",
    cwd: null,
    provenance: "human",
    wrapper: null,
    chars: text.length,
    raw_chars: text.length,
    truncated: false,
    is_correction: false,
    is_comprehension: false,
    is_slash_command: false,
    clf: 2,
    text,
    ...extra,
  };
}

// Re-derive provenance from stored text, which is exactly the bug of
// 2026-08-18: a v2 machine row stores "", and "" is not an angle-bracket
// block, so it comes back "human". Used to prove the guard catches it.
function brokenRescore(row) {
  return { ...row, provenance: "human", clf: CLASSIFIER_VERSION };
}

test("distributionOf counts provenance and flags, ignoring rows that carry neither", () => {
  const d = distributionOf([
    v2("a"),
    v2("b", { provenance: "machine", text: "" }),
    v2("c", { provenance: "wrapped", is_correction: true }),
    { ts: "x", clf: 1, text: "a v1 row with no provenance" },
  ]);
  assert.equal(d.total, 4);
  assert.deepEqual(d.provenance, { human: 1, wrapped: 1, machine: 1 });
  assert.equal(d.flags.is_correction, 1);
  assert.equal(d.flags.is_comprehension, 0);
});

test("shiftReport ranks the biggest mover first and measures percentage points", () => {
  const before = distributionOf([...Array(50)].map((_, i) => v2("x", { provenance: i < 10 ? "machine" : "human" })));
  const after = distributionOf([...Array(50)].map(() => v2("x")));
  const moves = shiftReport(before, after);
  assert.equal(Math.round(moves[0].points), 20, "the biggest move is reported first");
  const machine = moves.find((move) => move.bucket === "provenance.machine");
  assert.equal(Math.round(machine.points), 20);
  assert.equal(machine.before, 10);
  assert.equal(machine.after, 0);
});

test("assertDistributionStable throws past the threshold and names both distributions", () => {
  const before = distributionOf([...Array(100)].map((_, i) => v2("x", { provenance: i < 14 ? "machine" : "human" })));
  const after = distributionOf([...Array(100)].map(() => v2("x")));
  assert.throws(
    () => assertDistributionStable(before, after),
    (error) => {
      assert.ok(error instanceof DistributionShiftError);
      assert.match(error.message, /provenance\.machine moved 14\.0 points, past its 5-point limit/);
      assert.match(error.message, /before: human 86/);
      assert.match(error.message, /after : human 100/);
      assert.match(error.message, /Nothing was written/);
      return true;
    }
  );
});

test("assertDistributionStable passes a move inside the threshold", () => {
  const before = distributionOf([...Array(100)].map((_, i) => v2("x", { provenance: i < 10 ? "machine" : "human" })));
  const after = distributionOf([...Array(100)].map((_, i) => v2("x", { provenance: i < 7 ? "machine" : "human" })));
  const result = assertDistributionStable(before, after);
  assert.equal(result.checked, true);
  assert.equal(result.comparedRows, 100);
});

test("the guard is skipped, and says so, when there are too few comparable rows", () => {
  const before = distributionOf([...Array(5)].map((_, i) => v2("x", { provenance: i < 1 ? "machine" : "human" })));
  const after = distributionOf([...Array(5)].map(() => v2("x")));
  const result = assertDistributionStable(before, after);
  assert.equal(result.checked, false);
  assert.equal(result.reason, "small-sample");
});

test("REGRESSION: a rescore that would relabel machine rows as human aborts before writing anything", () => {
  const dir = tempDir();
  const file = path.join(dir, "2026-08.jsonl");
  const rows = [...Array(100)].map((_, i) => (i < 30 ? v2("", { provenance: "machine", text: "" }) : v2(`prompt ${i}`)));
  const original = `${rows.map((r) => JSON.stringify(r)).join("\n")}\n`;
  fs.writeFileSync(file, original, "utf8");

  assert.throws(
    () => rescoreFile(file, { rescore: brokenRescore }),
    (error) => error instanceof DistributionShiftError
  );

  assert.equal(fs.readFileSync(file, "utf8"), original, "the corpus file is untouched");
  assert.ok(!fs.existsSync(`${file}.bak`), "no backup written on a rejected run");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("--allow-distribution-shift lets a deliberate change through and reports it as overridden", () => {
  const dir = tempDir();
  const file = path.join(dir, "2026-08.jsonl");
  const rows = [...Array(100)].map((_, i) => (i < 30 ? v2("", { provenance: "machine", text: "" }) : v2(`prompt ${i}`)));
  fs.writeFileSync(file, `${rows.map((r) => JSON.stringify(r)).join("\n")}\n`, "utf8");

  const result = rescoreFile(file, { rescore: brokenRescore, allowDistributionShift: true });
  assert.equal(result.guard.checked, false);
  assert.equal(result.guard.reason, "override");
  assert.ok(result.guard.moves[0].points > 5);
  assert.ok(fs.existsSync(`${file}.bak`), "backup written when the run proceeds");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a real rescore of a v2 corpus passes the guard and preserves provenance", () => {
  const dir = tempDir();
  const file = path.join(dir, "2026-08.jsonl");
  const rows = [...Array(60)].map((_, i) =>
    i < 12 ? v2("", { provenance: "machine", text: "" }) : v2(`the deploy finished at noon ${i}`)
  );
  fs.writeFileSync(file, `${rows.map((r) => JSON.stringify(r)).join("\n")}\n`, "utf8");

  const result = rescoreFile(file);
  assert.equal(result.guard.checked, true);
  assert.equal(result.provenance.machine, 12, "machine rows survive a real rescore");
  assert.equal(result.provenance.human, 48);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("rescoreCorpus stops at the first file that trips the guard", () => {
  const dir = tempDir();
  const rows = [...Array(40)].map((_, i) => (i < 12 ? v2("", { provenance: "machine", text: "" }) : v2(`p${i}`)));
  const body = `${rows.map((r) => JSON.stringify(r)).join("\n")}\n`;
  fs.writeFileSync(path.join(dir, "2026-07.jsonl"), body, "utf8");
  fs.writeFileSync(path.join(dir, "2026-08.jsonl"), body, "utf8");

  assert.throws(
    () => rescoreCorpus(dir, { rescore: brokenRescore }),
    (error) => error instanceof DistributionShiftError
  );
  assert.ok(!fs.existsSync(path.join(dir, "2026-08.jsonl.bak")), "the second file was never touched");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a deliberate classifier change moves the flags without tripping the guard", () => {
  // The flags are meant to move when the classifier improves. Provenance is not.
  const before = distributionOf([...Array(100)].map(() => v2("x")));
  const after = distributionOf([...Array(100)].map((_, i) => v2("x", { is_correction: i < 12 })));
  const result = assertDistributionStable(before, after);
  assert.equal(result.checked, true);
  assert.equal(Math.round(result.moves[0].points), 12);
});

test("a flag flip big enough to mean corruption still aborts", () => {
  const before = distributionOf([...Array(100)].map(() => v2("x")));
  const after = distributionOf([...Array(100)].map(() => v2("x", { is_correction: true })));
  assert.throws(
    () => assertDistributionStable(before, after),
    (error) => {
      assert.match(error.message, /is_correction moved 100\.0 points, past its 15-point limit/);
      return true;
    }
  );
});
