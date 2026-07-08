# Contributing

This repository is for practical agent runbooks.

A useful contribution should make it easier for a human or agent to finish real work with evidence.

## Runbook checklist

Before opening a pull request, make sure the runbook includes:

- [ ] Use when
- [ ] Outcome
- [ ] Workflow
- [ ] Verification
- [ ] Stop condition
- [ ] Failure modes
- [ ] Minimal example
- [ ] Source / credit

## Public-safety checklist

Do not include:

- private company context;
- private customer names or deal details;
- local machine paths;
- credentials or tokens;
- private notes, chat logs, decision traces, or board exports;
- screenshots or files that were not intended for public release.

The CI safety scan catches common mistakes, but it is not enough by itself.

If a runbook came from private work, rewrite it as a generic pattern.

## Style

Use plain language.

Prefer concrete workflow steps over broad claims.

Every runbook should answer:

1. What situation triggers this?
2. What should be true at the end?
3. What evidence proves it worked?
4. When should the agent stop?
5. How does this usually fail?
