"""Generate a scope-of-work explainer HTML page from a scoping-JSON bundle.

Usage:
    python build_scope_html.py scopes.json out.html [--d2-bin C:/path/to/d2.exe]

The page is GENERATED FROM DATA — never hand-paste agent prose into the spine.
Feed it the bundle produced by skills/explaining-with-html/scope-of-work.md
(Phases A-C): the parallel scoping agents' structured JSON, hand-authored
plain-language digests, and the cross-check agent's output.

Bundle shape (scopes.json):
{
  "title": "Scope of work: ...",              # <h1>
  "subtitle": "... dated, method noted ...",  # sub line
  "lane_order": ["Client UI","API","DB",...], # per-project swim lanes, left->right
  "start_here": {"lead": "one paragraph", "bullets": ["...", "..."]},
  "size_legend": "S ~ 1-2 days, M ~ 3-5, L ~ 6-10, XL > 10. ...",  # optional
  "changes": [                                 # one per scoped change, in display order
    {
      "key": "verify-ingestion",               # anchor id (kebab-case)
      "title": "Ingestion verification",
      "impact": "5/5",
      "digest": [["Today","..."],["The change","..."],["Watch out","..."]],
      "scope_summary": "agent prose w/ file:line (goes behind the expander)",
      "diagram_presentation": {
        "mode": "annotated_delta|paired_today_after",
        "divergence_factors": {
          "boundary_changed": false,
          "primary_route_changed": false,
          "stages_reordered_or_reowned": false
        },
        "independent_inspection_reason": "required for paired_today_after"
      },
      "current_state": {"components":[...], "edges":[...]},   # agent schema
      "new_state":     {"components":[...], "edges":[...]},   # w/ status per node/edge
      "files_touched": [{"path":"...", "change":"..."}],
      "effort": {"size":"S|M|L|XL", "est_days":"2-3", "breakdown":["ws: days"]},
      "complexity_drivers": ["..."],
      "risks": [{"risk":"...", "severity":"low|medium|high", "mitigation":"..."}],
      "dependencies": ["..."],
      "rollout": "flags, migrations, deploy order",
      "open_questions": ["..."]
    }
  ],
  "cross_check": {                             # Phase B reconciliation agent (optional)
    "dependency_edges": [{"before":"...", "after":"...", "reason":"..."}],
    "sequencing": "prose",
    "effort_flags": ["..."],
    "shared_risks": ["..."]
  },
  "caveats": ["...", "..."],                   # optional; sensible defaults if absent
  "footer": "provenance line (companion docs, agent count, date)"  # optional
}
"""

import argparse
import html
import json
import re
import shutil
import subprocess
import tempfile
import textwrap
from pathlib import Path

E = html.escape

STATUS_STYLE = {
    "unchanged": {"fill": "#FFFFFF", "stroke": "#B6C0CF"},
    "modified": {"fill": "#FFFFFF", "stroke": "#5E6676"},
    "new": {"fill": "#F1F3F7", "stroke": "#3F4658"},
    "removed": {"fill": "#F7F8FA", "stroke": "#8B91A4"},
}


def d2_string(value):
    return json.dumps(str(value), ensure_ascii=False)


def wrap_diagram_text(value, max_chars, max_lines, field_name):
    lines = textwrap.wrap(
        str(value).strip(),
        width=max_chars,
        break_long_words=True,
        break_on_hyphens=False,
    ) or [""]
    if len(lines) > max_lines:
        raise ValueError(
            f"{field_name} needs {len(lines)} lines; shorten it to {max_lines} lines "
            f"of at most {max_chars} characters"
        )
    return lines


def lane_order_for(spec, lane_order):
    used_lanes = []
    for component in spec["components"]:
        lane = component["lane"]
        if lane not in used_lanes:
            used_lanes.append(lane)
    ordered = [lane for lane in lane_order if lane in used_lanes]
    return ordered + [lane for lane in used_lanes if lane not in ordered]


