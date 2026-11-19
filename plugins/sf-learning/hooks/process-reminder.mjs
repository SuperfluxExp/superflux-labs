// Stop hook: say, quietly and rarely, that captured prompts are piling up.
//
// Why this exists at all: the on-demand version was chosen over a scheduled
// one knowing that a manual step gets forgotten. A command nobody remembers to
// run is a feature that does not exist.
// So the loop reminds instead of relying on memory, until the scheduled version
// is allowed.
//
// Why it is a Stop hook and not the capture hook: the spec first put the
// unprocessed count in capture, but capture runs on every prompt the user
// types, and counting means reading the whole corpus. Adding a half-megabyte
// read and a failure mode to the hot path, on every keystroke-to-agent, to
// maintain a number nobody reads until the end of a session, is a bad trade.
// Stop runs once per turn's end and the count is computed there.
//
// Hard rules, same as every hook in this plugin: prints at most one line,
// never blocks, and always exits 0. A reporting hook must never break the
// session it observes.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { learningHome } from "../src/paths.mjs";
import { isUsableRow } from "../src/process.mjs";
import { readJsonl, readState, statePath, watermarkFor, writeState } from "../src/processStore.mjs";

export const REMIND_AT_ROWS = 150;
export const REMIND_EVERY_MS = 72 * 60 * 60 * 1000;

// Pure: should we say something now?
export function shouldRemind(unprocessed, lastReminderAt, now, options = {}) {
  const threshold = options.threshold ?? REMIND_AT_ROWS;
  const every = options.every ?? REMIND_EVERY_MS;
  if (unprocessed < threshold) {
    return false;
  }
  if (!lastReminderAt) {
    return true;
  }
  const last = Date.parse(lastReminderAt);
  if (Number.isNaN(last)) {
    return true;
  }
  return now - last >= every;
}

export function countUnprocessed(corpusDir, state) {
  if (!fs.existsSync(corpusDir)) {
    return 0;
  }
  let total = 0;
  for (const name of fs.readdirSync(corpusDir).filter((n) => n.endsWith(".jsonl"))) {
    const watermark = watermarkFor(state, name);
    for (const row of readJsonl(path.join(corpusDir, name))) {
      if (isUsableRow(row) && typeof row.ts === "string" && (!watermark || row.ts > watermark)) {
        total++;
      }
    }
  }
  return total;
}

function main() {
  const home = learningHome();
  const state = readState(statePath(home));
  const unprocessed = countUnprocessed(path.join(home, "corpus"), state);
  const now = Date.now();
  if (!shouldRemind(unprocessed, state.last_reminder_at, now)) {
    return;
  }
  writeState(statePath(home), { ...state, last_reminder_at: new Date(now).toISOString() });
  process.stdout.write(
    `sf-learning has ${unprocessed} captured prompts it has not read yet. Run /sf-learning:process when you have a moment.\n`
  );
}

// Only when run as the hook. Importing this file — which the tests do, to
// check `shouldRemind` — must not run the pass or exit the process.
// realpath on both sides, so a run through a junction, symlink or differently cased drive still starts.
const invokedAs = process.argv[1] ? pathToFileURL(fs.realpathSync(process.argv[1])).href : "";
if (invokedAs === pathToFileURL(fs.realpathSync(new URL(import.meta.url))).href) {
  try {
    main();
  } catch {
    // Never break the session. A reminder that fails is a reminder that does
    // not appear, which is the correct failure.
  }
  process.exit(0);
}
