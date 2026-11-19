// The process pass: what the model is asked, and what it is allowed to write.
//
// Capture records; this decides. A model reads each captured prompt WITH the
// assistant reply that preceded it and reaches one of four verdicts. Everything
// in this file is the part that must not depend on the model's good behaviour:
// batching, the record contract, matching a repeat to the rule it repeats, the
// threshold, and the report.
//
// Two rules here are not conveniences and are enforced, not documented:
//
//   1. Evidence must be REAL. `evidence.prompt` has to appear in the row it
//      cites. A model that paraphrases the user is inventing the thing the
//      whole system exists to learn from.
//   2. Rule text must be AUTHORED, never lifted. The corpus is full of text the
//      user pasted from other systems — alerts, tickets, web pages. Copying a
//      span out of it into a skill file is how someone else's words become a
//      standing instruction. A rule that is a verbatim span of the row or its
//      reply is rejected.

export const OBSERVATION_SCHEMA = "superflux.sf_learning_observation.v0.1";

export const VERDICTS = ["new", "refine", "example", "drop"];

export const DROP_REASONS = [
  "not-about-writing",
  "no-target-skill",
  "reply-not-referent",
  "already-proposed",
];

// Stream 2 targets. Voice skills are deliberately absent: stream 2 changes
// instructions, and skills that write in the user's voice receive the stream-1
// voice card instead. Restated here at the point where a model could get it wrong.
export const TARGET_SKILLS = ["cognitive-render", "explaining-with-html"];

export const OPEN_STATUSES = ["open", "contradiction"];

export const DEFAULT_BATCH_SIZE = 40;

// Two sightings in DIFFERENT sessions. Same-session repetition is one person
// pushing on one thing once, not a pattern.
export const PROPOSE_THRESHOLD = 2;

// ---------------------------------------------------------------------------
// Rows in, batch out.

// A row the pass should read at all: real human text, not a slash command, not
// a runtime-injected block.
export function isUsableRow(row) {
  if (!row || typeof row !== "object") {
    return false;
  }
  if (row.provenance === "machine") {
    return false;
  }
  if (row.is_slash_command === true) {
    return false;
  }
  return typeof row.text === "string" && row.text.trim().length > 0;
}

// Rows after the watermark, oldest first, capped at `size`. Pure.
export function nextBatch(rows, watermarkTs, size = DEFAULT_BATCH_SIZE) {
  const after = rows
    .filter(isUsableRow)
    .filter((row) => typeof row.ts === "string" && (!watermarkTs || row.ts > watermarkTs))
    .sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
  return after.slice(0, size);
}

// What the model is shown for one row. The regex flags are included and named
// as a HINT: they miss real corrections ("explain like a human" carries
// neither) and fire on long task briefs. They are never a filter.
export function rowForModel(row) {
  return {
    ts: row.ts,
    session: typeof row.session === "string" ? row.session.slice(0, 8) : null,
    runtime: row.runtime ?? null,
    prompt: row.text,
    reply: row.reply?.text ?? null,
    reply_absent_because: row.reply?.text ? null : (row.reply?.reason ?? "no-reply-field"),
    regex_hint: {
      is_correction: row.is_correction === true,
      is_comprehension: row.is_comprehension === true,
      note: "a hint only, not a filter — read the row regardless",
    },
  };
}

// The open observations a model needs in order to say "this is that rule
// again" instead of writing a third record for the same complaint.
export function openObservationsForModel(observations) {
  return observations
    .filter((obs) => OPEN_STATUSES.includes(obs.status))
    .map((obs) => ({
      id: obs.id,
      skill: obs.skill,
      verdict: obs.verdict,
      rule_text: obs.rule_text,
      occurrences: occurrencesOf(obs),
    }));
}

// ---------------------------------------------------------------------------
// The record contract.

