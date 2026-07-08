## What changed

-

## Public artifact safety checklist

- [ ] No private company context.
- [ ] No private customer, partner, or deal details.
- [ ] No local machine paths or internal artifact paths.
- [ ] No credentials, tokens, secret references, screenshots, or logs.
- [ ] Sources are public and credited.
- [ ] Runbooks include verification and stop conditions.

## Checks

- [ ] `python scripts/check_public_artifact_safety.py --self-test --root .`
- [ ] `PUBLIC_ARTIFACT_DENYLIST=<private denylist> python scripts/check_public_artifact_safety.py --root . --require-private-denylist`
