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

Verify:

- the new failing test passes;
- existing CSV import tests pass.

## Source / credit

This runbook adapts a common test-first debugging loop used by experienced engineering teams: reproduce, isolate, test, fix, verify, then report the remaining risk.
