import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";

import { corpusFile, detectRuntime, errorLog, learningHome } from "../src/paths.mjs";

test("learningHome honours SF_LEARNING_HOME when set", () => {
  assert.equal(learningHome({ SF_LEARNING_HOME: "D:/tmp/sfl" }), "D:/tmp/sfl");
});

test("learningHome defaults under the user home, never inside the plugin", () => {
  const home = learningHome({});
  assert.equal(home, path.join(os.homedir(), ".superflux", "sf-learning"));
  assert.ok(!home.includes("plugins"), "ledger must not live inside the plugin directory");
});

test("corpus file is partitioned by month so a single file never grows unbounded", () => {
  const file = corpusFile("/base", new Date("2026-08-03T22:10:00Z"));
  assert.equal(file, path.join("/base", "corpus", "2026-08.jsonl"));
});

test("corpus month uses UTC so the partition does not depend on the machine timezone", () => {
  const file = corpusFile("/base", new Date("2026-01-01T00:30:00Z"));
  assert.equal(path.basename(file), "2026-01.jsonl");
});

test("error log sits beside the corpus", () => {
  assert.equal(errorLog("/base"), path.join("/base", "capture-errors.log"));
});

test("detects Claude Code from its plugin cache path", () => {
  const runtime = detectRuntime({
    CLAUDE_PLUGIN_ROOT: path.join(os.homedir(), ".claude", "plugins", "cache", "superflux-labs", "sf-learning", "0.1.0"),
  });
  assert.equal(runtime, "claude-code");
});

test("detects Codex from its plugin cache path", () => {
  const runtime = detectRuntime({
    CLAUDE_PLUGIN_ROOT: path.join(os.homedir(), ".codex", "plugins", "cache", "superflux-labs", "sf-learning", "0.1.0"),
  });
  assert.equal(runtime, "codex");
});

test("falls back to claude-code when only the project dir is set", () => {
  assert.equal(detectRuntime({ CLAUDE_PROJECT_DIR: "C:/repo" }), "claude-code");
});

test("reports unknown rather than guessing", () => {
  assert.equal(detectRuntime({}), "unknown");
});
