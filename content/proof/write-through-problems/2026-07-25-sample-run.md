# Sample run — write-through-problems

**Date:** July 25, 2026
**Skill:** `write-through-problems` / Recursive Thought Writing
**Mode:** Quick
**Result:** pass — 1,076 words, 16/16 rubric, no hard failures
**Output SHA-256:** `06084c20691bd7cbadf0bcb6b80a4b78966f48292577beeece053eebe18c5b60`

The hash refers to the original runner artifact. The text below is unchanged except that trailing Markdown line-ending spaces were normalized for repository hygiene.

## Synthetic prompt

> I have 20 minutes. I keep noodling on whether to launch a developer tool, build another feature, or write an article. My notes are a jumble: users may not care; maybe the demo is weak; an article could build authority; I feel embarrassed showing it; perhaps I need analytics; why is this taking so long? Don’t ask me ten questions—give me a plan now.

## Skill-guided output (trailing whitespace normalized)

# Recursive Thought Map

**Mode:** Quick
**Working budget:** 20 minutes; one recursion cycle; produce and expose one reversible experiment.

## 1. Root problem

Choose between launching the developer tool, building another feature, and writing an article without using more thinking as a substitute for evidence.

## 2. Raw capture

- “I have 20 minutes.”
- “I keep noodling.”
- “Should I launch a developer tool?”
- “Should I build another feature?”
- “Should I write an article?”
- “My notes are a jumble.”
- “Users may not care.”
- “Maybe the demo is weak.”
- “An article could build authority.”
- “I feel embarrassed showing it.”
- “Perhaps I need analytics.”
- “Why is this taking so long?”
- “Don’t ask me ten questions.”
- “Give me a plan now.”

## 3. Organized ledger

| Raw item | Type | Smallest investigation or action |
|---|---|---|
| Twenty minutes | Constraint—hard | Time-box the work and stop when the artifact is sent. |
| Noodling / taking too long | Observation—unverified | Test whether avoiding exposure, rather than lacking options, is causing the delay. |
| Launch the tool | Solution idea | Test its assumption—someone wants the current result—through a small, targeted release. |
| Build another feature | Solution idea | Defer until exposure reveals a repeated capability gap. |
| Write an article | Solution idea | Compress it into a short launch note that distributes the demo rather than replacing exposure. |
| Notes are a jumble | Observation—accepted | Use this map; do not reorganize the entire notebook. |
| Users may not care | Question | Ask a few relevant developers for a concrete trial or rejection. |
| Demo may be weak | Question | Show one core task and see whether viewers understand the value without explanation. |
| Article could build authority | Observation—unverified | Test a 150-word problem–demo–invitation post, not a full article. |
| Embarrassed showing it | Reaction | Violated expectation: “It should look credible before others see it.” Test whether targeted viewers require polish or merely a useful outcome. |
| Need analytics | Solution idea | Use manual counts first: exposures, clicks/views, replies, and trial commitments. |
| Don’t ask ten questions; plan now | Constraint—hard | Make a reversible default decision with explicit follow-up branches. |

## 4. Subproblem islands

### Island A — Buyer value

**Problem:** Do relevant developers care about the job the tool performs?
**Gap:** No direct exposure evidence.
**Next artifact:** One sentence naming `[TARGET_USER]`, `[CORE_TASK]`, and the outcome, plus a trial invitation.

### Island B — Proof and demo quality

**Problem:** Can the current tool demonstrate its core outcome in under 60 seconds?
**Gap:** “Weak demo” may mean unclear framing, slow setup, or a genuinely weak result.
**Next artifact:** A current-build screenshot, GIF, link, or short recording showing one before-and-after workflow.

### Island C — Exposure and embarrassment

**Problem:** Fear of being judged may be delaying the evidence needed to choose correctly.
**Gap:** Embarrassment has not been tested against actual viewer reactions.
**Next investigation:** Send the imperfect artifact privately or to a narrow relevant audience; define success as sending, not praise.

### Island D — Distribution and measurement

**Problem:** An article and analytics look like prerequisites but may be supporting tools.
**Gap:** There is not yet enough traffic to justify instrumentation or enough evidence for a long article.
**Next artifact:** A short launch note and a four-column manual log.

**Edges**

- A → B: A confusing demo can look like absent demand.
- B → A: A clear demo produces a cleaner demand signal.
- C → A/B: Avoiding exposure preserves uncertainty about both value and demo quality.
- D → A: The short article distributes the value test.
- A → feature decision: Repeated user requests, not anxiety, should select the next feature.
- Exposure → analytics: Measurement becomes useful only after something is shown.

## 5. Synthetic diffuse pass

1. **Analogy:** A restaurant samples the existing dish before expanding the menu. Another feature is another dish; the immediate need is tasting evidence.
2. **Inversion:** A small launch would be wrong if the tool risks security, data loss, or irreversible reputational harm. Otherwise, targeted exposure is cheaper to reverse than feature work.
3. **Distance:** The buyer does not care whether this is a “launch,” “feature,” or “article.” They care whether `[CORE_TASK]` becomes easier.
4. **Connection:** Embarrassment and the desire for analytics share a cause: both postpone direct contact while seeking safer certainty.
5. **Removal:** If a public launch is forbidden, a private demo request still tests demand. If feature work is forbidden, the current product becomes testable immediately.

## 6. One recursion cycle

**Highest-leverage island:** Buyer value.

**New capture:** Current uncertainty cannot distinguish “users do not care” from “the demo fails to communicate.” More internal work will not separate them.

**Organize:** Run one probe containing the value claim, current demo, and a behavioral request:

> “I built this for `[TARGET_USER]` who need to `[CORE_TASK]`. Here is the result in under a minute. Would you try it on a real task this week? If not, what blocks you?”

**Branch map:**

- No attention → test audience or opening sentence.
- Attention but confusion → repair the demo.
- Clear understanding but no interest → reconsider the problem or segment.
- Repeated request for the same missing capability → consider that feature.
- Trial commitment → broaden the launch.

**Socialization:** Send that artifact to at least three relevant developers. Ask the single question above, not “Any thoughts?”

## 7. Graduated 20-minute experiment plan

**Decision:** Do not build another feature or write a full article now. Launch a narrow evidence-gathering package using the current tool.

- **0–2 min:** Freeze scope. Write the `[TARGET_USER] → [CORE_TASK] → outcome` sentence.
- **2–6 min:** Write the trial invitation and choose one core workflow.
- **6–11 min:** Capture the shortest viable demo. Fix only blockers that prevent the outcome from being seen; add no feature.
- **11–15 min:** Write a 150-word launch note: problem, current approach, demo, invitation.
- **15–17 min:** Create a manual log: recipient/channel, viewed, replied, committed to try.
- **17–20 min:** Send to three relevant people or publish in one focused channel.

**Convergence rule:** After five qualified exposures or 24 hours, use the branch map above. Until then, analytics infrastructure, a full article, and speculative feature work remain discarded alternatives. Success in this session is the artifact leaving your hands.
