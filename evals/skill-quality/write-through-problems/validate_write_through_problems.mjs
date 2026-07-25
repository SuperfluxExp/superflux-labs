import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const skillName = "write-through-problems";

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/\r\n?/g, "\n");
}

function parseFrontmatter(text) {
  if (!text.startsWith("---\n")) throw new Error("SKILL.md must start with YAML frontmatter");
  const end = text.indexOf("\n---", 4);
  if (end === -1) throw new Error("SKILL.md must close YAML frontmatter");
  const lines = text.slice(4, end).split("\n");
  return Object.fromEntries(
    lines
      .map((line) => line.match(/^([a-zA-Z0-9_-]+):\s*(.+)$/))
      .filter(Boolean)
      .map((match) => [match[1], match[2].trim()]),
  );
}

function assertIncludes(text, needle, label = needle) {
  if (!text.includes(needle)) throw new Error(`missing required text: ${label}`);
}

function copyDir(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else if (entry.isFile()) fs.copyFileSync(from, to);
    else throw new Error(`unsupported non-regular file in skill package: ${from}`);
  }
}

function listRegularFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const item = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listRegularFiles(item));
    else if (entry.isFile()) files.push(item);
    else throw new Error(`unsupported non-regular file in skill package: ${item}`);
  }
  return files;
}

function validateInstalledSkill(runtime, installRoot) {
  const installed = path.join(installRoot, skillName);
  const skillFile = path.join(installed, "SKILL.md");
  const template = path.join(installed, "templates", "recursive-thought-map.md");
  const ledger = path.join(installed, "references", "source-ledger.md");
  for (const filePath of [skillFile, template, ledger]) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`${runtime} install is missing ${path.relative(installed, filePath)}`);
    }
  }
  const fields = parseFrontmatter(readText(skillFile));
  if (fields.name !== skillName) {
    throw new Error(`${runtime} installed frontmatter name mismatch: ${fields.name}`);
  }
}

