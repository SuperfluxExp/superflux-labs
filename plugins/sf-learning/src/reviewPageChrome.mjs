// The shared chrome for every review page this plugin renders: the look, and
// the script behind the two buttons.
//
// It lives in one file because the buttons were broken once already — an
// escaping slip stopped the whole script parsing, and neither button had a
// handler. A second copy of that logic is a second chance to make the same
// mistake, and a second place to forget the fix.
//
// It is a CLASSIC script, never type="module". These pages are read by opening
// the file, and Chrome refuses to run a module script on a file:// page — the
// script simply never executes, so every button is dead and nothing says why.
// The script imports nothing, so it has no reason to be a module. This is the
// second time the buttons were reported as doing nothing; the first was an
// escaping slip, and this was underneath it.
//
// The rules the script keeps, whatever the page:
//   - the text lands in the visible box and is selected BEFORE any copy is
//     attempted, so a browser that refuses the clipboard still leaves it
//     copyable with Ctrl+C
//   - the JSON button fills that same box rather than only offering a download,
//     because a file:// page may not be allowed to save one
//   - the download, when it works, uses an anchor that is in the document and
//     an object URL that outlives the click

export const REVIEW_STYLE = `
:root{color-scheme:light;--ink:#1c2030;--muted:#646b80;--faint:#8b91a4;--bg:#f4f6fc;--bg2:#f7f8fb;--card:#fff;
--line:#e7eaf3;--line2:#eef1f8;--neutral:#5d6475;--neutral-soft:#f1f3f7;--neutral-ink:#3f4658;
--blue:#2f6df0;--blue-soft:#eaf1fe;--blue-ink:#1a4598;--red:#e0455a;--red-soft:#fdebed;--red-ink:#9a1f30;
--green:#18996b;--green-soft:#e6f7ef;--green-ink:#0e6347;--amber:#bd7d09;--amber-soft:#fdf4de;--amber-ink:#7a5300;
--shadow:0 1px 2px rgba(26,30,55,.04),0 10px 30px -16px rgba(26,30,55,.16);--shadow-sm:0 1px 2px rgba(26,30,55,.05)}
*{box-sizing:border-box}
body{margin:0;padding:44px 18px 90px;font-size:16px;line-height:1.62;color:var(--ink);
font-family:"Segoe UI",system-ui,-apple-system,Roboto,sans-serif;
background:radial-gradient(1100px 420px at 50% -120px,#eef2fe 0,rgba(238,242,254,0) 70%),linear-gradient(180deg,var(--bg) 0,var(--bg2) 320px)}
main{max-width:1040px;margin:0 auto}
.eyebrow{display:inline-block;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--blue);margin-bottom:12px}
h1{font-size:31px;line-height:1.18;letter-spacing:-.015em;margin:0 0 10px}
h2{font-size:21px;line-height:1.25;margin:0 0 4px}
h3{font-size:17px;margin:0 0 6px}
.sub{color:var(--muted);margin:0 0 28px;font-size:17px;max-width:70ch}
p{margin:10px 0}
code{background:var(--line2);border:1px solid var(--line);border-radius:6px;padding:1px 6px;font-family:Consolas,"SF Mono",monospace;font-size:13.5px}
section{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:26px 30px;margin-bottom:22px;box-shadow:var(--shadow)}
.kicker{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--blue);margin-bottom:12px}
.kicker .dot{width:7px;height:7px;border-radius:50%;background:var(--blue)}
.tldr{background:linear-gradient(135deg,#fff 0,#f4f8ff 100%);border:1px solid #d8e3fb;border-left:5px solid var(--blue);border-radius:16px;padding:22px 26px;margin-bottom:24px;box-shadow:var(--shadow)}
.tldr ul{margin:12px 0 0;padding-left:0;list-style:none}
.tldr li{position:relative;padding-left:26px;margin:9px 0}
.tldr li::before{content:"";position:absolute;left:4px;top:9px;width:8px;height:8px;border-radius:50%;background:var(--blue)}
.ask{margin-top:14px;padding:11px 15px;border-radius:10px;background:var(--blue-soft);color:var(--blue-ink);font-weight:600;font-size:15px}
.takeaway{font-size:15.5px;margin-top:16px;padding:11px 15px;border-radius:10px;background:var(--blue-soft);color:var(--blue-ink)}
.proposal{border:1px solid var(--line);border-left:5px solid var(--amber);border-radius:0 14px 14px 0;padding:20px 22px;margin-top:18px;background:#fff;box-shadow:var(--shadow-sm)}
.proposal.new{border-left-color:var(--blue)}
.phead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-bottom:4px}
.badge{display:inline-block;border-radius:99px;padding:3px 10px;font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}
.badge.refine{background:var(--amber-soft);color:var(--amber-ink)}
.badge.new{background:var(--blue-soft);color:var(--blue-ink)}
.badge.example{background:var(--neutral-soft);color:var(--neutral-ink)}
.meta{color:var(--muted);font-size:13.5px;margin:2px 0 14px}
.change{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:14px 0 4px}
.change .side{border:1px solid var(--line);border-radius:12px;padding:13px 15px;background:#fbfcff}
.change .side b{display:block;font-size:11.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin-bottom:6px}
.change .side.before{background:var(--red-soft);border-color:#f6d3d8}
.change .side.after{background:var(--green-soft);border-color:#c9ecdb}
.change .side.none{color:var(--muted);font-style:italic}
.quote{font-size:14.5px;line-height:1.55}
.facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 16px;margin-top:14px}
.fact{border-top:1px solid var(--line);padding-top:8px;font-size:14px}
.fact b{display:block;color:var(--muted);font-size:11.5px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px}
.hypo{margin-top:14px;padding:12px 15px;border-radius:10px;background:var(--neutral-soft);font-size:14.5px}
.qblock{margin-top:16px;border-top:1px solid var(--line);padding-top:14px}
.qhead{display:flex;align-items:baseline;gap:9px;margin-bottom:8px}
.qnum{flex:0 0 22px;height:22px;border-radius:50%;background:var(--neutral);color:#fff;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center}
.qtitle{font-size:15px;font-weight:700}
.qbody{font-size:14.5px}
.said{border-left:3px solid var(--red);background:var(--red-soft);color:var(--red-ink);padding:8px 12px;border-radius:0 8px 8px 0;margin:8px 0;font-size:14px}
.ruletext{border-radius:10px;padding:12px 14px;font-size:14.5px;line-height:1.55;margin:8px 0}
.ruletext.old{background:var(--red-soft);border:1px solid #f6d3d8}
.ruletext.none{background:var(--neutral-soft);color:var(--muted);font-style:italic}
.ruletext.newtext{background:var(--green-soft);border:1px solid #c9ecdb}
.why{color:var(--muted);font-size:14px;margin-top:8px}
.benefit{margin-top:10px;padding:10px 14px;border-radius:10px;background:var(--blue-soft);color:var(--blue-ink);font-size:14.5px}
.legs{margin:10px 0 0;padding-left:0;list-style:none;counter-reset:leg}
.legs li{position:relative;padding-left:22px;margin:9px 0;font-size:14px}
.legs li::before{content:"→";position:absolute;left:0;color:var(--blue);font-weight:700}
.legs b{color:var(--ink)}
.newcase{border:1px dashed var(--blue);border-radius:10px;padding:11px 14px;background:#fbfdff;margin:10px 0;font-size:14px}
details.more{margin-top:14px;border-top:1px dashed var(--line)}
details.more>summary{list-style:none;cursor:pointer;display:inline-flex;align-items:center;gap:8px;font-size:13.5px;font-weight:600;color:var(--blue);padding:11px 0 3px}
details.more>summary::-webkit-details-marker{display:none}
details.more>summary::before{content:"▸";font-size:11px;transition:transform .2s}
details.more[open]>summary::before{transform:rotate(90deg)}
.sighting{border-left:3px solid var(--line);padding:4px 0 4px 12px;margin:10px 0;font-size:14px}
.sighting .when{color:var(--faint);font-size:12.5px}
table{border-collapse:collapse;width:100%;margin-top:14px;font-size:14.5px}
.table-scroll{max-width:100%;overflow-x:auto}
.table-scroll table{min-width:520px}
th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:12.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
tr:last-child td{border-bottom:none}
.verdict-controls{margin-top:16px;border-top:1px solid var(--line);padding-top:14px}
.review-options{display:flex;flex-wrap:wrap;gap:9px;margin-top:8px}
.review-options label{display:flex;align-items:center;gap:7px;border:1px solid var(--line);border-radius:9px;padding:8px 12px;background:#fff;cursor:pointer;font-size:14px}
.review-options label:has(input:checked){border-color:var(--blue);background:var(--blue-soft);font-weight:600}
textarea{width:100%;min-height:70px;resize:vertical;margin-top:8px;border:1px solid var(--line);border-radius:10px;padding:10px 12px;color:var(--ink);background:#fff;font:inherit}
[data-review-output]{min-height:150px;font-family:Consolas,"SF Mono",monospace;font-size:13px;background:var(--neutral-soft)}
.review-label{display:block;margin-top:14px;font-weight:700}
.decisions{border:1px solid #cfe0fb;background:linear-gradient(135deg,#fbfdff,#f1f6ff);box-shadow:0 1px 2px rgba(26,30,55,.05),0 14px 40px -20px rgba(47,109,240,.4)}
.review-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:11px}
.review-actions button{border:1px solid var(--blue);border-radius:9px;padding:9px 14px;background:var(--blue);color:#fff;font:inherit;font-weight:700;cursor:pointer}
.review-actions button.secondary{background:#fff;color:var(--blue-ink)}
.copy-status{min-height:1.5em;margin:8px 0 0;color:var(--muted);font-size:13px}
.color-key{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;margin:-10px 0 22px;padding:10px 14px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--muted);font-size:12.5px}
.color-key b{color:var(--ink)}
.color-key span{display:inline-flex;align-items:center;gap:6px}
.color-dot{width:9px;height:9px;border-radius:50%;background:var(--neutral)}
.color-dot.change{background:var(--amber)}
.color-dot.add{background:var(--blue)}
.color-dot.none{background:var(--neutral)}
footer{color:var(--faint);font-size:13px;margin-top:18px;text-align:center}
@media (max-width:720px){.change{grid-template-columns:1fr}.facts{grid-template-columns:1fr}}
@media (max-width:560px){body{padding:28px 12px 70px}section{padding:22px 18px}h1{font-size:25px}}
`;

