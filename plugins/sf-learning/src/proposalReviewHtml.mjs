// Render the proposal review page. Pure: facts in, one self-contained HTML
// string out. No network, no fonts, no scripts from anywhere else — the page
// has to open from disk and work.
//
// Layout follows the house rules for a review artifact: light mode only, the
// answer visible without expanding anything, depth behind expanders, and the
// decision surface never collapsed. Each card leads with the change itself —
// current text on the left, proposed text on the right — because that is the
// thing being approved.

import { escapeHtml } from "./proposalReview.mjs";
import { REVIEW_SCRIPT, REVIEW_STYLE } from "./reviewPageChrome.mjs";

function sightingBlock(sighting) {
  const when = escapeHtml(String(sighting.ts ?? "").slice(0, 10));
  const session = escapeHtml(String(sighting.session ?? "").slice(0, 8));
  return `<div class="sighting"><div class="when">${when} · session ${session}</div>${escapeHtml(sighting.prompt ?? "")}</div>`;
}

function proposalCard(view, index) {
  const isNew = view.verdict === "new";
  const where = view.location?.line
    ? `line ${view.location.line} of ${view.location.totalLines}`
    : isNew ? "a new line" : "not located in the file";
  const size = view.size
    ? `${view.size.current} lines today → about ${view.size.after} after, against a budget of ${view.size.budget}`
    : "unknown";
  const said = view.problem.quotes.map((q) => `<div class="said">${escapeHtml(q)}</div>`).join("");
  const allSightings = view.sightings.length > 3
    ? `<details class="more"><summary>All ${view.sightings.length} times, with dates</summary><div>${view.sightings.map(sightingBlock).join("")}</div></details>`
    : "";
  const sightingEvidence = [said, allSightings].filter(Boolean).join("\n        ");
  const causeText = view.cause.kind === "missing"
    ? `<div class="ruletext none">Nothing in ${escapeHtml(view.skill)} covers this case. There was no rule to follow.</div>`
    : `<div class="ruletext old">${escapeHtml(view.cause.text)}</div>`;
  const legs = view.validation.legs
    .map((leg) => `<li><b>${escapeHtml(leg.name)}.</b> ${escapeHtml(leg.detail)}</li>`)
    .join("");
  const newCase = view.validation.newCase.from
    ? `<div class="newcase"><b>The case that has to fail first:</b> feed the skill the situation that produced
         “${escapeHtml(String(view.validation.newCase.from).slice(0, 160))}”, and check the output against the new rule.
         It must fail against the skill as it stands today. A change that cannot fail a test before it lands cannot be
         shown to have worked after.</div>`
    : "";

  return `
  <div class="proposal ${isNew ? "new" : ""}">
    <div class="phead">
      <h3>${index}. ${escapeHtml(view.skill)} — ${isNew ? "add a rule that is missing" : "sharpen a rule that did not catch it"}</h3>
      <span class="badge ${isNew ? "new" : "refine"}">${escapeHtml(view.verdict)}</span>
    </div>
    <p class="meta"><code>${escapeHtml(view.file)}</code> · ${escapeHtml(where)} · affects ${escapeHtml(view.governs)} · ${escapeHtml(view.id)}</p>

    <div class="qblock">
      <div class="qhead"><span class="qnum">1</span><span class="qtitle">What was the problem</span></div>
      <div class="qbody">
        <p>${escapeHtml(view.problem.summary)}</p>${sightingEvidence ? `\n        ${sightingEvidence}` : ""}
      </div>
    </div>

    <div class="qblock">
      <div class="qhead"><span class="qnum">2</span><span class="qtitle">${isNew ? "The text that is missing" : "The text that missed it, and stays"}</span></div>
      <div class="qbody">
        ${causeText}
        <p class="why"><b>Why it missed:</b> ${escapeHtml(view.cause.why)}</p>
      </div>
    </div>

    <div class="qblock">
      <div class="qhead"><span class="qnum">3</span><span class="qtitle">What changes, and what should get better</span></div>
      <div class="qbody">
        <p class="why">${escapeHtml(view.change.action)}</p>
        <div class="ruletext newtext">${escapeHtml(view.change.text)}</div>
        <div class="benefit"><b>The claim:</b> ${escapeHtml(view.change.benefit)}</div>
        <p class="why"><b>Size cost:</b> ${escapeHtml(size)}</p>
      </div>
    </div>

    <div class="qblock">
      <div class="qhead"><span class="qnum">4</span><span class="qtitle">How we test the claim</span></div>
      <div class="qbody">
        ${newCase}
        <ul class="legs">${legs}</ul>
      </div>
    </div>

    <div class="verdict-controls" data-review-id="${escapeHtml(view.id)}">
      <b>Your call on this one</b>
      <div class="review-options">
        <label><input type="radio" name="${escapeHtml(view.id)}" value="approve"> Approve — run the test, then the pull request</label>
        <label><input type="radio" name="${escapeHtml(view.id)}" value="reject"> Reject — never propose again</label>
        <label><input type="radio" name="${escapeHtml(view.id)}" value="reword"> Approve with my wording</label>
        <label><input type="radio" name="${escapeHtml(view.id)}" value="wait"> Not yet — keep collecting</label>
      </div>
      <textarea data-review-question-notes placeholder="Your wording, or why not."></textarea>
    </div>
  </div>`;
}

