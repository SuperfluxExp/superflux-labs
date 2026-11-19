// The review surface for proposals.
//
// Why this exists: working out from raw JSON what changes are proposed, for
// which skills, with what impact and what hypothesis, is hard. A JSONL ledger
// is a record, not a review surface. Approving a change to a skill that shapes
// every later answer should take a minute and a glance, not a JSON reader.
//
// So every proposal renders as one card that answers four questions in order:
//   1. What changes, exactly — the current text and the proposed text.
//   2. Which skill, which file, which line.
//   3. What is the hypothesis, stated so it can be proved wrong later.
//   4. What does it cost — how much the file grows against its budget.
//
// Everything here is pure. The script does the reading and writing.

export const REVIEW_SCHEMA = "superflux.skill_proposal_review.v0.1";

// What each target skill governs, in the reader's terms rather than the
// repository's. Used to answer "what does this affect".
export const SKILL_SCOPE = {
  "cognitive-render": {
    file: "skills/cognitive-render/SKILL.md",
    governs: "every plain-language reply, summary, brief, and recap",
    budget: 515,
    evalDir: "evals/skill-quality/cognitive-render",
    validator: "npm run validate:cognitive-render",
  },
  "explaining-with-html": {
    file: "skills/explaining-with-html/SKILL.md",
    governs: "every HTML explainer, review page, and diagram",
    budget: 558,
    evalDir: "evals/skill-quality/explaining-with-html",
    validator: "npm run validate:explaining-with-html",
  },
};

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function distinctSessions(observation) {
  return [...new Set((observation.sightings ?? []).map((s) => s.session).filter(Boolean))];
}

function dateRangeOf(observation) {
  const dates = (observation.sightings ?? [])
    .map((s) => (typeof s.ts === "string" ? s.ts.slice(0, 10) : null))
    .filter(Boolean)
    .sort();
  if (dates.length === 0) {
    return null;
  }
  return { first: dates[0], last: dates[dates.length - 1] };
}

// Where the quoted rule sits in the skill file, so the card can say "line 88 of
// 468" instead of asking the reader to go find it.
export function locateRule(skillText, quote) {
  if (typeof skillText !== "string" || typeof quote !== "string" || quote.trim().length === 0) {
    return null;
  }
  const lines = skillText.split(/\r?\n/);
  const normalizeToken = (value) => value.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
  const wanted = quote.trim().split(/\s+/).map(normalizeToken).filter(Boolean);
  const tokens = [...skillText.matchAll(/\S+/g)].map((match) => ({
    value: normalizeToken(match[0]),
    start: match.index,
    end: match.index + match[0].length,
  }));
  const startIndex = tokens.findIndex((_, index) =>
    wanted.every((value, offset) => tokens[index + offset]?.value === value)
  );
  if (startIndex >= 0) {
    const start = tokens[startIndex].start;
    const end = tokens[startIndex + wanted.length - 1].end;
    const line = skillText.slice(0, start).split(/\r?\n/).length;
    const text = skillText.slice(start, end).replace(/\s+/g, " ").trim();
    return { line, totalLines: lines.length, text };
  }
  return { line: null, totalLines: lines.length, text: null };
}

// How many lines the file gains if this is accepted. A refine replaces the
// quoted text, so it is the difference; a new rule is pure addition.
export function sizeImpact(observation, skillText) {
  const wrapped = (text) => Math.max(1, Math.ceil(String(text ?? "").length / 90));
  // Nothing is removed, whatever the verdict: a refine adds its sentence beside
  // the rule it sharpens rather than replacing it, because replacing deletes
  // parts of the old rule the new one never claimed to cover. Only the
  // consolidation pass takes text out, and it is reviewed on its own.
  const added = wrapped(observation.rule_text);
  return { added, removed: 0, delta: added };
}

// The hypothesis, written so a later run can prove it wrong.
export function hypothesisFor(observation) {
  const sessions = distinctSessions(observation).length;
  const range = dateRangeOf(observation);
  const when = range ? (range.first === range.last ? `on ${range.first}` : `between ${range.first} and ${range.last}`) : "";
  const times = (observation.sightings ?? []).length;
  return (
    `You said something like this ${times} ${times === 1 ? "time" : "times"} across ${sessions} ` +
    `${sessions === 1 ? "session" : "different sessions"} ${when}. ` +
    "The claim is that with this rule in the skill, those moments stop. " +
    "If they keep showing up in later runs, the rule did not work and should come back out."
  );
}

// One card's worth of facts. Pure.
export function buildProposalView(observation, skillText, evalPack = {}) {
  const scope = SKILL_SCOPE[observation.skill] ?? { file: "unknown", governs: "unknown", budget: null };
  const location = observation.existing_rule_quote ? locateRule(skillText, observation.existing_rule_quote) : null;
  const impact = sizeImpact(observation, skillText);
  const currentLines = typeof skillText === "string" ? skillText.split(/\r?\n/).length : null;
  return {
    id: observation.id,
    skill: observation.skill,
    file: scope.file,
    governs: scope.governs,
    verdict: observation.verdict,
    before: observation.verdict === "refine" ? observation.existing_rule_quote : null,
    after: observation.rule_text,
    location,
    hypothesis: hypothesisFor(observation),
    problem: problemStatement(observation),
    cause: rootCause(observation),
    change: changeAndBenefit(observation),
    validation: validationPlan(observation, evalPack),
    sessions: distinctSessions(observation).length,
    sightings: observation.sightings ?? [],
    range: dateRangeOf(observation),
    impact,
    size: currentLines === null ? null : { current: currentLines, after: currentLines + impact.delta, budget: scope.budget },
  };
}

