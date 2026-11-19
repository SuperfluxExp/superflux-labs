import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const skill = path.join(root, "skills/explaining-with-html");

test("the template embeds the packaged fonts and licenses for offline delivery", () => {
  const css = fs.readFileSync(path.join(skill, "assets/fonts.css"), "utf8");
  const template = fs.readFileSync(path.join(skill, "template.html"), "utf8");
  assert.ok(template.includes(css));
  assert.match(css, /Instrument Sans/);
  assert.match(css, /IBM Plex Mono/);
  assert.match(css, /SIL OPEN FONT LICENSE/);
  // The base64 data is wrapped in short lines joined by CSS line continuations
  // (a backslash before each newline), which the CSS parser removes.
  const fonts = [...css.matchAll(/data:font\/woff2;base64,([A-Za-z0-9+/=\\\n]+)/g)];
  assert.equal(fonts.length, 3);
  for (const [, encoded] of fonts) {
    const font = Buffer.from(encoded.replace(/\\\n/g, ""), "base64");
    assert.equal(font.subarray(0, 4).toString("ascii"), "wOF2");
    assert.equal(font.readUInt32BE(8), font.length);
  }
  assert.doesNotMatch(css, /url\(["']?https?:/);
  assert.match(template, /font-family:"Instrument Sans"/);
  assert.match(template, /font-family:"IBM Plex Mono"/);
});