export function renderProposalReview(model) {
  const { generatedAt, ledgerPath, views, notProposing, belowThreshold, totals } = model;
  const heldByUser = model.heldByUser ?? [];
  const cards = views.map((view, i) => proposalCard(view, i + 1)).join("\\n");
  const bySkill = {};
  for (const view of views) {
    bySkill[view.skill] = (bySkill[view.skill] ?? 0) + 1;
  }
  const skillLine = Object.entries(bySkill).map(([skill, n]) => `${n} to ${skill}`).join(", ") || "none";
  const ignoredRows = notProposing
    .slice(0, 12)
    .map(
      (o) =>
        `<tr><td>${escapeHtml(o.skill ?? "")}</td><td>${escapeHtml((o.existing_rule_quote ?? "").slice(0, 110))}</td><td>${(o.sightings ?? []).length}</td></tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<link rel="icon" href="data:,">
<title>sf-learning — skill changes waiting for your approval</title>
<style>${REVIEW_STYLE}</style>
</head>
<body>
<main data-review-page data-review-artifact="${escapeHtml(model.artifactName ?? "skill-proposal-review.html")}">

<span class="eyebrow">sf-learning · proposals</span>
<h1>${views.length} change${views.length === 1 ? "" : "s"} to your writing skills, waiting for you</h1>
<p class="sub">Each one answers four things: what the problem was, which text missed it, what changes and what should get better, and how the claim gets tested. Approve or reject at the bottom of each card.</p>

<div class="tldr">
  <span class="eyebrow">Start here</span>

  <p style="margin:0;font-size:16px"><b>${views.length} proposal${views.length === 1 ? "" : "s"} passed the threshold of being said in two different sessions: ${escapeHtml(skillLine)}.</b></p>
  <ul>
    <li><b>${totals.records} observations recorded in total.</b> ${totals.example} of them found the rule already there and changed nothing.</li>
    <li><b>Nothing here is applied.</b> Approving marks it for a pull request against the skill file, which you review again as a diff.</li>
    <li><b>Every proposal names what it would cost</b> in lines against the skill's size budget, so the file cannot quietly grow.</li>
  </ul>
  <p class="ask">⤷ Your call: approve, reject, reword, or wait — on each card, then copy one reply.</p>
</div>

<div class="color-key" aria-label="What the colours mean">
  <b>On each card:</b>
  <span><i class="color-dot change"></i>Red is what failed or is missing</span>
  <span><i class="color-dot add"></i>Green is the proposed text</span>
  <span><i class="color-dot none"></i>Nothing is applied until you approve</span>
</div>

<section>
  <span class="kicker"><span class="dot"></span>1 · The changes</span>
  <h2>Problem, cause, change, test — one card each</h2>
${cards}
</section>

<section>
  <span class="kicker"><span class="dot"></span>2 · What is not being proposed</span>
  <h2>${totals.example} times the rule was already there</h2>
  <p>These were recorded as evidence and produce no change at all. They are the reason the skills are not growing every week.</p>
  <div class="table-scroll">
    <table>
      <tr><th>Skill</th><th>The rule that already covered it</th><th>Times</th></tr>
      ${ignoredRows}
    </table>
  </div>
  <p class="takeaway"><b>${belowThreshold.length} more</b> would change something but have only been seen in one session, so they wait for a second.${
    heldByUser.length > 0
      ? ` <b>${heldByUser.length}</b> ${heldByUser.length === 1 ? "is" : "are"} held because you said not yet — ${escapeHtml(heldByUser.map((o) => o.id).join(", "))}. They keep collecting evidence and will not be asked about again until you ask.`
      : ""
  }</p>
</section>

<section id="reply" class="decisions">
  <span class="kicker"><span class="dot"></span>3 · Send it back</span>
  <h2>Copy one reply</h2>
  <p>Your choices above compile here. Paste it back into the session and the approved ones become a pull request.</p>
  <p class="why">Opened straight from disk, the browser may refuse to reach the clipboard or save a file. Either button still fills the box below and selects it, so <b>Ctrl+C</b> always works.</p>

  <label class="review-label" for="review-notes">Anything about the batch as a whole</label>
  <textarea id="review-notes" data-review-notes placeholder="Optional."></textarea>

  <label class="review-label" for="review-output">Copy-ready reply</label>
  <textarea id="review-output" data-review-output readonly aria-label="Copy-ready reply"></textarea>
  <div class="review-actions">
    <button type="button" data-review-copy>Copy reply</button>
    <button type="button" class="secondary" data-review-json>Download JSON</button>
  </div>
  <p class="copy-status" data-review-copy-status aria-live="polite"></p>
</section>

<footer>Generated from <code>${escapeHtml(ledgerPath)}</code> · ${escapeHtml(generatedAt)} · nothing is applied until you approve and the pull request is merged</footer>

</main>
<script>${REVIEW_SCRIPT}</script>
</body>
</html>
`;
}
