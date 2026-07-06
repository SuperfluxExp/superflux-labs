import test from "node:test";
import assert from "node:assert/strict";
import { validateExploreUnknowns } from "./validate_explore_unknowns.mjs";

test("explore-unknowns package is portable across supported skill directories", () => {
  assert.doesNotThrow(() => validateExploreUnknowns());
});
