#!/usr/bin/env python3
"""Public artifact safety scan.

This repository is meant to be public. The scanner has two layers:

1. Generic checks that are safe to commit publicly: local paths, token-like
   strings, secret assignments, and internal-artifact file names.
2. A private denylist supplied at runtime through the PUBLIC_ARTIFACT_DENYLIST
   environment variable. This keeps private names out of the public repo while
   still letting CI block them.
"""
from __future__ import annotations

import argparse
import math
import os
import re
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path


PRIVATE_DENYLIST_ENV = "PUBLIC_ARTIFACT_DENYLIST"
MAX_TEXT_FILE_BYTES = 2_000_000

SKIP_DIRS = {
    ".git",
    ".mypy_cache",
    ".pytest_cache",
    "__pycache__",
    "node_modules",
    "dist",
    "build",
}

SKIP_SUFFIXES = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".pdf",
    ".zip",
    ".gz",
    ".tar",
    ".ico",
}

# Safe-to-publish generic markers only. Real private names are injected through
# PRIVATE_DENYLIST_ENV and must not be committed here.
STATIC_FORBIDDEN_TERMS = [
    "DO_NOT" + "_PUBLISH",
    "INTERNAL" + "_ONLY",
    "PRIVATE" + "_CONTEXT",
    "PRIVATE" + "_CUSTOMER",
]

FORBIDDEN_FILENAME_TERMS = [
    "session-export",
    "chat-log",
    "local-secrets",
    "private-notes",
    "board-export",
]

