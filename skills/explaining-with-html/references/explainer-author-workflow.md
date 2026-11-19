# Dedicated explainer author workflow

Invoke this workflow when the user asks for a dedicated explainer author or when
delegation is authorized and independent comprehension review would help. The skill
remains reusable by a single agent. This entry point packages instructions and a
payload builder; it does not register a new runtime agent type or start a service.

## Runtime preflight

Inspect the tools exposed in the current session before dispatch. The verified Codex
runtime for this workflow exposes `collaboration.spawn_agent` with `task_name`,
`message`, `agent_type: "default"` and `fork_turns: "none"`. It also exposes
`collaboration.send_message`, `followup_task`, `list_agents` and `wait_agent`.
Use those actual tools directly, not shell commands or Codex chat-creation tools.
Other runtimes need their own documented adapter and live smoke test before being
called supported. If subagents are unavailable, report that this workflow cannot
run; do not silently present a single agent's self-review as independent review.

`fork_turns: "none"` prevents inherited conversation history. It does not isolate
the filesystem, remove tools, restrict network access, or prevent a reviewer from
opening adjacent files. Role prompts request those boundaries; they cannot enforce
them. The payload builder rejects extra reader fields, but cannot detect an answer
hidden inside a question. The coordinator must inspect the questions for leading
answers and keep source packets, expected answers and rationale out of the reader
message. Reviewers receive the same tool capabilities and platform sandbox rules.
Record runtime name/date, actual tool schema and available browser capability in the
run evidence. Do not claim platform isolation without an independently verified gate.

## Main-agent handoff and callable entry point

The main agent records the user's questions verbatim, inspects authoritative sources,
and creates a handoff JSON. Use absolute file paths and source coordinates. A source
may be a file or URL; when unavailable, use an explicit unknown evidence record with
the attempted source and observation time. Do not invent expected answers.

```json
{
  "artifact": "C:/project/docs/2026-10-02-worker-explainer.html",
  "readerContext": "C:/project/docs/worker-reader-context.json",
  "scope": "Explain the current worker without changing its implementation",
  "questions": ["Where does it run?", "What needs a person?"],
  "evidence": [{
    "claim": "The dispatch limit counts running workers",
    "source": "C:/project/src/worker.ts:14 at revision abc123",
    "observedAt": "2026-10-02",
    "status": "current"
  }],
  "unknowns": ["Deployment has not been checked"],
  "preferences": ["Keep the main answer readable on a phone"]
}
```

Evidence statuses are `current`, `historical`, `proposed`, `unimplemented`, or
`unknown`. The author receives all fields. Build the real tool arguments with Node:

```powershell
node C:/path/to/explaining-with-html/assets/explainer-agent-payload.mjs author C:/project/handoff.json
```

Pass the returned JSON as arguments to `collaboration.spawn_agent`. The generator
sets `agent_type: "default"`, a role-specific task name, and `fork_turns: "none"`,
and resolves the packaged author's SKILL.md path. It does not dispatch on its own.
The imported `buildAgentPayload(role, input)` provides the same operation for a
runtime host that can call tools. Inspect the exact generated message before dispatch.
Do not add parent conversation or an answer key to reviewer messages.

For a portable checkout recipe, keep the questions and freshly inspected evidence
in a relative `docs/explainer-handoff.json` with the example fields above. Resolve
the output paths for the current checkout before generating the payload:

```powershell
$explainerRoot = (Get-Location).Path
$explainerPacket = Get-Content -Raw (Join-Path $explainerRoot 'docs/explainer-handoff.json') | ConvertFrom-Json
$explainerPacket.artifact = Join-Path $explainerRoot 'docs/worker-explainer.html'
$explainerPacket.readerContext = Join-Path $explainerRoot 'docs/worker-reader-context.json'
$explainerInput = Join-Path $explainerRoot 'docs/explainer-handoff.local.json'
$explainerPacket | ConvertTo-Json -Depth 10 | Set-Content -Encoding utf8 $explainerInput
node (Join-Path $explainerRoot 'skills/explaining-with-html/assets/explainer-agent-payload.mjs') author $explainerInput
```

Refresh source coordinates for the current checkout too. Recorded local-run JSON
under evaluation docs captures the paths actually used on that machine; it is not
a portable input or a source of current expected answers.

The author owns the HTML and reader context, reads sources, writes the artifact,
uses browser inspection/screenshots and interaction tests when available, and runs
the packaged automated verifier. The author reports missing capabilities explicitly.
The main agent owns evidence gathering, dispatch, review synthesis and final delivery.

## Independent reviews and rendering

After the author saves a stable draft, freeze that revision while reviewers read it.
Run these two responsibilities in fresh agents; sequential dispatch is acceptable
when concurrency slots are limited. Never reuse the author as a reviewer.

| Role | Input JSON | Required output |
| --- | --- | --- |
| Reader | Only `artifact` and `questions` | Own-word answers, artifact passages supporting them, guesses, ambiguous words and unanswered questions; visible-spine versus expanded-content distinction |
| Fact | `artifact`, `questions`, `evidence`, `unknowns` | Claim/source checks, omitted conditions, inaccessible evidence and proposals represented as implemented |

Run the same CLI with `reader` or `fact` and their respective JSON files, then pass
the result to `collaboration.spawn_agent`. Both use `fork_turns: "none"`. Do not
send reviewers each other's findings. If context is contaminated, discard that
reader result and start a fresh reader without the leaked material.

Browser rendering verification is a separate result: record desktop and phone
viewport dimensions, overflow and text-size checks, screenshots, and exercised
controls. It may be performed by the author or a separate verifier. A source-text
read alone does not establish browser rendering. Browser success and automated
validation do not establish comprehension. Reader-agent success is a proxy, never
demonstrated human understanding.

## Bounded revisions and delivery

Record an initial draft plus **at most two revision rounds**. Combine the independent
findings into one concrete repair request per round; send it to the author using
`collaboration.followup_task`. Re-run changed automated and browser checks, and
dispatch a fresh blind reader and fresh fact reviewer for the revised artifact.
Use unique task names (for example `explainer_reader_r1`) for subsequent agents.
Never send a prior answer key or previous reviewer answers to the new reader.

The exported `revisionDecision({ revisions, unresolved, humanRejected })` returns
`revise`, `report-unresolved`, or `ready-for-delivery`. This helper rejects counts
outside 0–2; the main agent must maintain the count and obey the result. It is not
a runtime guard against arbitrary additional tool calls. `unresolved` includes
factual, comprehension, automated-validation and rendering failures or missing checks.
Actual user feedback overrides agent scores: set `humanRejected` if the user says
the explanation does not make sense, even when every agent passed it.

At the cap, stop revising and report the unresolved questions and check failures with
the latest artifact clearly labeled a draft. Do not present it as verified delivery.
Keep the final report compact: questions answered/unanswered, fact results, automated
results, browser results, revision count and human feedback status. No agent score
can replace a person's stated confusion. Use a brief conversational repair when the
user needs one; a new authoring cycle needs a new scope or explicit request.

Keep raw review reports and author rationale outside the reader artifact.
