import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const defaultRoot = path.resolve(new URL("../../..", import.meta.url).pathname);
const skillName = "explore-unknowns";

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/\r\n?/g, "\n");
}

function parseFrontmatter(text) {
  if (!text.startsWith("---\n")) {
    throw new Error("SKILL.md must start with YAML frontmatter");
  }
  const end = text.indexOf("\n---", 4);
  if (end === -1) {
    throw new Error("SKILL.md must close YAML frontmatter");
  }
  const lines = text.slice(4, end).split("\n");
  return Object.fromEntries(
    lines
      .map((line) => line.match(/^([a-zA-Z0-9_-]+):\s*(.+)$/))
      .filter(Boolean)
      .map((match) => [match[1], match[2].trim()]),
  );
}

function assertIncludes(text, needle, label = needle) {
  if (!text.includes(needle)) {
    throw new Error(`missing required text: ${label}`);
  }
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(from, to);
    } else if (entry.isFile()) {
      fs.copyFileSync(from, to);
    } else {
      throw new Error(`unsupported non-regular file in skill package: ${from}`);
    }
  }
}

function validateInstalledSkill(runtime, installRoot) {
  const skillFile = path.join(installRoot, skillName, "SKILL.md");
  if (!fs.existsSync(skillFile)) {
    throw new Error(`${runtime} install is missing SKILL.md`);
  }
  const text = readText(skillFile);
  const fields = parseFrontmatter(text);
  if (fields.name !== skillName) {
    throw new Error(`${runtime} installed frontmatter name mismatch: ${fields.name}`);
  }
  assertIncludes(text, "The map is not the territory", `${runtime} source frame`);
  assertIncludes(text, "Known knowns", `${runtime} known knowns`);
  assertIncludes(text, "Known unknowns", `${runtime} known unknowns`);
  assertIncludes(text, "Unknown knowns", `${runtime} unknown knowns`);
  assertIncludes(text, "Unknown unknowns", `${runtime} unknown unknowns`);
}

export function validateExploreUnknowns(root = defaultRoot) {
  const skillDir = path.join(root, "skills", skillName);
  const skillFile = path.join(skillDir, "SKILL.md");
  const sourceLedger = path.join(skillDir, "references", "source-ledger.md");
  const template = path.join(skillDir, "templates", "unknowns-map.md");
  const proofDir = path.join(root, "content", "proof", skillName);
  const sampleRunMd = path.join(proofDir, "2026-07-06-sample-run.md");
  const sampleRunHtml = path.join(proofDir, "2026-07-06-sample-run.html");
  const sampleRunPng = path.join(proofDir, "2026-07-06-sample-run.png");

  for (const filePath of [skillFile, sourceLedger, template, sampleRunMd, sampleRunHtml, sampleRunPng]) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`missing required file: ${path.relative(root, filePath)}`);
    }
  }

  const text = readText(skillFile);
  const fields = parseFrontmatter(text);
  if (fields.name !== skillName) {
    throw new Error(`frontmatter name must be ${skillName}`);
  }
  if (!fields.description?.includes("unknowns") || !fields.description?.includes("Use when")) {
    throw new Error("frontmatter description must explain the unknowns trigger");
  }
  assertIncludes(text, "Agent trigger rule", "agent trigger rule");
  assertIncludes(text, "Human trigger phrase", "human trigger phrase");

  const requiredSections = [
    "## Purpose",
    "## When to use",
    "## Output contract",
    "## The quadrant walk",
    "### 1. Known knowns",
    "### 2. Known unknowns",
    "### 3. Unknown knowns",
    "### 4. Unknown unknowns",
    "### 5. Plan with changeable decisions first",
    "### 6. During implementation: keep notes",
    "### 7. Post-implementation: proof and quiz",
    "## Runtime notes",
  ];
  for (const section of requiredSections) {
    assertIncludes(text, section);
  }

  for (const runtime of ["Hermes Agent", "Claude Code", "Codex"]) {
    assertIncludes(text, `### ${runtime}`, `${runtime} runtime install notes`);
  }

  const ledger = readText(sourceLedger);
  assertIncludes(ledger, "A Field Guide to Fable: Finding Your Unknowns");
  assertIncludes(ledger, "https://x.com/trq212/status/2073100352921215386");
  assertIncludes(ledger, "does not imply endorsement");

  const templateText = readText(template);
  for (const marker of ["## 1. Known knowns", "## 4. Unknown unknowns / blindspot pass", "## 7. Handoff proof and quiz"]) {
    assertIncludes(templateText, marker, `template ${marker}`);
  }

  const sampleRunText = readText(sampleRunMd);
  assertIncludes(sampleRunText, "Run source: Claude Code with model `fable`.", "sample run source");
  assertIncludes(sampleRunText, "## next question", "sample run next question");
  assertIncludes(readText(sampleRunHtml), "Explore Unknowns sample run", "sample run html title");
  const pngBytes = fs.statSync(sampleRunPng).size;
  if (pngBytes < 50_000) {
    throw new Error("sample-run PNG looks too small to be a real proof screenshot");
  }

  const banned = [
    /op:\/\//i,
    /OPENAI_API_KEY/i,
    /ANTHROPIC_API_KEY/i,
    /\/Users\/[^/\s]+/i,
  ];
  for (const filePath of [skillFile, sourceLedger, template, sampleRunMd, sampleRunHtml]) {
    const body = readText(filePath);
    for (const pattern of banned) {
      if (pattern.test(body)) {
        throw new Error(`private or secret-looking marker ${pattern} found in ${path.relative(root, filePath)}`);
      }
    }
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "explore-unknowns-install-"));
  try {
    const installs = {
      "hermes-agent": path.join(tmp, "hermes-home", "skills"),
      "claude-code": path.join(tmp, "project", ".claude", "skills"),
      codex: path.join(tmp, "project", ".agents", "skills"),
    };
    for (const [runtime, installRoot] of Object.entries(installs)) {
      copyDir(skillDir, path.join(installRoot, skillName));
      validateInstalledSkill(runtime, installRoot);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  validateExploreUnknowns();
  console.log("explore-unknowns validation passed");
}