FORBIDDEN_REGEXES = [
    ("local user path", re.compile(r"/Users/[A-Za-z0-9._-]+")),
    ("home-private path", re.compile(r"~/\.[A-Za-z0-9._-]+")),
    ("dotfile private path", re.compile(r"(?:^|[\s'\"])(?:\.env|\.ssh|\.aws|\.config/gh)(?:[\s'\"/]|$)")),
    ("github token", re.compile(r"gh[pousr]_[A-Za-z0-9_]{20,}")),
    ("github fine-grained token", re.compile(r"github_pat_[A-Za-z0-9_]{20,}")),
    ("openai-style token", re.compile(r"sk-[A-Za-z0-9]{20,}")),
    ("slack token", re.compile(r"xox[baprs]-[A-Za-z0-9-]{20,}")),
    ("aws access key", re.compile(r"AKIA[0-9A-Z]{16}")),
    ("private key block", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    (
        "secret assignment",
        re.compile(
            r"(?i)(api[_-]?key|secret|token|password|passwd|bearer)\s*[:=]\s*['\"]?[A-Za-z0-9_./+=-]{12,}"
        ),
    ),
]

ALLOWLIST_SUBSTRINGS = [
    "https://signals.forwardfuture.com/loop-library/loops/architecture-satisfaction-loop/",
]


@dataclass
class Finding:
    path: Path
    line: int
    kind: str
    snippet: str


def parse_private_denylist(raw: str | None) -> list[str]:
    if not raw:
        return []
    terms: list[str] = []
    for part in re.split(r"[\n,]", raw):
        term = part.strip()
        if not term or term.startswith("#"):
            continue
        if len(term) < 3:
            continue
        terms.append(term)
    return terms


def is_probably_binary(path: Path) -> bool:
    if path.suffix.lower() in SKIP_SUFFIXES:
        return True
    try:
        with path.open("rb") as handle:
            chunk = handle.read(2048)
    except OSError:
        return False
    return b"\0" in chunk


def iter_files(root: Path):
    for path in root.rglob("*"):
        if path.is_symlink():
            continue
        if path.is_dir():
            continue
        if not path.is_file():
            continue
        if any(part in SKIP_DIRS for part in path.relative_to(root).parts):
            continue
        if is_probably_binary(path):
            continue
        yield path


def entropy(value: str) -> float:
    if not value:
        return 0.0
    counts = {ch: value.count(ch) for ch in set(value)}
    return -sum((count / len(value)) * math.log2(count / len(value)) for count in counts.values())


def scan_text(path: Path, text: str, private_terms: list[str]) -> list[Finding]:
    findings: list[Finding] = []

    for line_no, line in enumerate(text.splitlines(), start=1):
        if path.as_posix() == ".gitignore" and line.strip() in {"." + "env"}:
            continue

        if any(item in line for item in ALLOWLIST_SUBSTRINGS):
            line_for_entropy = line
            for item in ALLOWLIST_SUBSTRINGS:
                line_for_entropy = line_for_entropy.replace(item, "")
        else:
            line_for_entropy = line

        lower_line = line.lower()
        if any(term.lower() in lower_line for term in private_terms):
            findings.append(Finding(path, line_no, "private denylist content match", "[redacted]"))
            # Do not collect any other finding for this line. A generic regex
            # finding could otherwise echo the private term in its snippet.
            continue

        for term in STATIC_FORBIDDEN_TERMS:
            if term.lower() in lower_line:
                findings.append(Finding(path, line_no, f"forbidden term: {term}", line.strip()[:180]))

        for name, pattern in FORBIDDEN_REGEXES:
            if pattern.search(line):
                findings.append(Finding(path, line_no, name, line.strip()[:180]))

        for candidate in re.findall(r"[A-Za-z0-9_+/=-]{40,}", line_for_entropy):
            if entropy(candidate) >= 4.6 and not candidate.startswith("http"):
                findings.append(Finding(path, line_no, "high-entropy string", candidate[:80]))
    return findings


def run(root: Path, private_terms: list[str], require_private_denylist: bool) -> int:
    if not root.exists() or not root.is_dir():
        print(f"PUBLIC ARTIFACT SAFETY SCAN FAILED: root is not a directory: {root}")
        return 1

    if require_private_denylist and not private_terms:
        print(
            f"PUBLIC ARTIFACT SAFETY SCAN FAILED: {PRIVATE_DENYLIST_ENV} is required but was empty"
        )
        return 1

    findings: list[Finding] = []
    for path in root.rglob("*"):
        rel = path.relative_to(root)
        rel_text = rel.as_posix()
        if any(part in SKIP_DIRS for part in rel.parts):
            continue

        if any(term.lower() in rel_text.lower() for term in private_terms):
            findings.append(Finding(rel, 0, "private denylist filename match", "[redacted]"))
            # Do not print or scan anything else for this path; later findings
            # would include the private term in the displayed location.
            continue

        for term in FORBIDDEN_FILENAME_TERMS:
            if term.lower() in rel_text.lower():
                findings.append(Finding(rel, 0, f"forbidden filename term: {term}", rel_text))

        try:
            size = path.lstat().st_size
        except OSError:
            findings.append(Finding(rel, 0, "unreadable file metadata", "[redacted]"))
            continue

        if path.is_symlink():
            findings.append(Finding(rel, 0, "symlink not allowed", "[redacted]"))
            continue
        if path.is_dir():
            continue
        if not path.is_file():
            findings.append(Finding(rel, 0, "non-regular file", "[redacted]"))
            continue
        if path.suffix.lower() in SKIP_SUFFIXES:
            continue
        if is_probably_binary(path):
            continue
        if size > MAX_TEXT_FILE_BYTES:
            findings.append(Finding(rel, 0, "oversized text file", f"{rel_text} is {size} bytes"))
            continue

        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError as exc:
            findings.append(Finding(rel, 0, "unreadable file", type(exc).__name__))
            continue
        findings.extend(scan_text(rel, text, private_terms))

    if findings:
        print("PUBLIC ARTIFACT SAFETY SCAN FAILED")
        for finding in findings:
            if finding.kind.startswith("private denylist"):
                print(f"- [private denylist match redacted] {finding.kind}")
                continue
            location = f"{finding.path}:{finding.line}" if finding.line else str(finding.path)
            print(f"- {location} [{finding.kind}] {finding.snippet}")
        return 1

    private_status = "with private denylist" if private_terms else "without private denylist"
    print(f"PUBLIC ARTIFACT SAFETY SCAN PASSED ({private_status})")
    return 0


def self_test() -> int:
    dynamic_term = "SYNTHETIC_PRIVATE_MARKER"
    cases = {
        "local path": "do not publish " + "/" + "Users/example/private",
        "github token": "token=" + "ghp_" + "abcdefghijklmnopqrstuvwxyz1234567890",
        "dynamic denylist": f"private reference to {dynamic_term}",
    }
    for name, bad in cases.items():
        findings = scan_text(Path(f"{name}.md"), bad, [dynamic_term])
        if not findings:
            print(f"self-test failed: expected findings for {name}")
            return 1
    safe = "Public runbooks need verification and stop conditions."
    if scan_text(Path("safe.md"), safe, [dynamic_term]):
        print("self-test failed: safe text produced findings")
        return 1
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        regular = root / "safe.md"
        regular.write_text(safe, encoding="utf-8")
        symlink = root / "safe-link.md"
        try:
            symlink.symlink_to(regular.name)
        except OSError:
            symlink = None
        scanned = {path.name for path in iter_files(root)}
        if "safe.md" not in scanned:
            print("self-test failed: regular file was not scanned")
            return 1
        if symlink is not None and "safe-link.md" in scanned:
            print("self-test failed: symlink was scanned")
            return 1
    print("self-test passed")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Scan public repo content for private artifacts and secrets")
    parser.add_argument("--root", default=".", help="Repository root to scan")
    parser.add_argument("--self-test", action="store_true", help="Run built-in scanner self-test first")
    parser.add_argument(
        "--require-private-denylist",
        action="store_true",
        help=f"Fail unless {PRIVATE_DENYLIST_ENV} supplies private terms to scan",
    )
    args = parser.parse_args()

    if args.self_test:
        code = self_test()
        if code:
            return code

    private_terms = parse_private_denylist(os.environ.get(PRIVATE_DENYLIST_ENV))
    return run(Path(args.root).resolve(), private_terms, args.require_private_denylist)


if __name__ == "__main__":
    raise SystemExit(main())
