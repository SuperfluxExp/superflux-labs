# Superflux Labs

Small, runnable agent skills and proof artifacts.

This repo starts with one public lab:

## `explore-unknowns`

A portable skill based on Thariq Shihipar's public Fable article, “A Field Guide to Fable: Finding Your Unknowns.”

It turns ambiguous or long-horizon agent work into a four-quadrant unknowns map before the agent starts guessing:

- known knowns;
- known unknowns;
- unknown knowns;
- unknown unknowns;
- decision-first plan;
- implementation notes;
- sample-run proof and merge quiz.

### Install / smoke-test locally

```bash
npm install
npm run validate
```

### Install into Claude Code + Codex with the Skills CLI

```bash
npx -y skills add . --skill explore-unknowns --agent claude-code codex --copy -y --full-depth
```

Expected locations:

- `.claude/skills/explore-unknowns/`
- `.agents/skills/explore-unknowns/`

### Install into Hermes Agent for local testing

```bash
TMP_HERMES=$(mktemp -d)
mkdir -p "$TMP_HERMES/skills"
cp -R skills/explore-unknowns "$TMP_HERMES/skills/explore-unknowns"
HERMES_HOME="$TMP_HERMES" hermes skills list | grep -i explore-unknowns
```

### Proof

See [`content/proof/explore-unknowns/2026-07-06-sample-run.md`](content/proof/explore-unknowns/2026-07-06-sample-run.md).

![Explore Unknowns sample run](content/proof/explore-unknowns/2026-07-06-sample-run.png)

## Source boundary

This is a source-grounded skill package, not an article mirror. It credits the public source, preserves short excerpts in a ledger, and converts the idea into a runnable agent workflow. It does not imply endorsement from Thariq, Anthropic, David/dzhng, or Fable.
