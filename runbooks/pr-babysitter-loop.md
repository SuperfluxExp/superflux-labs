# PR Babysitter Loop

## Use when

Use this when a pull request is open and a human wants an agent to keep watching CI, submitted review feedback, mergeability, and blockers until the PR reaches a real stop condition.

Typical triggers:

- a PR is waiting on checks or review;
- a branch-owned check failed and the human asked the agent to keep driving the branch;
- a reviewer left submitted feedback that needs triage;
- a prior agent stopped after one green snapshot even though the PR was still open.

Do not use this as a merge bot. A single green check snapshot is not terminal while the PR can still receive new commits, reviews, reruns, or mergeability changes.

## Outcome

At the end, the agent should leave one of these states:

1. **Merged or closed observed** — the PR reached a terminal GitHub state and the agent records the final evidence.
2. **Ready for human merge** — checks, submitted review state, and mergeability are current, and the agent hands off the evidence packet without merging.
3. **Fixed and returned to watch** — the agent fixed a branch-owned failure, pushed or prepared the patch with permission, and continued watching the new head SHA.
4. **Human-help blocker** — the next action requires a permission, product, ownership, infrastructure, or public-reply decision.

## Loop contract

This runbook follows the loop-engineering shape described by The Pragmatic Engineer's “What is loop engineering?”: a loop needs a durable goal, state that survives a fresh context window, verification after each pass, and a human gate.

- **Trigger:** an open PR plus a human request to keep monitoring, diagnose, or drive the branch until a real stop condition.
- **Goal:** keep the PR moving by triaging submitted reviews, failed checks, mergeability, and blockers without crossing human approval gates.
- **State to persist:** keep a short babysitter note in the PR body/comment if the human allows public notes, or in `pr-babysitter-notes.md` while working locally before posting. Record the PR URL or number, last checked head SHA, checks reviewed, review items reviewed, actions taken, retry budget used, and stop reason.
- **Iteration rule:** each pass starts from the persisted note, refreshes the PR state, acts on only the current head SHA, updates the note, and either keeps watching or stops at a terminal state/gate.
- **Budget / gate:** two CI reruns for the same flaky check and two branch-owned fix attempts per failure class. Stop earlier for ambiguous review, permission/auth failures, CI infrastructure failures, merge conflicts needing ownership judgment, public replies, human-authored review-thread resolution, force-pushes, rebases on shared branches, or merge decisions.

## Workflow

### 1. Take the first snapshot

Capture the current PR state before editing or rerunning anything.

Useful read-only commands:

```bash
gh pr view <number> --json url,number,state,isDraft,headRefName,headRefOid,mergeStateStatus,mergeable,reviewDecision,statusCheckRollup
gh pr checks <number>
```

Record:

- PR URL/number;
- current head SHA;
- draft/open/closed/merged state;
- submitted review decision;
- check names and conclusions;
- mergeability/conflict state;
- any retry or fix budget already used.

If the agent cannot read the PR because auth or permissions fail, stop with a human-help blocker. Do not guess from stale local branch state.

### 2. Check submitted review feedback before CI

Review feedback changes the work queue. Inspect only submitted or published feedback. Pending draft comments are not actionable because the reviewer may still edit, abandon, or submit them as part of a different review.

Useful read-only commands:

```bash
gh pr view <number> --json latestReviews,reviewDecision,comments
```

Classify each submitted item:

- **branch-owned and clear** — the requested change is specific, safe, and within the branch scope;
- **ambiguous** — the comment can be interpreted in more than one way;
- **ownership/product** — the comment needs a human decision;
- **public-reply needed** — the next step is a public GitHub response rather than a code/docs change.

Act only on branch-owned and clear items. Stop for the other classes with a short blocker that names the exact missing decision.

### 3. Inspect failed checks before rerunning or patching

For each failed or cancelled check, inspect the freshest run for the current head SHA.

Useful read-only commands:

```bash
gh run view <run-id> --log-failed
gh run view <run-id> --json headSha,conclusion,workflowName,jobs
```

Classify the failure:

- **branch-owned** — logs point to changed code, docs, tests, links, validation, or generated artifacts owned by this branch;
- **flaky / retryable** — logs show an intermittent external failure or known transient error, and the retry budget remains;
- **infrastructure** — runner outage, missing service, rate limit, unavailable dependency, or broken shared workflow;
- **permission/auth** — missing scope, protected resource, or credential boundary;
- **unrelated / out of scope** — failure belongs to another branch, repo setting, or external service.

Fix only branch-owned failures supported by logs or local reproduction. Rerun flaky checks only within the retry budget. Stop for infrastructure, permission/auth, unrelated failures, or logs that do not justify a specific branch change.

### 4. Make the smallest safe branch-owned fix

When a failure is branch-owned:

1. reproduce it locally when possible;
2. edit the smallest relevant file set;
3. run the targeted check that failed;
4. run the nearest repo validation command;
5. commit and push only if the human has authorized the agent to work on that branch;
6. return to the watch loop on the new head SHA.

Do not mix unrelated cleanup into the PR babysitting pass. If a review or check reveals a larger design change, stop with the blocker instead of expanding scope.

