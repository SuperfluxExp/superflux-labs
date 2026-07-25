import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const isSpaceSmokeChild = process.env.WRITE_THROUGH_PROBLEMS_SPACE_SMOKE === "1";
const validator = path.join(
  root,
  "evals",
  "skill-quality",
  "write-through-problems",
  "validate_write_through_problems.mjs",
);

function runValidator(targetRoot = root) {
  return spawnSync(process.execPath, [validator, targetRoot], {
    cwd: root,
    encoding: "utf8",
  });
}

function copyDir(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else if (entry.isFile()) fs.copyFileSync(from, to);
  }
}

test("the complete public skill package passes its validator", () => {
  const result = runValidator();
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /write-through-problems validation passed/);
});

test("the validator rejects a template that skips deliberate diffusion", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "write-through-problems-missing-diffuse-"));
  try {
    copyDir(root, tmp);
    const template = path.join(
      tmp,
      "skills",
      "write-through-problems",
      "templates",
      "recursive-thought-map.md",
    );
    assert.ok(fs.existsSync(template), "recursive thought template should exist before mutation");
    const text = fs.readFileSync(template, "utf8");
    fs.writeFileSync(template, text.replace("## 4. Diffuse / zoom out", "## 4. Keep pushing"));

    const result = runValidator(tmp);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /Diffuse \/ zoom out/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("the validator rejects private absolute paths in public text", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "write-through-problems-private-path-"));
  try {
    copyDir(root, tmp);
    const ledger = path.join(
      tmp,
      "skills",
      "write-through-problems",
      "references",
      "source-ledger.md",
    );
    assert.ok(fs.existsSync(ledger), "source ledger should exist before mutation");
    const syntheticPrivatePath = "/" + "Users/example/private.pdf";
    fs.appendFileSync(ledger, `\nPrivate source: ${syntheticPrivatePath}\n`);

    const result = runValidator(tmp);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /private or secret-looking marker/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("the validator rejects internal evaluation markers in the public baseline receipt", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "write-through-problems-internal-marker-"));
  try {
    copyDir(root, tmp);
    const baseline = path.join(
      tmp,
      "evals",
      "skill-quality",
      "write-through-problems",
      "baseline-pressure-scenario.md",
    );
    fs.appendFileSync(baseline, "\nInternal batch: deleg_deadbeef via delegate_task\n");

    const result = runValidator(tmp);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /internal evaluation marker/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("the validator rejects an urgent eval without an explicit execution mode", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "write-through-problems-missing-mode-"));
  try {
    copyDir(root, tmp);
    const evalsFile = path.join(
      tmp,
      "evals",
      "skill-quality",
      "write-through-problems",
      "evals.json",
    );
    const evals = JSON.parse(fs.readFileSync(evalsFile, "utf8"));
    delete evals.cases[0].mode;
    fs.writeFileSync(evalsFile, `${JSON.stringify(evals, null, 2)}\n`);

    const result = runValidator(tmp);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /explicit mode/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("the validator rejects generic socialization with no concrete question", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "write-through-problems-weak-socialization-"));
  try {
    copyDir(root, tmp);
    const skillFile = path.join(tmp, "skills", "write-through-problems", "SKILL.md");
    const text = fs.readFileSync(skillFile, "utf8");
    fs.writeFileSync(
      skillFile,
      text.replace(
        "Send a concrete artifact and ask one question tied to an island, assumption, or connection.",
        "Ask for feedback.",
      ),
    );

    const result = runValidator(tmp);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /concrete socialization question/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("the validator rejects a PDF inside the installable skill package", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "write-through-problems-pdf-boundary-"));
  try {
    copyDir(root, tmp);
    const pdf = path.join(
      tmp,
      "skills",
      "write-through-problems",
      "references",
      "original-presentation.pdf",
    );
    fs.writeFileSync(pdf, Buffer.from("%PDF-1.4\nsynthetic fixture\n"));

    const result = runValidator(tmp);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /PDF files are not allowed/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("the validator requires a stable-placeholder privacy gate before raw capture", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "write-through-problems-privacy-gate-"));
  try {
    copyDir(root, tmp);
    const skillFile = path.join(tmp, "skills", "write-through-problems", "SKILL.md");
    const privacyRule =
      "Before capture, replace secrets, credentials, personal data, customer names, private URLs, and local paths with stable placeholders";
    const text = fs.readFileSync(skillFile, "utf8");
    assert.ok(text.includes(privacyRule), "installed skill must define the privacy gate");
    fs.writeFileSync(skillFile, text.replace(privacyRule, "Preserve every sensitive value verbatim"));

    const result = runValidator(tmp);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /stable-placeholder privacy gate/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("the validator rejects instructions that discard captured items and hide conflicts", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "write-through-problems-capture-loss-"));
  try {
    copyDir(root, tmp);
    const skillFile = path.join(tmp, "skills", "write-through-problems", "SKILL.md");
    const text = fs.readFileSync(skillFile, "utf8");
    fs.writeFileSync(
      skillFile,
      text.replace(
        "No item may disappear during organization. If two items conflict, keep the conflict visible.",
        "Discard inconvenient items during organization and hide conflicts.",
      ),
    );

    const result = runValidator(tmp);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /capture preservation and visible conflicts/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("the validator rejects duplicate degenerate eval cases", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "write-through-problems-degenerate-evals-"));
  try {
    copyDir(root, tmp);
    const evalsFile = path.join(
      tmp,
      "evals",
      "skill-quality",
      "write-through-problems",
      "evals.json",
    );
    const evals = JSON.parse(fs.readFileSync(evalsFile, "utf8"));
    evals.cases = evals.cases.map(() => ({
      id: "duplicate",
      mode: "standard",
      prompt: "x",
      mustReveal: ["x", "x", "x", "x"],
    }));
    fs.writeFileSync(evalsFile, `${JSON.stringify(evals, null, 2)}\n`);

    const result = runValidator(tmp);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /distinct, substantive eval cases/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test(
  "the test harness resolves repository paths containing spaces",
  { skip: isSpaceSmokeChild },
  () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "write-through-problems-space-smoke-"));
    try {
      const copiedRoot = path.join(tmp, "repo with spaces");
      copyDir(root, copiedRoot);
      const copiedTest = path.join(
        copiedRoot,
        "evals",
        "skill-quality",
        "write-through-problems",
        "validate_write_through_problems.test.mjs",
      );
      const result = spawnSync(process.execPath, ["--test", copiedTest], {
        cwd: copiedRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          WRITE_THROUGH_PROBLEMS_SPACE_SMOKE: "1",
        },
      });

      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  },
);

test("the validator rejects tampering with the embedded public proof output", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "write-through-problems-proof-tamper-"));
  try {
    copyDir(root, tmp);
    const proofFile = path.join(
      tmp,
      "content",
      "proof",
      "write-through-problems",
      "2026-07-25-sample-run.md",
    );
    const text = fs.readFileSync(proofFile, "utf8");
    fs.writeFileSync(
      proofFile,
      text.replace(
        "Success in this session is the artifact leaving your hands.",
        "Success in this session is more private polishing.",
      ),
    );

    const result = runValidator(tmp);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /public proof output hash mismatch/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