def diagram_to_d2(spec, lane_order):
    components = spec["components"]
    component_ids = [component["id"] for component in components]
    if len(component_ids) != len(set(component_ids)):
        raise ValueError("diagram component ids must be unique")

    lanes = lane_order_for(spec, lane_order)
    lane_ids = {lane: f"lane_{index}" for index, lane in enumerate(lanes)}
    component_refs = {}
    lines = ["direction: right", ""]

    for lane_index, lane in enumerate(lanes):
        lane_id = lane_ids[lane]
        lines.extend([
            f"{lane_id}: {{",
            f"  label: {d2_string(lane)}",
            "  direction: down",
            '  style.fill: "#F8FAFC"',
            '  style.stroke: "#CBD5E1"',
            "  style.font-size: 14",
            "  style.border-radius: 16",
            "",
        ])
        lane_components = [
            component for component in components if component["lane"] == lane
        ]
        for component_index, component in enumerate(lane_components):
            node_id = f"node_{lane_index}_{component_index}"
            component_refs[component["id"]] = f"{lane_id}.{node_id}"
            label_lines = wrap_diagram_text(
                component["label"], 28, 3, f"component {component['id']} label"
            )
            note_lines = wrap_diagram_text(
                component.get("note", ""), 34, 3, f"component {component['id']} note"
            ) if component.get("note") else []
            label = "\n".join(label_lines + note_lines)
            status = component.get("status", "unchanged")
            style = STATUS_STYLE[status]
            lines.extend([
                f"  {node_id}: {{",
                f"    label: {d2_string(label)}",
                f'    style.fill: "{style["fill"]}"',
                f'    style.stroke: "{style["stroke"]}"',
                "    style.font-size: 18",
                "    style.border-radius: 12",
            ])
            if status in {"modified", "removed"}:
                lines.extend([
                    f"    style.stroke-dash: {3 if status == 'modified' else 5}",
                ])
            if status == "removed":
                lines.append("    style.opacity: 0.72")
            lines.extend(["  }", ""])
        lines.extend(["}", ""])

    for edge_index, edge in enumerate(spec.get("edges", [])):
        if edge["from"] not in component_refs or edge["to"] not in component_refs:
            raise ValueError(
                f"edge {edge_index} must reference existing component ids"
            )
        label_lines = wrap_diagram_text(
            edge.get("label", ""), 24, 2, f"edge {edge_index} label"
        ) if edge.get("label") else []
        status = edge.get("status", "unchanged")
        style = STATUS_STYLE[status]
        edge_label = f": {d2_string(chr(10).join(label_lines))}" if label_lines else ""
        lines.extend([
            f"{component_refs[edge['from']]} -> {component_refs[edge['to']]}{edge_label} {{",
            f'  style.stroke: "{style["stroke"]}"',
        ])
        if status == "removed":
            lines.append("  style.stroke-dash: 5")
        lines.extend(["}", ""])

    source = "\n".join(lines)
    if "width:" in source or "height:" in source:
        raise ValueError("D2 text-bearing nodes must remain auto-sized")
    return source


