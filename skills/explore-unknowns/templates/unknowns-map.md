# Unknowns map: <task name>

**Task**: <one sentence>
**Repo / domain**: <path or context>
**Date**: <YYYY-MM-DD>
**Owner**: <human owner>
**Status**: drafting | awaiting-answer | approved-to-build | implemented | blocked

---

## 1. Known knowns

What is already settled from the prompt, source docs, repo inspection, or prior artifacts?

- ...

## 2. Known unknowns

Questions we can already name.

| Priority | Question | Why it matters | Answer / status |
|---|---|---|---|
| P0 | ... | Changes architecture / UX / data / safety? | open |

### Next question to ask

```text
<ask one question only>
```

## 3. Unknown knowns

Tacit user knowledge to extract by showing artifacts.

| Artifact | What the user should react to | Result |
|---|---|---|
| Option A/B/C | layout / workflow / copy / behavior | open |

## 4. Unknown unknowns / blindspot pass

| Surface | Blindspot | Smallest de-risking step | Status |
|---|---|---|---|
| Repo conventions | ... | Read / test / ask / prototype | open |
| Data model | ... | ... | open |
| UX edge cases | ... | ... | open |
| Security/privacy | ... | ... | open |
| Tests/evals | ... | ... | open |
| Deployment/rollback | ... | ... | open |

## 5. Decision-first implementation plan

Lead with the decisions most likely to change.

1. **Decision**: ...
   - Options:
   - Recommendation:
   - Why now:
2. **Decision**: ...

Mechanical steps after decisions:

- [ ] ...

## 6. Implementation notes

Use during build.

### Decisions made

- ...

### Deviations from plan

- ...

### Edge cases discovered

- ...

### Tests / proof run

```text
<command/output or artifact path>
```

## 7. Handoff proof and quiz

### What changed

- ...

### Proof

- ...

### Known limits

- ...

### Quiz before merge

1. What behavior changed for the user?
2. Which decision would be hardest to reverse?
3. What test/proof would catch the most likely regression?
4. What did we intentionally not build?
