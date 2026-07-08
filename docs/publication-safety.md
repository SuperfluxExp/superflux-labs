# Publication Safety Policy

This repository is a public surface.

The default rule is simple:

> If a detail only makes sense because of private work, rewrite it as a generic pattern or leave it out.

## What must not be published

- private company context;
- private customer, partner, or deal details;
- private operating notes;
- private board, chat, or session exports;
- local file paths;
- credentials, tokens, keys, or secret references;
- screenshots that include private tabs, names, paths, logs, or account data.

## What is safe to publish

- generic workflow patterns;
- public source links;
- runbook templates;
- verification steps;
- stop conditions;
- failure modes;
- public examples with invented data.

## CI gate

The repository includes a safety scan at `scripts/check_public_artifact_safety.py`.

It runs on:

- pull requests;
- pushes to the default branch;
- pushes to agent-runbook branches;
- a recurring weekly schedule;
- manual workflow dispatch.

The scan looks for high-confidence private terms, local paths, internal artifact references, and secret-looking strings.

The scan is intentionally conservative. If it fails, either remove the content or make the public intent explicit in code review.
