// Render one eval iteration as a page a person can actually read.
//
// The iteration on disk is a run.json, a grading.json and a folder of markdown.
// That is the right shape to keep and the wrong shape to read: judging whether a
// rule improved the writing means putting the old text and the new text next to
// each other, with the reader's own complaint above them, and letting the eye do
// the comparing. The user asked for exactly that.
//
// The order on each card is the order the judgement needs:
//   1. what you said        — the complaint is why the case exists
//   2. what I wrote         — the real text, quoted from the corpus
//   3. what it would say    — the same thing under the new rule
//   4. the rule, and my grading, marked as mine

import { escapeHtml } from "./proposalReview.mjs";
import { REVIEW_SCRIPT, REVIEW_STYLE } from "./reviewPageChrome.mjs";

const EXTRA_STYLE = `
.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:14px 0}
.pair .col{border-radius:12px;padding:14px 16px;font-size:14.5px;line-height:1.6}
.pair .col h4{margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.05em}
.pair .col.before{background:var(--red-soft);border:1px solid #f6d3d8}
.pair .col.before h4{color:var(--red-ink)}
.pair .col.after{background:var(--green-soft);border:1px solid #c9ecdb}
.pair .col.after h4{color:var(--green-ink)}
.pair .col pre{white-space:pre-wrap;font-family:inherit;margin:0}
.pair .col code,.pair .col pre code{background:rgba(0,0,0,.05);border:none}
.reaction{border-left:4px solid var(--ink);background:#fff;padding:12px 16px;border-radius:0 10px 10px 0;margin:6px 0 14px;font-size:16px}
.reaction b{display:block;font-size:11.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:5px}
.rulebar{margin-top:12px;padding:11px 15px;border-radius:10px;background:var(--neutral-soft);font-size:14px}
.gradeline{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}
.grade{border-radius:99px;padding:4px 12px;font-size:12.5px;font-weight:700}
.grade.pass{background:var(--green-soft);color:var(--green-ink)}
.grade.broke{background:var(--red-soft);color:var(--red-ink)}
.notrun{border:1px dashed var(--amber);background:var(--amber-soft);color:var(--amber-ink);border-radius:12px;padding:14px 16px;margin-top:16px;font-size:14.5px}
.det{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:14px}
.det .cell{border:1px solid var(--line);border-radius:11px;padding:12px 14px;background:#fbfcff;font-size:14px}
.det .cell b{display:block;font-size:11.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin-bottom:4px}
.det .cell .big{display:block;font-size:19px;font-weight:800}
.warnbox{border:1px solid #efd59a;background:var(--amber-soft);color:var(--amber-ink);border-radius:12px;padding:14px 18px;margin:0 0 22px;font-size:15px}
@media (max-width:760px){.pair{grid-template-columns:1fr}.det{grid-template-columns:1fr}}
`;

function body(markdown) {
  // The artifacts are small markdown files written by this plugin. Only the
  // part after the "---" separator is the specimen; the heading above it
  // explains where the specimen came from.
  const text = String(markdown ?? "");
  const cut = text.indexOf("\n---\n");
  return cut === -1 ? text.trim() : text.slice(cut + 5).trim();
}

function preamble(markdown) {
  const text = String(markdown ?? "");
  const cut = text.indexOf("\n---\n");
  const head = cut === -1 ? "" : text.slice(0, cut);
  return head.split("\n").filter((l) => l.trim() && !l.startsWith("#")).join(" ").trim();
}

function caseCard(entry, index) {
  const grade = entry.grade ?? {};
  return `
  <div class="proposal">
    <div class="phead">
      <h3>${index}. ${escapeHtml(entry.title)}</h3>
      <span class="badge refine">${escapeHtml(entry.ruleId)}</span>
    </div>

    <div class="reaction"><b>What you said</b>${escapeHtml(entry.reaction)}</div>

    <div class="pair">
      <div class="col before">
        <h4>What I wrote — the real text</h4>
        <pre>${escapeHtml(body(entry.baseline))}</pre>
      </div>
      <div class="col after">
        <h4>What it would say under the new rule</h4>
        <pre>${escapeHtml(body(entry.revised))}</pre>
      </div>
    </div>

    <div class="rulebar"><b>The rule being tested:</b> ${escapeHtml(entry.rule)}</div>

    <div class="gradeline">
      <span class="grade broke">${grade.baselineBreaksTheRule ? "The old text breaks it" : "The old text does not break it"}</span>
      <span class="grade pass">${grade.revisedFollowsTheRule ? "The new text follows it" : "The new text does not follow it"}</span>
    </div>
    <p class="why" style="color:var(--muted);font-size:13.5px">${escapeHtml(grade.how ?? "")} ${escapeHtml(grade.howRevised ?? "")}</p>

    <div class="verdict-controls" data-review-id="${escapeHtml(entry.ruleId)}">
      <b>Does the new text actually read better to you?</b>
      <div class="review-options">
        <label><input type="radio" name="${escapeHtml(entry.ruleId)}" value="better"> Yes, better</label>
        <label><input type="radio" name="${escapeHtml(entry.ruleId)}" value="no-difference"> No real difference</label>
        <label><input type="radio" name="${escapeHtml(entry.ruleId)}" value="worse"> Worse</label>
        <label><input type="radio" name="${escapeHtml(entry.ruleId)}" value="rule-wrong"> The rule itself is wrong</label>
      </div>
      <textarea data-review-question-notes placeholder="What you would have wanted instead."></textarea>
    </div>
  </div>`;
}

