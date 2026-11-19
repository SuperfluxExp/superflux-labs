// End-to-end test of the hook as the runtime actually invokes it: JSON on stdin,
// nothing on stdout, exit 0 no matter what. The hook is an observer — it must
// never alter the turn or break prompt submission.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ASSIGNED_SECRET_VALUE } from "./fake-secrets.mjs";

const HOOK = path.join(dirnameOf(import.meta.url), "..", "hooks", "capture-prompt.mjs");

function dirnameOf(url) {
  return path.dirname(fileURLToPath(url));
}

function tempHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "sf-learning-hook-"));
}

function runHook(payload, home) {
  return execFileSync("node", [HOOK], {
    input: typeof payload === "string" ? payload : JSON.stringify(payload),
    encoding: "utf8",
    env: { ...process.env, SF_LEARNING_HOME: home },
  });
}

function corpusLines(home) {
  const dir = path.join(home, "corpus");
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .flatMap((name) => fs.readFileSync(path.join(dir, name), "utf8").trim().split("\n"))
    .filter((line) => line.length > 0);
}

test("captures a prompt and writes exactly one redacted line", () => {
  const home = tempHome();
  const out = runHook({ prompt: "tighten the flow test wording", session_id: "s9" }, home);

  assert.equal(out, "", "the capture hook must print nothing — it is not a context injector");

  const lines = corpusLines(home);
  assert.equal(lines.length, 1);
  const row = JSON.parse(lines[0]);
  assert.equal(row.text, "tighten the flow test wording");
  assert.equal(row.session, "s9");

  fs.rmSync(home, { recursive: true, force: true });
});

test("a secret in the prompt never reaches disk", () => {
  const home = tempHome();
  runHook({ prompt: `set ANTHROPIC_API_KEY="${ASSIGNED_SECRET_VALUE}" first` }, home);

  const raw = corpusLines(home).join("\n");
  assert.ok(!raw.includes(ASSIGNED_SECRET_VALUE), "secret leaked to the ledger");
  assert.match(raw, /redacted/);

  fs.rmSync(home, { recursive: true, force: true });
});

test("malformed stdin exits 0 and writes nothing", () => {
  const home = tempHome();
  const out = runHook("this is not json", home);
  assert.equal(out, "");
  assert.equal(corpusLines(home).length, 0);
  fs.rmSync(home, { recursive: true, force: true });
});

test("empty stdin exits 0 and writes nothing", () => {
  const home = tempHome();
  assert.equal(runHook("", home), "");
  assert.equal(corpusLines(home).length, 0);
  fs.rmSync(home, { recursive: true, force: true });
});

test("an unwritable ledger home still exits 0 — capture never breaks the turn", () => {
  // Point the home at a path whose parent is a FILE, so mkdir must fail.
  const blocker = path.join(os.tmpdir(), `sf-learning-blocker-${process.pid}`);
  fs.writeFileSync(blocker, "not a directory");
  const out = runHook({ prompt: "this capture cannot be written" }, path.join(blocker, "nested"));
  assert.equal(out, "");
  fs.rmSync(blocker, { force: true });
});

test("captures across two sessions into the same corpus", () => {
  const home = tempHome();
  runHook({ prompt: "first session prompt", session_id: "a" }, home);
  runHook({ prompt: "second session prompt", session_id: "b" }, home);

  const sessions = corpusLines(home).map((l) => JSON.parse(l).session);
  assert.deepEqual(sessions, ["a", "b"]);

  fs.rmSync(home, { recursive: true, force: true });
});
