# Bug Reproduction Loop

## Use when

Use this when an agent is asked to fix a bug.

The core rule is simple:

> Do not fix a bug you have not reproduced.

This applies even when the fix looks obvious.

## Outcome

At the end, the agent should leave one of these states:

1. **Fixed and verified** — the bug was reproduced, a failing test or direct repro was captured, the fix was applied, and the repro now passes.
2. **Cannot reproduce** — the agent documented exactly what it tried and what evidence is missing.
3. **Blocked by environment or access** — the agent identified the missing dependency, credential, data, or runtime.

A confident guess is not a valid outcome.

## Loop contract

This runbook follows the loop-engineering shape described by The Pragmatic Engineer's “What is loop engineering?”: a loop needs a durable goal, a way to carry state between turns, a fresh-context restart path, and an explicit stop rule.

- **Trigger:** a bug report, failing check, support ticket, exception, or alert points to behavior that should be corrected.
- **Goal:** make the original repro pass while keeping the nearest regression checks green, or produce a precise cannot-reproduce / blocked report.
- **State to persist:** keep a short bug loop note in the PR description, issue, or `bug-loop-notes.md`. It should list the symptom, repro attempts, failing signal, cause sentence, fix attempt, passing signal, and remaining risk.
- **Iteration rule:** each pass tries one repro path or one smallest-cause fix. If another pass is needed, restart from the persisted note and current repo state, not from hidden chat memory.
- **Budget / gate:** after two plausible repro paths fail, stop and report what evidence is missing. Stop immediately if the fix needs credentials, production data, a feature flag, or a human product decision.

## Workflow

### 1. Restate the symptom

The agent writes:

- what the user saw;
- where it happened;
- expected behavior;
- actual behavior;
- any logs, screenshots, or error messages available.

If the symptom is vague, ask for the smallest missing fact or inspect the code path to find a likely repro point.

### 2. Find the execution path

The agent traces the path from input to failure.

Useful moves:

- search for the error message;
- inspect the route, handler, component, command, or job that owns the behavior;
- identify the smallest function or integration boundary where the bug can appear.

Do not edit yet.

### 3. Reproduce the bug

Preferred order:

1. Existing test that already fails.
2. New failing unit or integration test.
3. Minimal script or command that shows the failure.
4. Manual repro with exact steps and evidence.

The agent must capture the repro result before changing code.

Append the repro result to the loop note, even when the attempt fails to reproduce the bug.

### 4. Isolate the cause

The agent names the cause in one sentence.

Good:

> The parser drops empty rows before reading the header, so files with a blank first line shift every column.

Bad:

> There is probably an issue with CSV handling.

### 5. Fix the smallest cause

The fix should target the cause, not adjacent cleanup.

Avoid:

- broad rewrites;
- unrelated style changes;
- new abstractions that are not needed for the bug;
- hiding the error without fixing the cause.

### 6. Verify the repro now passes

Run the exact repro from step 3 again.

Then run the nearest regression checks.

The final note must include both:

- the original failing signal;
- the passing signal after the fix.

Then update the loop note with the final state: fixed, cannot reproduce, or blocked.

## Verification

A completed bug loop should include:

- symptom restatement;
- repro command, test, or manual steps;
- failing result before the fix;
- cause sentence;
- fix summary;
- passing result after the fix;
- remaining risk, if any.

## Stop condition

Stop when one of these is true:

- the original repro passes and the nearest regression checks pass;
- the bug cannot be reproduced after bounded attempts;
- the fix requires a decision, credential, data set, or environment the agent does not have.

Bounded attempts means the agent does not keep trying random fixes. After two plausible repro paths fail, it should report what is missing.

## Failure modes

### Fixing from vibes

The code looks suspicious, so the agent changes it without proving the bug.

Prevent this by requiring a failing repro first.

### Test passes but not the bug

The agent writes a test that checks the implementation detail it changed, not the user-visible failure.

Prevent this by restating the symptom and mapping the test back to it.

### Environment mismatch

The agent cannot reproduce locally because the bug depends on production data, a browser, a feature flag, or a service.

Prevent this by naming the missing environment and providing the closest safe repro.

### Over-fix

The agent rewrites the subsystem and creates review risk.

Prevent this with the smallest-cause rule.

### Lost context between attempts

The agent forgets which repro paths failed and loops through the same guesses.

Prevent this by updating the bug loop note after every pass.

## Minimal example

Symptom:

> Uploading a CSV with a blank first line causes all columns to shift.

Repro:

- add a fixture with a leading blank line;
- run the CSV import test;
- observe the column mismatch failure.

Cause:

> The parser removes blank rows before reading the header row, so the header index no longer matches the original file.

Fix:

- skip leading blank rows only before header detection;
- preserve row mapping after the header is found.

Loop note after pass 1:

- symptom: leading blank line shifts CSV columns;
- repro: CSV import fixture failed before fix;
- cause: blank-row handling changed the header index;
- checks: new repro test and existing CSV import tests pass;
- status: fixed and verified.

Verify:

- the new failing test passes;
- existing CSV import tests pass.

## Source / credit

This runbook adapts a common test-first debugging loop used by experienced engineering teams: reproduce, isolate, test, fix, verify, then report the remaining risk.

It also incorporates the goal/state/stop framing from Gergely Orosz's Pragmatic Engineer article, [“What is loop engineering?”](https://newsletter.pragmaticengineer.com/p/what-is-loop-engineering).
