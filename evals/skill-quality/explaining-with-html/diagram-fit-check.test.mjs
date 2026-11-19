import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const checkerPath = path.resolve(
  "skills/explaining-with-html/assets/diagram-fit-check.mjs",
);

function rect({ bottom, left, right, top }) {
  return {
    bottom,
    height: bottom - top,
    left,
    right,
    top,
    width: right - left,
  };
}

function nodeGroup(shapeBounds, textBounds, { fontSize = 16, scale = 1 } = {}) {
  const shape = {
    getBoundingClientRect: () => shapeBounds,
  };
  const text = {
    getBoundingClientRect: () => textBounds,
    getScreenCTM: () => ({
      a: scale,
      b: 0,
      c: 0,
      d: scale,
      e: 0,
      f: 0,
    }),
    ownerDocument: {
      defaultView: {
        getComputedStyle: () => ({ fontSize: `${fontSize}px` }),
      },
    },
  };
  const shapeGroup = {
    querySelector: () => shape,
  };

  return {
    querySelector(selector) {
      if (selector === ":scope > g.shape") {
        return shapeGroup;
      }
      if (selector === ":scope > text") {
        return text;
      }
      return null;
    },
  };
}

function edgeLabelGroup(textBounds, { fontSize = 14, scale = 1 } = {}) {
  const text = {
    getBoundingClientRect: () => textBounds,
    getScreenCTM: () => ({
      a: scale,
      b: 0,
      c: 0,
      d: scale,
      e: 0,
      f: 0,
    }),
    ownerDocument: {
      defaultView: {
        getComputedStyle: () => ({ fontSize: `${fontSize}px` }),
      },
    },
  };

  return {
    querySelector(selector) {
      if (selector === ":scope > g.shape") {
        return null;
      }
      if (selector === ":scope > text") {
        return text;
      }
      return null;
    },
  };
}

function edgePathGroup(points, textBounds = null) {
  const segments = points.slice(1).map((point, index) => {
    const start = points[index];
    const length = Math.hypot(point.x - start.x, point.y - start.y);
    return { end: point, length, start };
  });
  const totalLength = segments.reduce(
    (total, segment) => total + segment.length,
    0,
  );
  const path = {
    getPointAtLength(distance) {
      let remaining = Math.min(Math.max(distance, 0), totalLength);
      for (const segment of segments) {
        if (remaining <= segment.length) {
          const ratio = segment.length === 0 ? 0 : remaining / segment.length;
          return {
            x: segment.start.x + ((segment.end.x - segment.start.x) * ratio),
            y: segment.start.y + ((segment.end.y - segment.start.y) * ratio),
          };
        }
        remaining -= segment.length;
      }
      return points.at(-1);
    },
    getScreenCTM: () => ({
      a: 1,
      b: 0,
      c: 0,
      d: 1,
      e: 0,
      f: 0,
    }),
    getTotalLength: () => totalLength,
  };
  const text = textBounds
    ? { getBoundingClientRect: () => textBounds }
    : null;

  return {
    querySelector(selector) {
      if (selector === ":scope > path.connection") {
        return path;
      }
      if (selector === ":scope > text") {
        return text;
      }
      return null;
    },
  };
}

function diagram(
  groups,
  bounds = rect({ left: 0, top: 0, right: 800, bottom: 400 }),
  { heightBudget } = {},
) {
  return {
    dataset: {},
    closest(selector) {
      if (selector !== "[data-diagram-height-budget]" || heightBudget === undefined) {
        return null;
      }
      return { dataset: { diagramHeightBudget: String(heightBudget) } };
    },
    getBoundingClientRect: () => bounds,
    querySelectorAll(selector) {
      return selector === "g" ? groups : [];
    },
  };
}

function page(...diagrams) {
  return {
    querySelectorAll(selector) {
      return selector === "svg[data-d2-version]" ? diagrams : [];
    },
  };
}

function pageWithViewport({ clientWidth, scrollWidth }, ...diagrams) {
  return {
    documentElement: { clientWidth, scrollWidth },
    querySelectorAll(selector) {
      return selector === "svg[data-d2-version]" ? diagrams : [];
    },
  };
}

test("rejects D2 node text that extends outside its box", async () => {
  await import(`${pathToFileURL(checkerPath).href}?case=node-overflow`);
  const validate = globalThis.validateD2DiagramTextFit;
  const svg = diagram([
    nodeGroup(
      rect({ left: 10, top: 10, right: 110, bottom: 70 }),
      rect({ left: 4, top: 22, right: 116, bottom: 58 }),
    ),
  ]);

  const result = validate(page(svg));

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors.map(({ type }) => type), [
    "node_text_overflow",
  ]);
  assert.equal(svg.dataset.diagramFit, "fail");
});