export function renderIterationReview(model) {
  const { skill, iteration, generatedAt, cases, notRun, deterministic, humanReview, artifactName } = model;
  const det = deterministic ?? {};
  const before = det.reproducedFromGit?.before ?? {};
  const after = det.reproducedFromGit?.after ?? {};
  const size = det.skillSize ?? {};
  const approvalRecorded = humanReview?.status === "approved";
  const headline = approvalRecorded
    ? "The headings before and after the rule you approved"
    : "The same writing, before and after the rules you approved";
  const subhead = approvalRecorded
    ? "The left side preserves the headings you marked as hard to understand. The right side states the same facts directly."
    : "Every \"before\" is text I actually wrote, quoted from the corpus, with your reaction to it. Read the two columns and tell me whether the right-hand one is better.";
  const startLine = approvalRecorded
    ? `${cases.length} recorded pair${cases.length === 1 ? "" : "s"}. The rule is approved; the comparison remains open to correction.`
    : `${cases.length} pair${cases.length === 1 ? "" : "s"} to read. The machine check passed; the reading is yours.`;
  const decisionLine = approvalRecorded
    ? "<strong>Your approval is recorded.</strong> If the revised text is not better, mark it below and the rule can be reopened."
    : "Your call: on each pair, is the new text better, no different, worse, or is the rule itself wrong?";
  const footerStatus = approvalRecorded ? "human approval recorded" : "grading is the author's own and awaits yours";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<link rel="icon" href="data:,">
<title>${escapeHtml(skill)} — before and after, iteration ${escapeHtml(iteration)}</title>
<style>${REVIEW_STYLE}${EXTRA_STYLE}</style>
</head>
<body>
<main data-review-page data-review-artifact="${escapeHtml(artifactName)}">

<span class="eyebrow">${escapeHtml(skill)} · iteration ${escapeHtml(iteration)}</span>
<h1>${escapeHtml(headline)}</h1>
<p class="sub">${escapeHtml(subhead)}</p>

<div class="warnbox">
  <b>Read this before the pairs.</b> I wrote the rules, I wrote the rewrites, and I graded them. The green and red labels below are my opinion, not a result. ${escapeHtml(humanReview?.note ?? "")}
</div>

<div class="tldr">
  <span class="eyebrow">Start here</span>
  <p style="margin:0;font-size:16px"><b>${escapeHtml(startLine)}</b></p>
  <div class="det">
    <div class="cell"><b>Before the rules</b><span class="big">exit ${escapeHtml(String(before.exit ?? "?"))}</span>${escapeHtml(String(before.phrasesPresent ?? 0))} of ${escapeHtml(String(before.of ?? 4))} rules present</div>
    <div class="cell"><b>After the rules</b><span class="big">exit ${escapeHtml(String(after.exit ?? "?"))}</span>${escapeHtml(String(after.phrasesPresent ?? 0))} of ${escapeHtml(String(after.of ?? 4))} rules present</div>
    <div class="cell"><b>Skill size</b><span class="big">${escapeHtml(String(size.after ?? "?"))} lines</span>from ${escapeHtml(String(size.before ?? "?"))}, budget ${escapeHtml(String(size.budget ?? "?"))}</div>
  </div>
  <p class="ask">⤷ ${decisionLine}</p>
</div>

<section>
  <span class="kicker"><span class="dot"></span>The pairs</span>
  <h2>Your words on top, the old text left, the new text right</h2>
${cases.map((entry, i) => caseCard(entry, i + 1)).join("\n")}
</section>

${
  notRun.length > 0
    ? `<section>
  <span class="kicker"><span class="dot"></span>Not tested</span>
  <h2>${notRun.length} rule${notRun.length === 1 ? "" : "s"} could not be tested this way</h2>
  ${notRun
    .map(
      (n) =>
        `<div class="notrun"><b>${escapeHtml(n.id)}</b> — ${escapeHtml(n.rule)}<br><br>${escapeHtml(n.why ?? "")}</div>`
    )
    .join("\n")}
</section>`
    : ""
}

<section id="reply" class="decisions">
  <span class="kicker"><span class="dot"></span>Send it back</span>
  <h2>Copy one reply</h2>
  <p>Your reading is the part that decides whether these rules stay. If a pair is no better, say so and the rule comes back out.</p>
  <p class="why" style="color:var(--muted);font-size:13.5px">Opened straight from disk, the browser may refuse the clipboard or a download. Either button still fills the box below and selects it, so <b>Ctrl+C</b> always works.</p>

  <label class="review-label" for="review-notes">Anything about the set as a whole</label>
  <textarea id="review-notes" data-review-notes placeholder="Optional."></textarea>

  <label class="review-label" for="review-output">Copy-ready reply</label>
  <textarea id="review-output" data-review-output readonly aria-label="Copy-ready reply"></textarea>
  <div class="review-actions">
    <button type="button" data-review-copy>Copy reply</button>
    <button type="button" class="secondary" data-review-json>Download JSON</button>
  </div>
  <p class="copy-status" data-review-copy-status aria-live="polite"></p>
</section>

<footer>Rendered from <code>evals/skill-quality/${escapeHtml(skill)}/iterations/${escapeHtml(iteration)}/</code> · ${escapeHtml(generatedAt)} · ${escapeHtml(footerStatus)}</footer>

</main>
<script>${REVIEW_SCRIPT}</script>
</body>
</html>
`;
}

export { body as specimenBody, preamble as specimenPreamble };