export const REVIEW_SCRIPT = `
/* Both buttons have to work when this page is opened straight off disk, which
   is how it is actually read. On a file:// page there is no clipboard API and a
   script-started download is unreliable — Chrome may refuse it and a detached
   anchor is a no-op in Firefox. So neither button depends on those: whatever
   happens, the text ends up in the box, selected, and the status line says what
   to do. A button that silently does nothing is the bug this replaces. */
(() => {
  const root = document.querySelector("[data-review-page]");
  if (!root) return;
  const output = root.querySelector("[data-review-output]");
  const notes = root.querySelector("[data-review-notes]");
  const status = root.querySelector("[data-review-copy-status]");
  const questions = [...root.querySelectorAll("[data-review-id]")];
  const artifact = root.dataset.reviewArtifact || document.title;

  const answers = () => questions.map((q) => ({
    id: q.dataset.reviewId,
    value: q.querySelector('input[type="radio"]:checked')?.value ?? "Not answered",
    notes: (q.querySelector("[data-review-question-notes]")?.value ?? "").trim() || "none",
  }));
  const replyText = () => [
    "SKILL_PROPOSAL_REVIEW",
    "Artifact: " + artifact,
    "",
    ...answers().flatMap((a) => ["[" + a.id + "] " + a.value, "Notes: " + a.notes, ""]),
    ...(notes && notes.value.trim() ? ["Additional notes: " + notes.value.trim()] : []),
  ].join("\\n");
  const jsonText = () => JSON.stringify({
    schema: "superflux.skill_proposal_review.v0.1",
    artifact,
    answers: answers(),
    notes: (notes?.value ?? "").trim() || "none",
  }, null, 2);

  let showing = "reply";
  const render = () => { output.value = showing === "reply" ? replyText() : jsonText(); };

  /* Select first, then try to copy. The selection is the part that always
     works, so it happens whether or not the copy succeeds. */
  const selectAndCopy = async (label) => {
    output.focus();
    output.select();
    output.setSelectionRange(0, output.value.length);
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(output.value);
        status.textContent = label + " copied to your clipboard.";
        return;
      } catch { /* fall through to the old way */ }
    }
    let copied = false;
    try { copied = document.execCommand("copy"); } catch { copied = false; }
    status.textContent = copied
      ? label + " copied to your clipboard."
      : label + " is selected in the box above — press Ctrl+C to copy it.";
  };

  root.addEventListener("input", render);
  output.addEventListener("focus", () => output.select());

  root.querySelector("[data-review-copy]").addEventListener("click", () => {
    showing = "reply";
    render();
    selectAndCopy("The reply");
  });

  root.querySelector("[data-review-json]").addEventListener("click", () => {
    showing = "json";
    render();
    selectAndCopy("The JSON");
    /* A real file download as a bonus, never as the only route. The anchor goes
       into the document because a detached one does nothing in Firefox, and the
       object URL is released later because releasing it immediately can cancel
       the download that was just started. */
    try {
      const blob = new Blob([output.value], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = artifact.replace(/\\.html?$/i, "") + "-review.json";
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      setTimeout(() => { link.remove(); URL.revokeObjectURL(url); }, 30000);
    } catch { /* the selected text above is the route that matters */ }
  });

  render();
})();
`;