// Observations that are eligible, and the ones that are deliberately not.
export function splitLedger(observations, isReady) {
  const proposals = [];
  const notProposing = [];
  const belowThreshold = [];
  const heldByUser = [];
  for (const observation of observations) {
    // Asking again about something the reader already said "not yet" to is how
    // a review surface turns into nagging.
    if (observation.deferred_by === "user") {
      heldByUser.push(observation);
    } else if (isReady(observation)) {
      proposals.push(observation);
    } else if (observation.verdict === "example") {
      notProposing.push(observation);
    } else {
      belowThreshold.push(observation);
    }
  }
  return { proposals, notProposing, belowThreshold, heldByUser };
}

// ---------------------------------------------------------------------------
// The four questions a reader needs answered before approving a rule, in the
// order the user named them: what was the problem, what text missed it or is
// missing, what changes and what should get better, and how the claim gets
// tested.

// 1. What was the problem. Not the rule — the moment the reader had to stop.
export function problemStatement(observation) {
  const sightings = observation.sightings ?? [];
  const sessions = new Set(sightings.map((s) => s.session).filter(Boolean)).size;
  const times = sightings.length;
  return {
    summary:
      `You had to stop and ask, ${times} ${times === 1 ? "time" : "times"} across ` +
      `${sessions} ${sessions === 1 ? "session" : "different sessions"}. ` +
      "Each time the writing had already gone out, and you spent a turn getting it clear.",
    quotes: sightings.slice(0, 3).map((s) => s.prompt).filter(Boolean),
  };
}

// 2. The text that missed it, or the text that is missing. The root cause is
// never "the model was careless" — it is a specific sentence in the skill that
// did not cover this, or the absence of one.
export function rootCause(observation) {
  const why = observation.sightings?.[0]?.reasoning ?? null;
  if (observation.verdict === "new") {
    return {
      kind: "missing",
      text: null,
      why: why ?? "Nothing in the skill covers this case, so there was no rule to follow.",
    };
  }
  return {
    kind: "present-but-missed",
    text: observation.existing_rule_quote,
    why: why ?? "The rule exists but does not reach this case.",
  };
}

// 3. What changes, and what should get better. The benefit is stated as a
// claim about future behaviour, not as a virtue.
export function changeAndBenefit(observation) {
  const isNew = observation.verdict === "new";
  return {
    text: observation.rule_text,
    action: isNew
      ? "Adds this rule where nothing covered the case."
      : "Adds this sentence next to the rule above. The existing rule stays — this sharpens it rather than replacing it.",
    benefit:
      "If it works, that question stops being asked: the writing answers it before you have to. " +
      "If it does not work, the same question keeps appearing in later captures and the rule comes back out.",
  };
}

// 4. How the claim gets tested. Three legs, in increasing order of how much
// they actually prove.
//
// A rule with no failing case is not testable, so the first thing the plan
// demands is a case built from the user's own words — one that FAILS against
// the skill as it stands today. A change that cannot fail a test before it
// lands cannot be shown to have worked after.
export function validationPlan(observation, pack = {}) {
  const scope = SKILL_SCOPE[observation.skill] ?? {};
  const trigger = observation.sightings?.[0]?.prompt ?? null;
  const iteration = String(pack.nextIteration ?? 1).padStart(3, "0");
  return {
    newCase: {
      from: trigger,
      expectation: observation.rule_text,
      mustFailFirst: true,
    },
    legs: [
      {
        name: "The deterministic check",
        detail: `${scope.validator ?? "the skill validator"} stays green. It checks the rule file's wording and structure, and it proves nothing about whether the writing improved.`,
      },
      {
        name: "The eval pack, before and after",
        detail:
          `Run the ${pack.caseCount ?? "existing"} cases in ${scope.evalDir ?? "the eval pack"} plus the new case, ` +
          "once against the skill as it stands and once with the change. The new case has to fail the first time and pass the second, " +
          "or the rule is not doing what it claims.",
      },
      {
        name: "You read the re-rendered output",
        detail:
          `Recorded as ${scope.evalDir ?? "the eval pack"}/iterations/${iteration}/ with the run, the artifacts and the grading, ` +
          "the same format the earlier iterations use. A green validator with no page you read is not a pass.",
      },
      {
        name: "The corpus keeps score after it lands",
        detail:
          `Every later run checks whether ${observation.id} gains a sighting dated after the change merged. ` +
          "If the same complaint keeps arriving, the rule failed and is retired rather than defended.",
      },
    ],
  };
}