function normalize(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

// Is `quote` really present in `source`? Whitespace-insensitive, because the
// model will not reproduce line breaks exactly, and that is not the lie we are
// guarding against.
export function quoteAppearsIn(quote, source) {
  const q = normalize(quote);
  if (q.length === 0) {
    return false;
  }
  return normalize(source).includes(q);
}

// Validate one observation against its row. Returns { ok, errors }.
// Every rejection names the field, so a model can be told exactly what to fix.
export function validateObservation(observation, row) {
  const errors = [];
  const obs = observation ?? {};

  if (!VERDICTS.includes(obs.verdict)) {
    errors.push(`verdict must be one of ${VERDICTS.join(", ")}`);
  }
  if (typeof obs.about_writing !== "boolean") {
    errors.push("about_writing must be true or false");
  }
  if (obs.about_writing === false && obs.verdict !== "drop") {
    errors.push("a row that is not about writing can only be dropped");
  }
  if (obs.verdict === "drop") {
    if (!DROP_REASONS.includes(obs.drop_reason)) {
      errors.push(`drop_reason must be one of ${DROP_REASONS.join(", ")}`);
    }
  } else if (obs.drop_reason) {
    errors.push("drop_reason belongs only on a drop");
  }

  if (obs.verdict && obs.verdict !== "drop") {
    if (!TARGET_SKILLS.includes(obs.skill)) {
      errors.push(`skill must be one of ${TARGET_SKILLS.join(", ")} (the voice skills receive stream 1, never a rule)`);
    }
  }

  if (obs.verdict === "new" || obs.verdict === "refine") {
    if (typeof obs.rule_text !== "string" || obs.rule_text.trim().length < 10) {
      errors.push("rule_text is required for new and refine, and must be a sentence");
    }
  }
  if (obs.verdict === "refine" && (typeof obs.existing_rule_quote !== "string" || obs.existing_rule_quote.trim().length === 0)) {
    errors.push("refine must quote the existing rule it sharpens, so the diff displaces instead of appends");
  }
  if (obs.verdict === "example" && obs.rule_text && obs.existing_rule_quote === undefined) {
    errors.push("example must point at the rule that was ignored via existing_rule_quote");
  }

  // Evidence has to be real.
  if (obs.verdict !== "drop") {
    const promptQuote = obs.evidence?.prompt;
    if (typeof promptQuote !== "string" || promptQuote.trim().length === 0) {
      errors.push("evidence.prompt is required: quote the user's own words");
    } else if (row && !quoteAppearsIn(promptQuote, row.text)) {
      errors.push("evidence.prompt does not appear in the row it cites — quote, do not paraphrase");
    }
    const replyQuote = obs.evidence?.reply;
    if (typeof replyQuote === "string" && replyQuote.trim().length > 0 && row) {
      const replyText = row.reply?.text ?? "";
      if (!quoteAppearsIn(replyQuote, replyText)) {
        errors.push("evidence.reply does not appear in the stored reply");
      }
    }
    if (typeof obs.evidence?.reasoning !== "string" || obs.evidence.reasoning.trim().length < 10) {
      errors.push("evidence.reasoning is required: say why this is that verdict");
    }
  }

  // Rule text must be authored, not lifted out of the corpus.
  if (typeof obs.rule_text === "string" && obs.rule_text.trim().length > 0 && row) {
    if (quoteAppearsIn(obs.rule_text, row.text) || quoteAppearsIn(obs.rule_text, row.reply?.text ?? "")) {
      errors.push(
        "rule_text is a verbatim span of the captured text — write the rule in your own words; " +
          "copying the corpus is how someone else's sentence becomes a standing instruction"
      );
    }
  }

  return { ok: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Ledger records.

export function occurrencesOf(observation) {
  const sessions = new Set((observation.sightings ?? []).map((s) => s.session).filter(Boolean));
  return sessions.size;
}

export function readyToPropose(observation) {
  if (!["new", "refine"].includes(observation.verdict)) {
    return false;
  }
  if (observation.status !== "open") {
    return false;
  }
  return observation.promoted_by === "user" || occurrencesOf(observation) >= PROPOSE_THRESHOLD;
}

function sightingFrom(observation, row) {
  return {
    ts: row.ts,
    session: row.session ?? null,
    runtime: row.runtime ?? null,
    prompt: observation.evidence?.prompt ?? null,
    reply: observation.evidence?.reply ?? null,
    reasoning: observation.evidence?.reasoning ?? null,
  };
}

// Build the record that goes on disk. Pure.
export function buildObservation(observation, row, meta) {
  return {
    schema: OBSERVATION_SCHEMA,
    id: meta.id,
    created_at: meta.now,
    batch: meta.batch,
    model: meta.model,
    about_writing: observation.about_writing === true,
    skill: observation.skill ?? null,
    verdict: observation.verdict,
    drop_reason: observation.drop_reason ?? null,
    rule_text: observation.rule_text ?? null,
    existing_rule_quote: observation.existing_rule_quote ?? null,
    contradicts: observation.contradicts ?? null,
    status: observation.contradicts ? "contradiction" : "open",
    promoted_by: null,
    sightings: [sightingFrom(observation, row)],
  };
}

// Fold a repeat into the record it repeats. Pure: returns a new record.
//
// This is the step the first draft of the spec did not name, and without it the
// threshold is unreachable: three separate records of one complaint each carry
// an occurrence count of one forever.
export function mergeSighting(existing, observation, row) {
  const sighting = sightingFrom(observation, row);
  const alreadySeen = (existing.sightings ?? []).some((s) => s.ts === sighting.ts);
  if (alreadySeen) {
    return existing;
  }
  return {
    ...existing,
    sightings: [...(existing.sightings ?? []), sighting],
    // A contradiction found on a later sighting still escalates the record.
    contradicts: existing.contradicts ?? observation.contradicts ?? null,
    status: existing.contradicts || observation.contradicts ? "contradiction" : existing.status,
  };
}

// Next id for a month, continuing whatever is already in the ledger.
export function nextObservationId(existing, month) {
  const prefix = `obs-${month}-`;
  let highest = 0;
  for (const obs of existing) {
    if (typeof obs.id === "string" && obs.id.startsWith(prefix)) {
      const n = Number.parseInt(obs.id.slice(prefix.length), 10);
      if (Number.isFinite(n) && n > highest) {
        highest = n;
      }
    }
  }
  return `${prefix}${String(highest + 1).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// Applying a batch.

// Apply validated observations to the ledger. Pure.
// Returns { observations, report, rejected }.
export function applyBatch(existing, judgements, rowsByTs, meta) {
  const observations = [...existing];
  const byId = new Map(observations.map((obs, index) => [obs.id, index]));
  const report = {
    read: judgements.length,
    new: 0,
    refine: 0,
    example: 0,
    drop: 0,
    merged: 0,
    contradictions: 0,
    dropReasons: {},
    rejected: 0,
    readyToPropose: [],
  };
  const rejected = [];

  for (const judgement of judgements) {
    const row = rowsByTs.get(judgement.ts);
    if (!row) {
      rejected.push({ judgement, errors: [`no row in this batch with ts ${judgement.ts}`] });
      report.rejected++;
      continue;
    }
    const { ok, errors } = validateObservation(judgement, row);
    if (!ok) {
      rejected.push({ judgement, errors });
      report.rejected++;
      continue;
    }

    report[judgement.verdict]++;
    if (judgement.verdict === "drop") {
      report.dropReasons[judgement.drop_reason] = (report.dropReasons[judgement.drop_reason] ?? 0) + 1;
      continue; // a drop is counted, not stored: it would bloat the ledger with nothing to act on
    }

    if (judgement.matches && byId.has(judgement.matches)) {
      const index = byId.get(judgement.matches);
      observations[index] = mergeSighting(observations[index], judgement, row);
      report.merged++;
      if (observations[index].status === "contradiction") {
        report.contradictions++;
      }
      continue;
    }

    const record = buildObservation(judgement, row, {
      id: nextObservationId(observations, meta.month),
      now: meta.now,
      batch: meta.batch,
      model: meta.model,
    });
    observations.push(record);
    byId.set(record.id, observations.length - 1);
    if (record.status === "contradiction") {
      report.contradictions++;
    }
  }

  report.readyToPropose = observations.filter(readyToPropose).map((obs) => obs.id);
  return { observations, report, rejected };
}

// The line a run must print even when it is inconvenient.
//
// `example` means the rule already exists and was ignored, and it produces no
// diff. It is the verdict a model is most tempted to skip, because proposing a
// new rule looks like more useful work than saying "you ignored the rule you
// have". A run that never reached it says so out loud.
export function exampleWarning(report) {
  if (report.example > 0) {
    return null;
  }
  const judged = report.new + report.refine + report.example + report.drop;
  if (judged === 0) {
    return null;
  }
  return (
    `no "example" verdicts in ${judged} rows judged — either the skills were followed, ` +
    "or the pass is reaching for new rules instead of noticing existing ones. Worth a look."
  );
}
