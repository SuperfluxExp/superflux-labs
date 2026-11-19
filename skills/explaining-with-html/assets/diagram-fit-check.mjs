  const shapeSelector = "rect, ellipse, polygon, path";

  function isRendered(bounds) {
    return bounds.width > 0 && bounds.height > 0;
  }

  function textFitsInsideShape(textBounds, shapeBounds, padding) {
    return (
      textBounds.left >= shapeBounds.left + padding
      && textBounds.right <= shapeBounds.right - padding
      && textBounds.top >= shapeBounds.top + padding
      && textBounds.bottom <= shapeBounds.bottom - padding
    );
  }

  function boxesOverlap(first, second, clearance) {
    return (
      first.left < second.right + clearance
      && first.right > second.left - clearance
      && first.top < second.bottom + clearance
      && first.bottom > second.top - clearance
    );
  }

  function boxContains(outer, inner) {
    const isLarger = outer.width > inner.width || outer.height > inner.height;
    return (
      isLarger
      && outer.left <= inner.left
      && outer.right >= inner.right
      && outer.top <= inner.top
      && outer.bottom >= inner.bottom
    );
  }

  function pointTouchesBox(point, bounds, clearance) {
    return (
      point.x >= bounds.left - clearance
      && point.x <= bounds.right + clearance
      && point.y >= bounds.top - clearance
      && point.y <= bounds.bottom + clearance
    );
  }

  function pathTouchesBox(path, bounds, clearance, sampleStep) {
    const matrix = path.getScreenCTM();
    const length = path.getTotalLength();
    if (!matrix || !Number.isFinite(length) || length <= 0) {
      return false;
    }

    const sampleAt = (distance) => {
      const point = path.getPointAtLength(distance);
      return {
        x: (matrix.a * point.x) + (matrix.c * point.y) + matrix.e,
        y: (matrix.b * point.x) + (matrix.d * point.y) + matrix.f,
      };
    };

    for (let distance = 0; distance < length; distance += sampleStep) {
      if (pointTouchesBox(sampleAt(distance), bounds, clearance)) {
        return true;
      }
    }
    return pointTouchesBox(sampleAt(length), bounds, clearance);
  }

  function renderedFontSize(text) {
    const view = text.ownerDocument?.defaultView;
    const fontSize = Number.parseFloat(
      view?.getComputedStyle?.(text)?.fontSize ?? "",
    );
    if (!Number.isFinite(fontSize)) {
      return null;
    }

    const matrix = text.getScreenCTM?.();
    if (!matrix) {
      return fontSize;
    }
    const scaleX = Math.hypot(matrix.a, matrix.b);
    const scaleY = Math.hypot(matrix.c, matrix.d);
    const scale = Math.min(scaleX, scaleY);
    return Number.isFinite(scale) && scale > 0 ? fontSize * scale : fontSize;
  }

  function validateD2DiagramTextFit(root = document, options = {}) {
    const padding = options.padding ?? 4;
    const edgeClearance = options.edgeClearance ?? 2;
    const pathSampleStep = options.pathSampleStep ?? 4;
    const nodeMinFontSize = options.nodeMinFontSize ?? 14;
    const edgeMinFontSize = options.edgeMinFontSize ?? 12;
    const maxDiagramHeight = options.maxDiagramHeight ?? 620;
    const defaultDiagramHeight = Math.min(maxDiagramHeight, 620);
    const maximumExceptionalDiagramHeight = 780;
    const errors = [];
    const pageBounds = root.documentElement;
    if (
      pageBounds
      && pageBounds.scrollWidth > pageBounds.clientWidth
    ) {
      errors.push({
        clientWidth: pageBounds.clientWidth,
        scrollWidth: pageBounds.scrollWidth,
        type: "page_horizontal_overflow",
      });
    }
    const diagrams = [...root.querySelectorAll("svg[data-d2-version]")];
    const exceptionalDiagrams = [];

    diagrams.forEach((svg, diagramIndex) => {
      const diagramErrors = [];
      const svgBounds = svg.getBoundingClientRect();
      const budgetShell = svg.closest?.("[data-diagram-height-budget]");
      const requestedBudget = Number.parseFloat(
        budgetShell?.dataset?.diagramHeightBudget ?? "",
      );
      const hasLocalBudget = Number.isFinite(requestedBudget) && requestedBudget > 0;
      const diagramHeightBudget = hasLocalBudget
        ? Math.min(requestedBudget, maximumExceptionalDiagramHeight)
        : defaultDiagramHeight;
      if (hasLocalBudget && requestedBudget > maximumExceptionalDiagramHeight) {
        diagramErrors.push({
          diagramIndex,
          maximumHeight: maximumExceptionalDiagramHeight,
          requestedHeight: requestedBudget,
          type: "diagram_height_budget_above_exception_cap",
        });
      }
      if (diagramHeightBudget > 620) {
        exceptionalDiagrams.push({ diagramIndex, svg });
      }
      if (isRendered(svgBounds) && svgBounds.height > diagramHeightBudget) {
        diagramErrors.push({
          diagramIndex,
          height: svgBounds.height,
          maximumHeight: diagramHeightBudget,
          type: "diagram_too_tall",
        });
      }
      const groups = [...svg.querySelectorAll("g")];
      const nodeCandidates = [];
      const edgeLabels = [];
      const edgePaths = [];

      groups.forEach((group, groupIndex) => {
        const connection = group.querySelector(":scope > path.connection");
        if (connection) {
          edgePaths.push({ connection, groupIndex });
        }

        const shapeGroup = group.querySelector(":scope > g.shape");
        const text = group.querySelector(":scope > text");
        if (!text) {
          return;
        }

        if (!shapeGroup) {
          const textBounds = text.getBoundingClientRect();
          if (isRendered(textBounds)) {
            edgeLabels.push({ groupIndex, text, textBounds });
          }
          return;
        }

        const shape = shapeGroup.querySelector(shapeSelector);
        if (!shape) {
          return;
        }

        const shapeBounds = shape.getBoundingClientRect();
        const textBounds = text.getBoundingClientRect();
        if (!isRendered(shapeBounds) || !isRendered(textBounds)) {
          return;
        }

        nodeCandidates.push({ groupIndex, shapeBounds, text, textBounds });
      });

      const nodeShapes = nodeCandidates.filter(
        (candidate, candidateIndex) =>
          !nodeCandidates.some(
            (other, otherIndex) =>
              candidateIndex !== otherIndex
              && boxContains(candidate.shapeBounds, other.shapeBounds),
          ),
      );

      nodeShapes.forEach(({ groupIndex, shapeBounds, text, textBounds }) => {
        if (!textFitsInsideShape(textBounds, shapeBounds, padding)) {
          diagramErrors.push({
            diagramIndex,
            groupIndex,
            type: "node_text_overflow",
          });
        }
        const fontSize = renderedFontSize(text);
        if (fontSize !== null && fontSize < nodeMinFontSize) {
          diagramErrors.push({
            diagramIndex,
            fontSize,
            groupIndex,
            minimumFontSize: nodeMinFontSize,
            type: "node_text_too_small",
          });
        }
      });

      edgeLabels.forEach(({ groupIndex, text, textBounds }) => {
        const fontSize = renderedFontSize(text);
        if (fontSize !== null && fontSize < edgeMinFontSize) {
          diagramErrors.push({
            diagramIndex,
            fontSize,
            groupIndex,
            minimumFontSize: edgeMinFontSize,
            type: "edge_label_text_too_small",
          });
        }
        const overlapsNode = nodeShapes.some(({ shapeBounds }) =>
          boxesOverlap(textBounds, shapeBounds, edgeClearance)
        );
        if (overlapsNode) {
          diagramErrors.push({
            diagramIndex,
            groupIndex,
            type: "edge_label_overlaps_node",
          });
        }
      });

      edgeLabels.forEach((label, labelIndex) => {
        const overlapsEarlierLabel = edgeLabels
          .slice(0, labelIndex)
          .some(({ textBounds }) =>
            boxesOverlap(label.textBounds, textBounds, edgeClearance)
          );
        if (overlapsEarlierLabel) {
          diagramErrors.push({
            diagramIndex,
            groupIndex: label.groupIndex,
            type: "edge_labels_overlap",
          });
        }
      });

      edgeLabels.forEach(({ groupIndex, textBounds }) => {
        const overlapsPath = edgePaths.some(
          ({ connection, groupIndex: pathGroupIndex }) =>
            pathGroupIndex !== groupIndex
            && pathTouchesBox(
              connection,
              textBounds,
              edgeClearance,
              pathSampleStep,
            ),
        );
        if (overlapsPath) {
          diagramErrors.push({
            diagramIndex,
            groupIndex,
            type: "edge_path_overlaps_label",
          });
        }
      });

      svg.dataset.diagramFit = diagramErrors.length === 0 ? "pass" : "fail";
      svg.dataset.diagramFitErrors = String(diagramErrors.length);
      errors.push(...diagramErrors);
    });

    if (exceptionalDiagrams.length > 1) {
      errors.push({
        diagramIndexes: exceptionalDiagrams.map(({ diagramIndex }) => diagramIndex),
        type: "multiple_diagram_height_exceptions",
      });
      exceptionalDiagrams.forEach(({ svg }) => {
        svg.dataset.diagramFit = "fail";
      });
    }

    return {
      diagramCount: diagrams.length,
      errors,
      ok: errors.length === 0,
    };
  }

  globalThis.validateD2DiagramTextFit = validateD2DiagramTextFit;
  export { validateD2DiagramTextFit };