export function validateWriteThroughProblems(root = defaultRoot) {
  const skillDir = path.join(root, "skills", skillName);
  const skillFile = path.join(skillDir, "SKILL.md");
  const sourceLedger = path.join(skillDir, "references", "source-ledger.md");
  const template = path.join(skillDir, "templates", "recursive-thought-map.md");
  const evalDir = path.join(root, "evals", "skill-quality", skillName);
  const expectedBehavior = path.join(evalDir, "expected-behavior.md");
  const evalsFile = path.join(evalDir, "evals.json");
  const baselineReceipt = path.join(evalDir, "baseline-pressure-scenario.md");
  const iterationFeedback = path.join(evalDir, "iterations", "001", "feedback.md");
  const iterationTwoFeedback = path.join(evalDir, "iterations", "002", "feedback.md");
  const iterationThreeFeedback = path.join(evalDir, "iterations", "003", "feedback.md");
  const proofFile = path.join(root, "content", "proof", skillName, "2026-07-25-sample-run.md");
  const decisionTrace = path.join(root, "docs", "decisions", "2026-07-25-write-through-problems.md");

  const requiredFiles = [
    skillFile,
    sourceLedger,
    template,
    expectedBehavior,
    evalsFile,
    baselineReceipt,
    iterationFeedback,
    iterationTwoFeedback,
    iterationThreeFeedback,
    proofFile,
    decisionTrace,
  ];
  for (const filePath of requiredFiles) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`missing required file: ${path.relative(root, filePath)}`);
    }
  }

  const skillPackageFiles = listRegularFiles(skillDir);
  for (const filePath of skillPackageFiles) {
    const extension = path.extname(filePath).toLowerCase();
    if (extension === ".pdf") {
      throw new Error(`PDF files are not allowed in the installable skill package: ${path.relative(root, filePath)}`);
    }
    if (extension !== ".md") {
      throw new Error(`unsupported file type in installable skill package: ${path.relative(root, filePath)}`);
    }
  }

  const skillText = readText(skillFile);
  const fields = parseFrontmatter(skillText);
  if (fields.name !== skillName) throw new Error(`frontmatter name must be ${skillName}`);
  if (!fields.description?.startsWith("Use when")) {
    throw new Error("frontmatter description must start with a trigger beginning 'Use when'");
  }
  if (fields.author !== "Kandarp Jani") throw new Error("frontmatter must preserve author attribution");
  if (fields.license !== "MIT-0") throw new Error("frontmatter license must be MIT-0");

  const skillMarkers = [
    "# Recursive Thought Writing",
    "## Purpose",
    "## When to use",
    "## Output contract",
    "### 1. Capture without solving",
    "### 2. Organize into actions and investigations",
    "### 3. Map islands of subproblems",
    "### 4. Diffuse / zoom out",
    "### 5. Recurse and socialize",
    "### 6. Graduate into a decision artifact",
    "## Pressure rules",
    "## Failure modes",
    "## Runtime notes",
    "## Done condition",
    "What else is still in the mind?",
    "Quick-mode recursion budget: **one cycle**",
    "Standard-mode recursion budget: **two cycles**",
    "Target 600–1,000 words, with a hard ceiling of 1,200 words",
    "Ceremonial overproduction",
  ];
  for (const marker of skillMarkers) assertIncludes(skillText, marker);

  assertIncludes(
    skillText,
    "Send a concrete artifact and ask one question tied to an island, assumption, or connection.",
    "concrete socialization question",
  );
  assertIncludes(
    skillText,
    "Before capture, replace secrets, credentials, personal data, customer names, private URLs, and local paths with stable placeholders",
    "stable-placeholder privacy gate",
  );
  assertIncludes(
    skillText,
    "No item may disappear during organization. If two items conflict, keep the conflict visible.",
    "capture preservation and visible conflicts",
  );
  for (const marker of [
    "Question | Name the smallest investigation that could answer it.",
    "Solution idea | Name the assumption it depends on and the cheapest test.",
    "Reaction | Ask what expectation was violated and what evidence would explain it.",
    "Graduate only when:",
  ]) {
    assertIncludes(skillText, marker, `core method invariant ${marker}`);
  }

  for (const runtime of ["Hermes Agent", "Claude Code", "Codex"]) {
    assertIncludes(skillText, `### ${runtime}`, `${runtime} runtime notes`);
  }

  const ledgerText = readText(sourceLedger);
  for (const marker of [
    "How to write your way to problem solving?",
    "Kandarp Jani",
    "March 2023",
    "original presentation is not included",
    "synthetic diffuse pass",
  ]) {
    assertIncludes(ledgerText, marker, `source ledger ${marker}`);
  }

  const templateText = readText(template);
  for (const marker of [
    "## 1. Raw capture",
    "## 2. Organized thought ledger",
    "## 3. Islands of subproblems",
    "## 4. Diffuse / zoom out",
    "## 5. Recurse and socialize",
    "## 6. Convergence and graduation",
    "Reaction received and recaptured",
    "**Privacy gate:** Replace secrets",
  ]) {
    assertIncludes(templateText, marker, `template ${marker}`);
  }

  const expectedText = readText(expectedBehavior);
  assertIncludes(expectedText, "premature convergence", "expected behavior failure signature");
  assertIncludes(expectedText, "13/16", "release score threshold");

  const evals = JSON.parse(readText(evalsFile));
  if (evals.skill !== skillName || !Array.isArray(evals.cases) || evals.cases.length !== 3) {
    throw new Error("evals.json must define exactly three write-through-problems cases");
  }
  const allowedModes = new Set(["quick", "standard", "deep"]);
  const ids = new Set();
  const prompts = new Set();
  for (const item of evals.cases) {
    if (!item.id || !item.prompt || !Array.isArray(item.mustReveal) || item.mustReveal.length < 4) {
      throw new Error(`invalid eval case: ${JSON.stringify(item)}`);
    }
    if (!allowedModes.has(item.mode)) {
      throw new Error(`eval case must define an explicit mode: ${item.id}`);
    }
    const reveals = new Set(item.mustReveal);
    if (
      item.id.length < 8 ||
      item.prompt.length < 80 ||
      ids.has(item.id) ||
      prompts.has(item.prompt) ||
      reveals.size !== item.mustReveal.length ||
      item.mustReveal.some((value) => typeof value !== "string" || value.length < 12)
    ) {
      throw new Error("evals.json must define distinct, substantive eval cases");
    }
    ids.add(item.id);
    prompts.add(item.prompt);
    if (
      item.mode === "quick" &&
      (!Number.isInteger(item.maxWords) || item.maxWords <= 0 || item.maxWords > 1200)
    ) {
      throw new Error(`quick eval case must cap output at 1200 words: ${item.id}`);
    }
  }

  const baselineText = readText(baselineReceipt);
  for (const marker of [
    "Founder noodling",
    "Architecture from mixed note",
    "Unarticulated design reaction",
    "openai-codex / gpt-5.6-sol",
    "SHA-256",
    "Baseline rubric scores",
  ]) {
    assertIncludes(baselineText, marker, `baseline receipt ${marker}`);
  }

  const feedbackText = readText(iterationFeedback);
  assertIncludes(feedbackText, "3,487 words / 22,894 bytes", "iteration failure measurement");
  assertIncludes(feedbackText, "ceremonial overproduction", "iteration corrective rule");

  const iterationTwoText = readText(iterationTwoFeedback);
  assertIncludes(iterationTwoText, "1,232 words / 8,001 bytes", "iteration two failure measurement");
  assertIncludes(iterationTwoText, "600–1,000 words", "iteration two generation buffer");

  const iterationThreeText = readText(iterationThreeFeedback);
  assertIncludes(iterationThreeText, "1,076 words / 6,960 bytes", "iteration three passing measurement");
  assertIncludes(iterationThreeText, "16/16", "iteration three rubric score");

  const proofText = readText(proofFile);
  assertIncludes(proofText, "Skill-guided output (trailing whitespace normalized)", "public proof output heading");
  assertIncludes(
    proofText,
    "06084c20691bd7cbadf0bcb6b80a4b78966f48292577beeece053eebe18c5b60",
    "public proof output hash",
  );

  const catalog = JSON.parse(readText(path.join(root, "catalog", "skills.json")));
  const entry = catalog.skills?.find((item) => item.name === skillName);
  if (!entry) throw new Error("catalog is missing write-through-problems");
  if (entry.displayName !== "Recursive Thought Writing") {
    throw new Error("catalog display name must preserve the original process name");
  }
  if (entry.proof !== "content/proof/write-through-problems/2026-07-25-sample-run.md") {
    throw new Error("catalog proof path must identify the passing sample run");
  }
  for (const runtime of ["hermes-agent", "claude-code", "codex"]) {
    if (!entry.supportedRuntimes?.includes(runtime)) throw new Error(`catalog is missing runtime ${runtime}`);
  }

  const packageJson = JSON.parse(readText(path.join(root, "package.json")));
  for (const script of ["test:write-through-problems", "validate:write-through-problems"]) {
    if (!packageJson.scripts?.[script]) throw new Error(`package.json is missing ${script}`);
  }

  const banned = [
    /op:\/\//i,
    /OPENAI_API_KEY/i,
    /ANTHROPIC_API_KEY/i,
    /\/Users\/[^/\s]+/i,
    /github_pat_[A-Za-z0-9_]{20,}/i,
  ];
  for (const filePath of new Set([...requiredFiles, ...skillPackageFiles])) {
    const body = readText(filePath);
    for (const pattern of banned) {
      if (pattern.test(body)) {
        throw new Error(`private or secret-looking marker ${pattern} found in ${path.relative(root, filePath)}`);
      }
    }
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "write-through-problems-install-"));
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    validateWriteThroughProblems(process.argv[2] ? path.resolve(process.argv[2]) : defaultRoot);
    console.log("write-through-problems validation passed");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