### 5. Verify mergeability and conflicts

After review and checks are current, refresh the PR state again.

```bash
gh pr view <number> --json headRefOid,mergeStateStatus,mergeable,reviewDecision,statusCheckRollup,state
```

If the PR is mergeable, checks are acceptable, and submitted review state is acceptable, prepare a ready-for-human-merge handoff. Do not click merge or run `gh pr merge` unless the human explicitly asks for that action in this pass.

If the PR has conflicts or requires a rebase, stop unless the human already authorized that exact branch operation. Shared-branch rebases and force-pushes are human gates.

### 6. Continue watching after each push or rerun

After a push, rerun, or review-triggered change, do not summarize early. Wait for the new head SHA's checks and review state to settle, then take another snapshot. The loop only stops at a terminal PR state, a ready-for-human-merge handoff, or a human-help blocker.

### Loop note template

Use this shape in the PR body/comment, handoff, or local note:

```markdown
## PR babysitter note

- PR: <url-or-number>
- Last checked head SHA: <sha>
- Pass: <n>
- Review state: <submitted-review-decision-and-action-items>
- Checks reviewed: <check-name -> conclusion, run id, log summary>
- Mergeability: <mergeable/conflicted/unknown>
- Actions taken this pass: <none/rerun/fix/push>
- Retry budget used: <check-name count>
- Stop reason: <watching/ready-for-human-merge/merged/closed/human-help-required>
- Next human action: <only if blocked or ready for merge>
```

## Verification

A completed babysitter pass must include an evidence packet with:

- commands or API checks run;
- PR URL/number and last checked head SHA;
- submitted review state and how each actionable item was classified;
- check conclusions, failed-log summaries, and rerun counts;
- mergeability/conflict state;
- actions taken, including commits, pushes, reruns, or no-op decisions;
- final stop reason;
- the exact human decision needed, if blocked.

The evidence packet is the deliverable. A confident statement like “looks green” is not enough.

## Stop condition

Stop only when one of these is true:

- GitHub shows the PR is merged or closed;
- the PR is ready for human merge and the evidence packet is current;
- a human-help-required blocker is reached.

Do not stop just because one check snapshot is green, one rerun succeeded, or one review comment was addressed. Refresh the PR state after every action and tie the handoff to the current head SHA.

## Failure modes

### Green-snapshot complacency

The agent sees passing checks once and stops while the PR remains open.

Prevent this by requiring a current head SHA, submitted review state, mergeability state, and explicit stop reason.

### Acting on pending or draft review comments

The agent treats a reviewer draft as final feedback.

Prevent this by acting only on submitted or published review items.

### Fixing unrelated flakes

The agent changes branch code for a transient or external failure.

Prevent this by inspecting logs, classifying failure ownership, and using a retry budget.

### Rerunning old-SHA checks

The agent pushes a fix but keeps reading the previous commit's check runs.

Prevent this by recording the head SHA every pass and ignoring stale run conclusions.

### Posting public replies or resolving human review threads without approval

The agent crosses from branch work into public representation.

Prevent this with a human gate for public replies, thread resolution, merge, force-push, or shared-branch rebase.

### Losing watch state across fresh contexts

A new agent starts without knowing which checks were retried, which comments were handled, or which SHA is current.

Prevent this by persisting the babysitter note after every pass.

## Minimal example

A toy public PR updates a documentation link.

First snapshot:

- PR `#42` is open on head `abc1234`;
- submitted review decision is “changes requested” with one published comment: “The docs link in the README returns 404.”;
- link-check CI failed on `README.md`;
- one unrelated browser test timed out once.

Pass 1:

1. The agent reads the submitted review comment and failed link-check log.
2. It classifies the README link as branch-owned and clear.
3. It fixes the invented broken link, runs the docs/link validation command, commits, and pushes a new head `def5678` because the human asked it to drive this branch.
4. It records that the browser timeout is flaky and uses one retry.
5. It continues watching instead of stopping on the local pass.

Pass 2:

- the new head `def5678` has passing link-check CI;
- the retried browser test passes;
- no new submitted review comments are present;
- mergeability is clean.

Stop reason:

> Ready for human merge. Current head `def5678` has passing checks, no submitted review blockers, and clean mergeability. The agent did not merge or resolve review threads.

## Source / credit

This runbook credits two public prior-art sources:

- `openai/codex` — [`.codex/skills/babysit-pr`](https://github.com/openai/codex/tree/main/.codex/skills/babysit-pr), for the concept of continuously monitoring PR review comments, CI checks/workflow runs, and mergeability until a terminal state or user-help blocker. This runbook also preserves the important safety lesson that pending or draft review comments are not actionable until submitted.
- `novotnyllc/babysit-pr` — [repository](https://github.com/novotnyllc/babysit-pr), for the packaging signal that PR babysitting is useful as a reusable workflow beyond one codebase.

This is a clean-room runbook adaptation for this repository. It does not copy scripts, tests, wording, or file structure from those sources. If a later implementation imports code, that later change should handle license and notice requirements explicitly.