test("rejects D2 node text rendered smaller than 14px", async () => {
  await import(`${pathToFileURL(checkerPath).href}?case=node-font-too-small`);
  const validate = globalThis.validateD2DiagramTextFit;
  const svg = diagram([
    nodeGroup(
      rect({ left: 10, top: 10, right: 110, bottom: 70 }),
      rect({ left: 30, top: 28, right: 90, bottom: 52 }),
      { fontSize: 16, scale: 0.5 },
    ),
  ]);

  const result = validate(page(svg));

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors.map(({ type }) => type), [
    "node_text_too_small",
  ]);
  assert.equal(svg.dataset.diagramFit, "fail");
});

test("rejects a D2 edge label that overlaps a node", async () => {
  await import(`${pathToFileURL(checkerPath).href}?case=edge-node-overlap`);
  const validate = globalThis.validateD2DiagramTextFit;
  const svg = diagram([
    nodeGroup(
      rect({ left: 10, top: 10, right: 110, bottom: 70 }),
      rect({ left: 30, top: 28, right: 90, bottom: 52 }),
    ),
    edgeLabelGroup(
      rect({ left: 80, top: 45, right: 140, bottom: 65 }),
    ),
  ]);

  const result = validate(page(svg));

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors.map(({ type }) => type), [
    "edge_label_overlaps_node",
  ]);
  assert.equal(svg.dataset.diagramFit, "fail");
});

test("rejects D2 edge-label text rendered smaller than 12px", async () => {
  await import(`${pathToFileURL(checkerPath).href}?case=edge-font-too-small`);
  const validate = globalThis.validateD2DiagramTextFit;
  const svg = diagram([
    edgeLabelGroup(
      rect({ left: 20, top: 20, right: 80, bottom: 40 }),
      { fontSize: 16, scale: 0.5 },
    ),
  ]);

  const result = validate(page(svg));

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors.map(({ type }) => type), [
    "edge_label_text_too_small",
  ]);
  assert.equal(svg.dataset.diagramFit, "fail");
});

test("rejects a D2 diagram above the 620px default reading budget", async () => {
  await import(`${pathToFileURL(checkerPath).href}?case=diagram-too-tall`);
  const validate = globalThis.validateD2DiagramTextFit;
  const svg = diagram(
    [
      nodeGroup(
        rect({ left: 10, top: 10, right: 110, bottom: 70 }),
        rect({ left: 30, top: 28, right: 90, bottom: 52 }),
      ),
    ],
    rect({ left: 0, top: 0, right: 700, bottom: 621 }),
  );

  const result = validate(page(svg));

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors.map(({ type }) => type), [
    "diagram_too_tall",
  ]);
  assert.equal(svg.dataset.diagramFit, "fail");
});

test("scopes one explicit 780px cap to its justified technical diagram", async () => {
  await import(`${pathToFileURL(checkerPath).href}?case=diagram-height-exception`);
  const validate = globalThis.validateD2DiagramTextFit;
  const exceptionalSvg = diagram(
    [
      nodeGroup(
        rect({ left: 10, top: 10, right: 110, bottom: 70 }),
        rect({ left: 30, top: 28, right: 90, bottom: 52 }),
      ),
    ],
    rect({ left: 0, top: 0, right: 700, bottom: 760 }),
    { heightBudget: 780 },
  );
  const regularSvg = diagram(
    [
      nodeGroup(
        rect({ left: 10, top: 10, right: 110, bottom: 70 }),
        rect({ left: 30, top: 28, right: 90, bottom: 52 }),
      ),
    ],
    rect({ left: 0, top: 0, right: 700, bottom: 760 }),
    { heightBudget: 620 },
  );

  const result = validate(page(exceptionalSvg, regularSvg));

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors.map(({ diagramIndex, type }) => ({ diagramIndex, type })), [
    { diagramIndex: 1, type: "diagram_too_tall" },
  ]);
  assert.equal(exceptionalSvg.dataset.diagramFit, "pass");
  assert.equal(regularSvg.dataset.diagramFit, "fail");
});