/** Check rendered text diagrams after fonts load; this does not assess meaning. */
function validateAsciiDiagramFit(root = document) {
  const diagrams = [...root.querySelectorAll('pre[data-diagram-format="ascii"]')];
  const errors = diagrams.flatMap((pre, diagramIndex) => {
    const issues = [];
    const view = pre.ownerDocument.defaultView;
    const style = view.getComputedStyle(pre);
    const bounds = pre.getBoundingClientRect();
    const add = (type) => issues.push({ diagramIndex, type });
    if (!isRendered(bounds)) add("ascii_hidden");
    if (!pre.textContent.trim()) add("ascii_empty");
    if (pre.querySelectorAll("*").length > 0) add("ascii_markup_in_text");
    if (/[\t\r]/.test(pre.textContent)) add("ascii_control_whitespace");
    if (style.whiteSpace !== "pre" || style.overflowWrap !== "normal" || !["normal", "keep-all"].includes(style.wordBreak)) add("ascii_destructive_wrapping");
    if (!/monospace/i.test(style.fontFamily)) add("ascii_not_monospace");
    // offsetWidth/Height round to integers. Compare fractional used border-box
    // dimensions on both axes, including ancestor transforms. Computed style
    // serialization can round by 0.001px; that geometry tolerance is not a font
    // size allowance and cannot turn authored text below 16px into a pass.
    const borderBoxSize = (dimension, additions) => Number.parseFloat(style[dimension])
      + (style.boxSizing === "border-box" ? 0 : additions.reduce(
        (total, property) => total + Number.parseFloat(style[property]), 0,
      ));
    const layoutWidth = borderBoxSize("width", ["paddingLeft", "paddingRight", "borderLeftWidth", "borderRightWidth"]);
    const layoutHeight = borderBoxSize("height", ["paddingTop", "paddingBottom", "borderTopWidth", "borderBottomWidth"]);
    const scaleX = layoutWidth > 0 && bounds.width + 0.001 < layoutWidth ? bounds.width / layoutWidth : 1;
    const scaleY = layoutHeight > 0 && bounds.height + 0.001 < layoutHeight ? bounds.height / layoutHeight : 1;
    if (Number.parseFloat(style.fontSize) * Math.min(1, scaleX, scaleY) < 16) add("ascii_text_too_small");
    const captionId = pre.getAttribute("aria-labelledby");
    const caption = captionId ? pre.ownerDocument.getElementById(captionId) : null;
    if (!caption?.textContent.trim()) add("ascii_missing_summary");
    if (pre.scrollWidth > pre.clientWidth + 1) {
      if (!["auto", "scroll"].includes(style.overflowX)) add("ascii_uncontained_overflow");
      if (pre.tabIndex < 0 || pre.getAttribute("role") !== "region") add("ascii_scroll_not_keyboard_accessible");
    }
    const doc = pre.ownerDocument.documentElement;
    if (doc.scrollWidth > doc.clientWidth + 1) add("page_horizontal_overflow");
    pre.dataset.diagramFit = issues.length === 0 ? "pass" : "fail";
    return issues;
  });
  return { diagramCount: diagrams.length, errors, ok: errors.length === 0 };
}

globalThis.validateAsciiDiagramFit = validateAsciiDiagramFit;
export { validateAsciiDiagramFit };
