// UserPromptSubmit hook: append the user's prompt to the style corpus.
//
// KEEP THIS FILE STABLE. Codex records a trusted_hash per hook in
// Codex's config.toml, so changing a shipped hook asks the user to re-approve
// it. All behaviour lives in ../src/capture.mjs, which can change freely.
//
// Contract: reads hook JSON on stdin, writes NOTHING to stdout (this is an
// observer, not a context injector), and always exits 0.

import { runCaptureHook } from "../src/capture.mjs";

runCaptureHook();