def render_d2_svg(spec, lane_order, d2_bin):
    source = diagram_to_d2(spec, lane_order)
    with tempfile.TemporaryDirectory(prefix="explaining-with-html-d2-") as temp_dir:
        input_path = Path(temp_dir) / "diagram.d2"
        output_path = Path(temp_dir) / "diagram.svg"
        input_path.write_text(source, encoding="utf-8")
        result = subprocess.run(
            [
                d2_bin,
                "--layout=elk",
                "--no-xml-tag",
                "--pad=0",
                "--elk-nodeNodeBetweenLayers=20",
                "--elk-edgeNodeBetweenLayers=20",
                "--elk-padding=[top=20,left=20,bottom=20,right=20]",
                str(input_path),
                str(output_path),
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            detail = result.stderr.strip() or result.stdout.strip() or "unknown D2 error"
            raise RuntimeError(f"D2 ELK rendering failed: {detail}")
        svg = output_path.read_text(encoding="utf-8")
    svg = svg.removeprefix('<?xml version="1.0" encoding="utf-8"?>')
    if "<svg" not in svg or "data-d2-version" not in svg:
        raise RuntimeError("D2 did not produce an inline SVG")
    view_box = re.search(
        r'viewBox="0 0 (?P<diagram_width>[0-9.]+) (?P<diagram_height>[0-9.]+)"',
        svg,
    )
    if view_box is None:
        raise RuntimeError("D2 SVG must expose numeric viewBox dimensions")
    diagram_width = float(view_box.group("diagram_width"))
    diagram_height = float(view_box.group("diagram_height"))
    svg = svg.replace(
        "<svg ",
        f'<svg width="{diagram_width:g}" height="{diagram_height:g}" ',
        1,
    )
    return svg


def render_ascii_diagram(spec, diagram_id, status):
    text = spec.get("ascii")
    summary = spec.get("summary")
    if not isinstance(text, str) or not text.strip():
        raise ValueError("ASCII diagram requires non-empty ascii text")
    if not isinstance(summary, str) or not summary.strip():
        raise ValueError("ASCII diagram requires a plain-language summary")
    if any(ord(char) < 32 and char != "\n" for char in text):
        raise ValueError("ASCII diagram must use spaces and LF newlines, not tabs or control characters")
    return (
        f'<figure class="ascii-figure" data-visual-role="architecture">'
        f'<figcaption id="{E(diagram_id)}-caption"><b>{E(status)}.</b> {E(summary)}</figcaption>'
        f'<pre class="ascii-diagram" data-diagram-format="ascii" tabindex="0" '
        f'role="region" aria-labelledby="{E(diagram_id)}-caption">{E(text)}</pre>'
        '</figure>'
    )


def render_diagram(spec, lane_order, d2_bin, diagram_format, diagram_id, status):
    if diagram_format == "ascii":
        return render_ascii_diagram(spec, diagram_id, status)
    if diagram_format == "d2":
        if not d2_bin:
            raise ValueError("D2 format requires the D2 CLI; install it or pass --d2-bin")
        return render_d2_svg(spec, lane_order, d2_bin)
    raise ValueError("diagram_presentation.format must be ascii or d2")


def diagram_narrow_alternative(spec):
    components = {component["id"]: component for component in spec["components"]}
    component_rows = "".join(
        f'<tr><td>{E(component["lane"])}</td><td>{E(component["label"])}</td>'
        f'<td>{E(component.get("note", ""))}</td>'
        f'<td>{E(component.get("status", "unchanged"))}</td></tr>'
        for component in spec["components"]
    )
    edge_rows = "".join(
        f'<tr><td>{E(components[edge["from"]]["label"])}</td>'
        f'<td>{E(edge.get("label", "connects to"))}</td>'
        f'<td>{E(components[edge["to"]]["label"])}</td></tr>'
        for edge in spec.get("edges", [])
    )
    return f'''<div class="diagram-narrow-alternative">
  <p><b>Readable narrow-width view</b> — the same components and connections without shrinking labels.</p>
  <div class="table-scroll"><table><tr><th>Lane</th><th>Component</th><th>Role</th><th>Status</th></tr>{component_rows}</table></div>
  <div class="table-scroll"><table><tr><th>From</th><th>Connection</th><th>To</th></tr>{edge_rows}</table></div>
</div>'''


def sev_rank(s):
    return {"high": 3, "medium": 2, "low": 1}.get(s, 0)


def risk_pill(scope):
    risks = scope.get("risks", [])
    top = max((sev_rank(r["severity"]) for r in risks), default=0)
    if top >= 3:
        return '<span class="pill amber">high risk items</span>'
    if top == 2:
        return '<span class="pill amber">medium risk</span>'
    return '<span class="pill neutral">low risk</span>'


def primary_node_ids(spec):
    return {
        component["id"]
        for component in spec.get("components", [])
    }


def structural_node_placements(spec):
    return {
        (component["id"], component["lane"])
        for component in spec.get("components", [])
    }


def structural_relationship_set(spec):
    return {
        (edge["from"], edge["to"])
        for edge in spec.get("edges", [])
    }


def computed_divergence_score(change, presentation):
    factors = presentation.get("divergence_factors", {})
    if not isinstance(factors, dict):
        raise ValueError(
            f"change {change['key']} divergence_factors must be an object"
        )
    required_factor_names = (
        "boundary_changed",
        "primary_route_changed",
        "stages_reordered_or_reowned",
    )
    for factor_name in required_factor_names:
        if not isinstance(factors.get(factor_name), bool):
            raise ValueError(
                f"change {change['key']} divergence_factors.{factor_name} "
                "must be true or false"
            )

    current_nodes = primary_node_ids(change["current_state"])
    new_nodes = primary_node_ids(change["new_state"])
    node_union = current_nodes | new_nodes
    node_delta_ratio = (
        len(current_nodes ^ new_nodes) / len(node_union)
        if node_union
        else 0.0
    )

    current_relationships = structural_relationship_set(change["current_state"])
    new_relationships = structural_relationship_set(change["new_state"])
    current_placements = structural_node_placements(change["current_state"])
    new_placements = structural_node_placements(change["new_state"])
    relationship_delta_ratio = min(
        1.0,
        len(current_relationships ^ new_relationships)
        / max(len(current_relationships), 1),
    )

    reason = str(presentation.get("independent_inspection_reason", "")).strip()
    earned_factors = []
    if factors["boundary_changed"]:
        earned_factors.append((2, "ownership, trust, security, or system boundary changed"))
    if factors["primary_route_changed"]:
        earned_factors.append((2, "primary entry, exit, or end-to-end route changed"))
    if node_delta_ratio >= 0.35:
        earned_factors.append((1, f"{node_delta_ratio:.0%} of primary nodes changed"))
    if relationship_delta_ratio >= 0.40:
        earned_factors.append(
            (1, f"{relationship_delta_ratio:.0%} of baseline relationships changed")
        )
    if factors["stages_reordered_or_reowned"]:
        earned_factors.append((1, "two or more stages reordered or changed actors"))
    if reason:
        earned_factors.append((1, "both complete states require independent inspection"))

    return {
        "divergence_factors": factors,
        "divergence_score": sum(weight for weight, _ in earned_factors),
        "earned_factors": tuple(
            f"{description} (+{weight})" for weight, description in earned_factors
        ),
        "independent_inspection_reason": reason,
        "node_delta_ratio": node_delta_ratio,
        "relationship_delta_ratio": relationship_delta_ratio,
        "structurally_identical": (
            current_placements == new_placements
            and current_relationships == new_relationships
        ),
    }


def validate_diagram_presentation(change):
    presentation = change.get("diagram_presentation")
    if not isinstance(presentation, dict):
        raise ValueError(
            f"change {change['key']} requires a diagram_presentation object"
        )

    mode = presentation.get("mode")
    divergence = computed_divergence_score(change, presentation)

    if mode == "annotated_delta":
        return {
            **divergence,
            "mode": mode,
            "states": ("new_state",),
        }

    if mode == "paired_today_after":
        if divergence["structurally_identical"]:
            raise ValueError(
                f"change {change['key']} cannot pair structurally identical states"
            )
        if divergence["divergence_score"] < 3:
            raise ValueError(
                f"change {change['key']} cannot use paired_today_after below "
                "computed divergence score 3"
            )
        if not divergence["independent_inspection_reason"]:
            raise ValueError(
                f"change {change['key']} paired_today_after requires "
                "independent_inspection_reason"
            )
        return {
            **divergence,
            "mode": mode,
            "states": ("current_state", "new_state"),
        }

    raise ValueError(
        f"change {change['key']} diagram_presentation.mode must be "
        "annotated_delta or paired_today_after"
    )


def section(change, idx, rendered_diagrams, diagram_presentations):
    key, title, impact = change["key"], change["title"], change["impact"]
    eff = change["effort"]
    parts = []
    parts.append(f'<h2 id="{E(key)}"><span class="stepnum">{idx}</span>{E(title)}</h2>')
    parts.append('<div class="card">')
    parts.append(
        f'<p><span class="pill blue">impact {E(impact)}</span>'
        f'<span class="pill blue">effort {E(eff["size"])} · {E(eff["est_days"])} days</span>'
        f'{risk_pill(change)}</p>'
    )
    for tag, text in change["digest"]:
        parts.append(f'<p class="digest"><span class="dtag">{E(tag)}</span> {E(text)}</p>')
    if change.get("scope_summary"):
        parts.append(
            '<details class="more"><summary>Full technical scope (file:line citations)</summary>'
            f'<p class="fineprint">{E(change["scope_summary"])}</p></details>'
        )

    presentation = diagram_presentations[key]
    parts.append('<div class="dgstack">')
    state_labels = {
        "current_state": "Current behavior",
        "new_state": (
            "Proposed - not implemented"
            if presentation["mode"] == "paired_today_after"
            else "Proposed changed path - not implemented"
        ),
    }
    for state in presentation["states"]:
        parts.append(
            f'<div><div class="dg-title">{state_labels[state]}</div>'
            f'<div class="dg" data-diagram-height-budget="620" id="dg-{E(key)}-{state}">'
            f'{rendered_diagrams[key][state]}'
            f'{diagram_narrow_alternative(change[state]) if change["diagram_presentation"].get("format", "d2") == "d2" else ""}</div></div>'
        )
    parts.append("</div>")
    if presentation["mode"] == "paired_today_after":
        earned = "; ".join(E(factor) for factor in presentation["earned_factors"])
        parts.append(
            '<p class="fineprint"><b>Why two complete views:</b> '
            f'divergence score {presentation["divergence_score"]}/8. '
            f'Earned by: {earned}. '
            f'{E(presentation["independent_inspection_reason"])}</p>'
        )
    parts.append(
        '<p class="legend"><span class="lg un">unchanged</span>'
        '<span class="lg mod">modified</span><span class="lg new">new</span>'
        '<span class="lg rem">removed</span></p>'
    )

    # effort breakdown + complexity
    parts.append('<details class="more"><summary>Effort breakdown &amp; complexity drivers</summary>')
    parts.append("<ul>" + "".join(f"<li>{E(b)}</li>" for b in eff.get("breakdown", [])) + "</ul>")
    cd = change.get("complexity_drivers", [])
    if cd:
        parts.append("<p><b>What makes it complex:</b></p><ul>" + "".join(f"<li>{E(c)}</li>" for c in cd) + "</ul>")
    parts.append("</details>")

    # risks (visible)
    risks = change.get("risks", [])
    if risks:
        rows = "".join(
            f'<tr><td>{E(r["risk"])}</td>'
            f'<td><span class="pill {"neutral" if r["severity"]=="low" else "amber"}">{E(r["severity"])}</span></td>'
            f'<td>{E(r["mitigation"])}</td></tr>'
            for r in sorted(risks, key=lambda r: -sev_rank(r["severity"]))
        )
        parts.append(f'<h3>Risks</h3><div class="table-scroll"><table><tr><th>Risk</th><th>Severity</th><th>Mitigation</th></tr>{rows}</table></div>')

    # files touched
    files = change.get("files_touched", [])
    if files:
        rows = "".join(f"<tr><td><code>{E(f['path'])}</code></td><td>{E(f['change'])}</td></tr>" for f in files)
        parts.append(
            f'<details class="more"><summary>Files touched ({len(files)})</summary>'
            f'<div class="table-scroll"><table><tr><th>File</th><th>Change</th></tr>{rows}</table></div></details>'
        )

    # rollout + deps + open questions
    if change.get("rollout"):
        parts.append(f'<p><b>Rollout:</b> {E(change["rollout"])}</p>')
    deps = change.get("dependencies", [])
    if deps:
        parts.append("<p><b>Depends on:</b> " + "; ".join(E(d) for d in deps) + "</p>")
    oq = change.get("open_questions", [])
    if oq:
        parts.append(
            '<details class="more"><summary>Open questions</summary><ul>'
            + "".join(f"<li>{E(q)}</li>" for q in oq)
            + "</ul></details>"
        )
    parts.append("</div>")
    return "\n".join(parts)


def build(bundle, d2_bin, fit_checker_js):
    changes = bundle["changes"]
    lane_order = bundle.get("lane_order", [])
    diagram_presentations = {
        change["key"]: validate_diagram_presentation(change)
        for change in changes
    }
    rendered_diagrams = {
        change["key"]: {
            state: render_diagram(
                change[state], lane_order, d2_bin,
                change["diagram_presentation"].get("format", "d2"),
                f"{change['key']}-{state}",
                "Current behavior" if state == "current_state" else "Proposed - not implemented",
            )
            for state in diagram_presentations[change["key"]]["states"]
        }
        for change in changes
    }

    # summary table
    sum_rows = ""
    for c in changes:
        eff = c["effort"]
        n_high = sum(1 for r in c.get("risks", []) if r["severity"] == "high")
        n_med = sum(1 for r in c.get("risks", []) if r["severity"] == "medium")
        risk_txt = (f"{n_high} high" if n_high else "") + (", " if n_high and n_med else "") + (f"{n_med} medium" if n_med else "")
        sum_rows += (
            f'<tr><td><a href="#{E(c["key"])}">{E(c["title"])}</a></td>'
            f'<td class="num">{E(c["impact"])}</td>'
            f'<td class="num">{E(eff["size"])}</td>'
            f'<td class="num">{E(eff["est_days"])}</td>'
            f'<td>{risk_txt or "low only"}</td></tr>'
        )

    xcheck = bundle.get("cross_check")
    deps_section = ""
    if xcheck:
        dep_rows = "".join(
            f'<tr><td>{E(d["before"])}</td><td>{E(d["after"])}</td><td>{E(d["reason"])}</td></tr>'
            for d in xcheck.get("dependency_edges", [])
        )
        flags = "".join(f"<li>{E(f)}</li>" for f in xcheck.get("effort_flags", []))
        shared = "".join(f"<li>{E(r)}</li>" for r in xcheck.get("shared_risks", []))
        deps_section = f"""
<h2>How they fit together — dependencies and sequencing</h2>
<div class="card">
  <div class="table-scroll"><table><tr><th>Do first</th><th>Then</th><th>Why</th></tr>{dep_rows}</table></div>
  <h3>Suggested sequencing</h3>
  <p>{E(xcheck.get("sequencing", ""))}</p>
  <h3>Estimate sanity flags from the cross-checker</h3>
  <ul>{flags}</ul>
  <h3>Risk themes shared across changes</h3>
  <ul>{shared}</ul>
</div>"""

    sections = "\n".join(
        section(change, index + 1, rendered_diagrams, diagram_presentations)
        for index, change in enumerate(changes)
    )

    total_days = "; ".join(f"{c['title']}: {c['effort']['est_days']}d" for c in changes)
    caveats = bundle.get("caveats") or [
        f"Estimates are code-grounded but pre-implementation — treat as sizing, not commitments. Per-change day estimates: {total_days}.",
        "Open questions inside each section are the things that can move an estimate a size up.",
        "Diagrams show the components that change, not every box in the system.",
    ]
    caveat_items = "".join(f"<li>{E(c)}</li>" for c in caveats)
    review_fields = "".join(
        f'''<fieldset data-review-id="scope-{E(change["key"])}">
  <legend>{E(change["title"])}</legend>
  <div class="review-options">
    <label><input type="radio" name="scope-{E(change["key"])}" value="Include"> Include</label>
    <label><input type="radio" name="scope-{E(change["key"])}" value="Revise"> Revise</label>
    <label><input type="radio" name="scope-{E(change["key"])}" value="Defer"> Defer</label>
  </div>
  <textarea data-review-question-notes aria-label="Notes for {E(change["title"])}" placeholder="What should change, or what question should the coding agent answer?"></textarea>
</fieldset>'''
        for change in changes
    )

    start = bundle.get("start_here", {})
    start_lead = E(start.get("lead", ""))
    start_bullets = "".join(f"<li>{E(b)}</li>" for b in start.get("bullets", []))
    size_legend = E(bundle.get("size_legend",
        "Sizes: S ≈ 1–2 days, M ≈ 3–5, L ≈ 6–10, XL > 10. Estimates assume a senior dev who knows the codebase."))
    footer = E(bundle.get("footer", ""))
    review_artifact = E(bundle.get("review_artifact", f"{bundle['title']}.html"))

    page = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<title>{E(bundle["title"])}</title>
<style>
{(Path(__file__).parent / "fonts.css").read_text(encoding="utf-8")}
  :root {{
    color-scheme: light;
    --bg: #f7f8fa; --card: #ffffff; --ink: #1a2233; --muted: #5b6575;
    --line: #e5e9f0; --red: #c0392b; --red-bg: #fdf0ee;
    --amber: #9a6700; --amber-bg: #fdf6e3; --blue: #1d5fbf; --blue-bg: #eef4fd;
    --neutral: #5d6475; --neutral-bg: #f1f3f7;
  }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; background: var(--bg); color: var(--ink);
    font: 16px/1.6 "Instrument Sans", system-ui, sans-serif; padding: 32px 16px 80px; }}
  main {{ max-width: 1320px; margin: 0 auto; }}
  h1 {{ font-size: 26px; line-height: 1.3; margin: 0 0 6px; }}
  h2 {{ font-size: 20px; margin: 42px 0 12px; }}
  h3 {{ font-size: 15px; margin: 18px 0 8px; }}
  p {{ margin: 8px 0; }}
  .sub {{ color: var(--muted); font-size: 14px; margin-bottom: 24px; }}
  .card {{ background: var(--card); border: 1px solid var(--line); border-radius: 14px;
    padding: 20px 24px; margin: 14px 0; box-shadow: 0 1px 3px rgba(20,30,60,.06); }}
  .start {{ border-left: 5px solid var(--blue); }}
  .start .kicker {{ font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--blue); font-weight: 700; }}
  .pill {{ display: inline-block; font-size: 12px; font-weight: 600; padding: 2px 10px; border-radius: 999px; margin-right: 6px; }}
  .pill.red {{ background: var(--red-bg); color: var(--red); }}
  .pill.amber {{ background: var(--amber-bg); color: var(--amber); }}
  .pill.blue {{ background: var(--blue-bg); color: var(--blue); }}
  .pill.neutral {{ background: var(--neutral-bg); color: var(--neutral); }}
  table {{ border-collapse: collapse; width: 100%; font-size: 14px; margin: 10px 0; }}
  .table-scroll {{ width:100%; min-width:0; max-width:100%; overflow-x:auto; }}
  .table-scroll table {{ min-width: 640px; }}
  th, td {{ text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }}
  th {{ font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); }}
  .num {{ font-family: "IBM Plex Mono", monospace; font-variant-numeric: tabular-nums; white-space: nowrap; }}
  details.more {{ margin: 10px 0 0; border-top: 1px dashed var(--line); padding-top: 8px; }}
  details.more > summary {{ cursor: pointer; list-style: none; color: var(--blue); font-weight: 600; font-size: 14px; }}
  details.more > summary::-webkit-details-marker {{ display: none; }}
  details.more > summary::before {{ content: "\\25B8 "; }}
  details.more[open] > summary::before {{ content: "\\25BE "; }}
  details.more > summary:hover {{ text-decoration: underline; }}
  .dgstack {{ display: grid; grid-template-columns: 1fr; gap: 16px; margin-top: 12px; }}
  .dgstack > div, .dg, .diagram-narrow-alternative {{ min-width: 0; }}
  .dg {{ border: 1px solid var(--line); border-radius: 10px; padding: 12px; background: #fcfdfe; max-width: 100%; overflow: visible; }}
  .dg svg {{ display: block; width: auto; height: auto; max-width: 100%; }}
  .diagram-narrow-alternative {{ display: none; }}
  .ascii-figure {{ margin: 16px 0; min-width: 0; max-width: 100%; }}
  .ascii-diagram {{ box-sizing: border-box; max-width: 100%; margin: 10px 0;
    padding: 12px; overflow-x: auto; white-space: pre; overflow-wrap: normal;
    word-break: normal; font: 16px/1.5 "IBM Plex Mono", monospace;
    font-variant-ligatures: none; border: 1px solid #b6c0cf; background: #f7f8fa; color: #172033; }}
  .ascii-diagram:focus-visible {{ outline: 3px solid #2457a6; outline-offset: 2px; }}
  .dg-title {{ font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); margin-bottom: 4px; }}
  .diagram-fit-warning {{ margin: 10px 0 0; padding: 10px 12px; border-radius: 8px;
    color: var(--red); background: var(--red-bg); font-size: 13px; font-weight: 700; }}
  .legend {{ font-size: 12px; color: var(--muted); }}
  .lg {{ display: inline-block; margin-right: 14px; padding-left: 18px; position: relative; }}
  .lg::before {{ content: ""; position: absolute; left: 0; top: 3px; width: 12px; height: 12px; border-radius: 3px; border: 1.5px solid; }}
  .lg.un::before {{ background: #fff; border-color: #b6c0cf; }}
  .lg.mod::before {{ background: #fff; border-color: #5e6676; border-style: dashed; }}
  .lg.new::before {{ background: var(--neutral-bg); border-color: #3f4658; border-width: 2px; }}
  .lg.rem::before {{ background: #f7f8fa; border-color: #8b91a4; border-style: dashed; }}
  .stepnum {{ display: inline-flex; width: 24px; height: 24px; border-radius: 50%; background: var(--blue);
    color: #fff; font-size: 13px; font-weight: 700; align-items: center; justify-content: center; margin-right: 10px; }}
  code {{ background: #f0f2f6; border-radius: 4px; padding: 1px 5px; font: 12.5px "IBM Plex Mono", monospace; }}
  a {{ color: var(--blue); }}
  .residual {{ border-left: 5px solid var(--amber); }}
  .digest {{ margin: 10px 0; padding-left: 96px; position: relative; }}
  .digest .dtag {{ position: absolute; left: 0; top: 2px; display: inline-block; width: 86px;
    font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase;
    color: var(--blue); background: var(--blue-bg); border-radius: 6px; padding: 2px 0; text-align: center; }}
  .fineprint {{ font-size: 13.5px; color: var(--muted); line-height: 1.55; }}
  .footer {{ color: var(--muted); font-size: 13px; margin-top: 40px; border-top: 1px solid var(--line); padding-top: 16px; }}
  .review-feedback fieldset {{ border: 1px solid var(--line); border-radius: 10px; margin: 12px 0; padding: 14px; }}
  .review-feedback legend {{ font-weight: 700; padding: 0 5px; }}
  .review-options {{ display: flex; flex-wrap: wrap; gap: 8px; }}
  .review-options label {{ border: 1px solid var(--line); border-radius: 8px; padding: 7px 10px; cursor: pointer; }}
  .review-feedback textarea {{ width: 100%; min-height: 72px; margin-top: 10px; border: 1px solid var(--line); border-radius: 8px; padding: 10px; color: var(--ink); background: #fff; font: inherit; resize: vertical; }}
  .review-feedback [data-review-output] {{ min-height: 170px; background: var(--neutral-bg); font: 13px/1.5 "IBM Plex Mono", monospace; }}
  .review-actions {{ display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }}
  .review-actions button {{ border: 1px solid var(--blue); border-radius: 8px; padding: 8px 12px; background: var(--blue); color: #fff; font: inherit; font-weight: 700; cursor: pointer; }}
  .review-actions button.secondary {{ background: #fff; color: var(--blue); }}
  .review-copy-status {{ min-height: 1.5em; color: var(--muted); font-size: 13px; }}
  @media (min-width: 1201px) {{
    .dgstack {{ margin-left: -24px; margin-right: -24px; }}
  }}
  @media (max-width: 480px) {{
    .card {{ padding: 12px; }}
    .dg {{ padding: 0; border: 0; }}
  }}
  @media (max-width: 1200px) {{
    .dg svg {{ display: none; }}
    .diagram-narrow-alternative {{ display: block; }}
    .diagram-narrow-alternative table {{ font-size: 13px; }}
  }}
</style>
</head>
<body>
<main data-review-page data-review-artifact="{review_artifact}">

<h1>{E(bundle["title"])}</h1>
<p class="sub">{E(bundle.get("subtitle", ""))}</p>

<div class="card start">
  <div class="kicker">Start here — 15 seconds</div>
  <p>{start_lead}</p>
  <ul>
    {start_bullets}
  </ul>
</div>

<h2>Summary</h2>
<div class="card">
  <div class="table-scroll"><table>
    <tr><th>Change</th><th>Impact</th><th>Size</th><th>Est. days</th><th>Risk profile</th></tr>
    {sum_rows}
  </table></div>
  <p class="legend">{size_legend}</p>
</div>

{sections}
{deps_section}

<div class="card residual">
  <h3 style="margin-top:0">Caveats</h3>
  <ul>
    {caveat_items}
  </ul>
</div>

<section class="card review-feedback">
  <h2 style="margin-top:0">Review and copy your reply</h2>
  <p>Choose an action for each change and add the exact correction or question beside it.</p>
  {review_fields}
  <label for="scope-review-notes"><b>Overall notes</b></label>
  <textarea id="scope-review-notes" data-review-notes placeholder="Anything that applies to the whole scope"></textarea>
  <label for="scope-review-output"><b>Copy-ready reply</b></label>
  <textarea id="scope-review-output" data-review-output readonly></textarea>
  <div class="review-actions">
    <button type="button" data-review-copy>Copy reply</button>
    <button type="button" class="secondary" data-review-json>Download JSON</button>
  </div>
  <p class="review-copy-status" data-review-copy-status aria-live="polite"></p>
</section>

<div class="footer">
  <p>{footer}</p>
</div>

<script type="module">
{fit_checker_js}
document.fonts.ready.then(() => {{
  const results = [validateD2DiagramTextFit(document), validateAsciiDiagramFit(document)];
  const fit = {{ ok: results.every((result) => result.ok), errors: results.flatMap((result) => result.errors) }};
  document.documentElement.dataset.diagramFit = fit.ok ? "pass" : "fail";
  if (!fit.ok) {{
    const warning = document.createElement("p");
    warning.className = "diagram-fit-warning";
    warning.textContent = `Diagram validation failed: ${{fit.errors.length}} text collision(s). Do not deliver this page.`;
    document.querySelector("main").prepend(warning);
    throw new Error(warning.textContent);
  }}
}});

const reviewRoot = document.querySelector("[data-review-page]");
const reviewOutput = reviewRoot.querySelector("[data-review-output]");
const reviewStatus = reviewRoot.querySelector("[data-review-copy-status]");
const readReview = () => {{
  const answers = [...reviewRoot.querySelectorAll("[data-review-id]")].map((field) => ({{
    id: field.dataset.reviewId,
    answer: field.querySelector("input:checked")?.value ?? "No answer",
    notes: field.querySelector("[data-review-question-notes]")?.value.trim() ?? "",
  }}));
  return {{
    artifact: reviewRoot.dataset.reviewArtifact,
    answers,
    notes: reviewRoot.querySelector("[data-review-notes]")?.value.trim() ?? "",
    reviewHeader: "HTML_PRESENTATION_REVIEW",
  }};
}};
const compileReview = () => {{
  const review = readReview();
  const lines = [review.reviewHeader, `Artifact: ${{review.artifact}}`, ""];
  review.answers.forEach((answer) => {{
    lines.push(`[${{answer.id}}] ${{answer.answer}}`);
    lines.push(`Notes: ${{answer.notes || "none"}}`, "");
  }});
  lines.push(`Overall notes: ${{review.notes || "none"}}`);
  reviewOutput.value = lines.join("\\n");
  return review;
}};
const copyReview = async () => {{
  compileReview();
  try {{
    await navigator.clipboard.writeText(reviewOutput.value);
  }} catch {{
    reviewOutput.focus();
    reviewOutput.select();
    if (!document.execCommand("copy")) {{
      reviewStatus.textContent = "Copy failed. Select the reply and copy it manually.";
      return;
    }}
  }}
  reviewStatus.textContent = "Reply copied.";
}};
const downloadReview = () => {{
  const review = readReview();
  const blob = new Blob([JSON.stringify(review, null, 2)], {{ type: "application/json" }});
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${{review.artifact.replace(/\\.html$/i, "")}}-review.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}};
reviewRoot.addEventListener("input", compileReview);
reviewRoot.addEventListener("change", compileReview);
reviewRoot.querySelector("[data-review-copy]").addEventListener("click", copyReview);
reviewRoot.querySelector("[data-review-json]").addEventListener("click", downloadReview);
compileReview();
</script>
</main>
</body>
</html>
"""
    return page


def main():
    ap = argparse.ArgumentParser(description="Generate a scope-of-work explainer HTML page from a scoping-JSON bundle.")
    ap.add_argument("bundle", help="path to scopes.json")
    ap.add_argument("out", help="output HTML path (name it YYYY-MM-DD-<topic>-explainer.html)")
    ap.add_argument(
        "--d2-bin",
        default=None,
        help="path to the D2 CLI; defaults to d2 on PATH",
    )
    ap.add_argument(
        "--fit-checker",
        default=str(Path(__file__).with_name("diagram-fit-check.mjs")),
        help="path to diagram-fit-check.mjs (default: beside this script)",
    )
    args = ap.parse_args()

    bundle = json.loads(Path(args.bundle).read_text(encoding="utf-8"))
    d2_bin = args.d2_bin or shutil.which("d2")
    fit_checker_js = Path(args.fit_checker).read_text(encoding="utf-8")
    page = build(bundle, d2_bin, fit_checker_js)
    Path(args.out).write_text(page, encoding="utf-8")
    print(f"wrote {args.out} ({len(page)} bytes, {len(bundle['changes'])} changes)")
    for c in bundle["changes"]:
        print(f"  {c['key']}: {c['effort']['size']} {c['effort']['est_days']}d, "
              f"{len(c.get('risks', []))} risks, "
              f"{len(c['new_state']['components'])} components")


if __name__ == "__main__":
    main()
