// Secret redaction for captured prompts.
//
// The corpus stores what the user actually typed, so a prompt that contained a
// credential would otherwise persist it to disk. Redaction runs BEFORE anything
// is written and before truncation, so the stored text is always fully redacted
// regardless of length.
//
// Patterns are ordered most-specific first: a connection string is matched as a
// connection string rather than falling through to the generic assigned-secret
// rule, so the marker names the real kind.

const PATTERNS = [
  {
    kind: "private-key",
    rx: /-----BEGIN(?: [A-Z]+)* PRIVATE KEY-----[\s\S]*?-----END(?: [A-Z]+)* PRIVATE KEY-----/g,
    replace: () => "[redacted:private-key]",
  },
  {
    kind: "bearer",
    rx: /\b(Bearer\s+)[A-Za-z0-9._\-+/=]{16,}/gi,
    replace: (_match, prefix) => `${prefix}[redacted:bearer]`,
  },
  {
    kind: "connection-string",
    rx: /\b([a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:)[^\s@/]{6,}@/gi,
    replace: (_match, prefix) => `${prefix}[redacted:connection-string]@`,
  },
  {
    kind: "aws-key",
    rx: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
    replace: () => "[redacted:aws-key]",
  },
  {
    kind: "api-key",
    rx: /\b(?:sk-ant-[A-Za-z0-9_-]{20,}|sk-proj-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{32,}|gh[pousr]_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,})/g,
    replace: () => "[redacted:api-key]",
  },
  {
    kind: "assigned-secret",
    rx: /\b([A-Z][A-Z0-9_]{2,}(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|PWD|CREDENTIALS?))(\s*[=:]\s*)["']?[^\s"';]{16,}["']?/g,
    replace: (_match, name, sep) => `${name}${sep}[redacted:assigned-secret]`,
  },
];

// Replace every credential-shaped run with a marker naming its kind.
// Returns "" for any non-string input rather than throwing: this runs on a hook
// path where an exception would cost the user their prompt.
export function redact(text) {
  if (typeof text !== "string") {
    return "";
  }
  let out = text;
  for (const { rx, replace } of PATTERNS) {
    out = out.replace(rx, replace);
  }
  return out;
}

export const REDACTION_KINDS = PATTERNS.map((p) => p.kind);
