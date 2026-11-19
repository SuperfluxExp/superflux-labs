import { test } from "node:test";
import assert from "node:assert/strict";

import { redact } from "../src/redact.mjs";
import { ANTHROPIC_KEY, ASSIGNED_SECRET_VALUE, BEARER_TOKEN_HEAD, CONNECTION_PASSWORD, AWS_KEY_ID, AWS_KEY_ID_2, GITHUB_TOKEN, OPENAI_KEY, PRIVATE_KEY_BLOCK } from "./fake-secrets.mjs";

test("leaves ordinary prose untouched", () => {
  const text = "the cadence section reads better now, ship it";
  assert.equal(redact(text), text);
});

test("redacts an Anthropic-style API key", () => {
  const out = redact(`use ${ANTHROPIC_KEY} for this`);
  assert.ok(!out.includes("sk-ant-api03"), "raw key must not survive");
  assert.match(out, /\[redacted:api-key\]/);
  assert.match(out, /^use .* for this$/);
});

test("redacts an OpenAI-style key", () => {
  const out = redact(`key is ${OPENAI_KEY}`);
  assert.ok(!out.includes("sk-proj-0123456789"));
  assert.match(out, /\[redacted:api-key\]/);
});

test("redacts an AWS access key id", () => {
  const out = redact(`${AWS_KEY_ID} is the id`);
  assert.ok(!out.includes(AWS_KEY_ID));
  assert.match(out, /\[redacted:aws-key\]/);
});

test("redacts a GitHub token", () => {
  const out = redact(`token ${GITHUB_TOKEN}`);
  assert.ok(!out.includes("ghp_0123456789"));
  assert.match(out, /\[redacted:api-key\]/);
});

test("redacts a bearer token in a header", () => {
  const out = redact(`curl -H 'Authorization: Bearer ${BEARER_TOKEN_HEAD}.abc.def'`);
  assert.ok(!out.includes(BEARER_TOKEN_HEAD));
  assert.match(out, /\[redacted:bearer\]/);
});

test("redacts a private key block", () => {
  const out = redact(PRIVATE_KEY_BLOCK);
  assert.ok(!out.includes("MIIEowIBAAKCAQEA"));
  assert.match(out, /\[redacted:private-key\]/);
});

test("redacts a password inside a connection string", () => {
  const out = redact(`postgres://admin:${CONNECTION_PASSWORD}@db.internal:5432/app`);
  assert.ok(!out.includes(CONNECTION_PASSWORD));
  assert.match(out, /\[redacted:connection-string\]/);
});

test("redacts an assigned secret-looking value", () => {
  const out = redact(`ANTHROPIC_API_KEY="${ASSIGNED_SECRET_VALUE}"`);
  assert.ok(!out.includes(ASSIGNED_SECRET_VALUE));
  assert.match(out, /\[redacted:assigned-secret\]/);
});

test("does not redact an ordinary assignment with a short value", () => {
  const text = 'NODE_ENV="production"';
  assert.equal(redact(text), text);
});

test("does not mangle a normal hyphenated word that starts with sk", () => {
  const text = "skip the sketch and ship";
  assert.equal(redact(text), text);
});

test("handles non-string input without throwing", () => {
  assert.equal(redact(undefined), "");
  assert.equal(redact(null), "");
  assert.equal(redact(42), "");
});

test("redacts every occurrence, not just the first", () => {
  const out = redact(`${AWS_KEY_ID} and ${AWS_KEY_ID_2}`);
  assert.equal(out.match(/\[redacted:aws-key\]/g).length, 2);
});