test("rejects more than one exceptional diagram height budget on a page", async () => {
  await import(`${pathToFileURL(checkerPath).href}?case=multiple-height-exceptions`);
  const validate = globalThis.validateD2DiagramTextFit;
  const firstSvg = diagram(
    [],
    rect({ left: 0, top: 0, right: 700, bottom: 600 }),
    { heightBudget: 780 },
  );
  const secondSvg = diagram(
    [],
    rect({ left: 0, top: 0, right: 700, bottom: 600 }),
    { heightBudget: 780 },
  );

  const result = validate(page(firstSvg, secondSvg));

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors.map(({ type }) => type), [
    "multiple_diagram_height_exceptions",
  ]);
  assert.equal(firstSvg.dataset.diagramFit, "fail");
  assert.equal(secondSvg.dataset.diagramFit, "fail");
});

test("rejects page-level horizontal overflow", async () => {
  await import(`${pathToFileURL(checkerPath).href}?case=page-horizontal-overflow`);
  const validate = globalThis.validateD2DiagramTextFit;

  const result = validate(pageWithViewport({
    clientWidth: 1000,
    scrollWidth: 1001,
  }));

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors.map(({ type }) => type), [
    "page_horizontal_overflow",
  ]);
});

test("rejects overlapping D2 edge labels", async () => {
  await import(`${pathToFileURL(checkerPath).href}?case=edge-label-overlap`);
  const validate = globalThis.validateD2DiagramTextFit;
  const svg = diagram([
    edgeLabelGroup(
      rect({ left: 10, top: 10, right: 80, bottom: 30 }),
    ),
    edgeLabelGroup(
      rect({ left: 60, top: 18, right: 130, bottom: 38 }),
    ),
  ]);

  const result = validate(page(svg));

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors.map(({ type }) => type), [
    "edge_labels_overlap",
  ]);
  assert.equal(svg.dataset.diagramFit, "fail");
});

test("rejects a D2 edge path that crosses an edge label", async () => {
  await import(`${pathToFileURL(checkerPath).href}?case=edge-path-label-overlap`);
  const validate = globalThis.validateD2DiagramTextFit;
  const svg = diagram([
    edgePathGroup([
      { x: 0, y: 50 },
      { x: 100, y: 50 },
    ]),
    edgeLabelGroup(
      rect({ left: 42, top: 40, right: 58, bottom: 60 }),
    ),
  ]);

  const result = validate(page(svg));

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors.map(({ type }) => type), [
    "edge_path_overlaps_label",
  ]);
  assert.equal(svg.dataset.diagramFit, "fail");
});

test("allows the labeled edge's own path behind its label", async () => {
  await import(`${pathToFileURL(checkerPath).href}?case=own-edge-label`);
  const validate = globalThis.validateD2DiagramTextFit;
  const svg = diagram([
    edgePathGroup(
      [
        { x: 0, y: 50 },
        { x: 100, y: 50 },
      ],
      rect({ left: 42, top: 40, right: 58, bottom: 60 }),
    ),
  ]);

  const result = validate(page(svg));

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.equal(svg.dataset.diagramFit, "pass");
});

test("ignores SVG that was not generated by D2", async () => {
  await import(`${pathToFileURL(checkerPath).href}?case=ignore-non-d2`);
  const validate = globalThis.validateD2DiagramTextFit;
  const decorativeSvg = diagram([
    nodeGroup(
      rect({ left: 10, top: 10, right: 110, bottom: 70 }),
      rect({ left: 4, top: 22, right: 116, bottom: 58 }),
    ),
  ]);
  const root = {
    querySelectorAll(selector) {
      return selector === "svg" ? [decorativeSvg] : [];
    },
  };

  const result = validate(root);

  assert.equal(result.ok, true);
  assert.equal(result.diagramCount, 0);
  assert.deepEqual(result.errors, []);
});

test("ignores D2 container labels and container bounds", async () => {
  await import(`${pathToFileURL(checkerPath).href}?case=container-bounds`);
  const validate = globalThis.validateD2DiagramTextFit;
  const svg = diagram([
    nodeGroup(
      rect({ left: 0, top: 0, right: 220, bottom: 160 }),
      rect({ left: 70, top: 1, right: 150, bottom: 12 }),
    ),
    nodeGroup(
      rect({ left: 30, top: 40, right: 100, bottom: 100 }),
      rect({ left: 42, top: 58, right: 88, bottom: 82 }),
    ),
    edgeLabelGroup(
      rect({ left: 125, top: 65, right: 175, bottom: 85 }),
    ),
  ]);

  const result = validate(page(svg));

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.equal(svg.dataset.diagramFit, "pass");
});
