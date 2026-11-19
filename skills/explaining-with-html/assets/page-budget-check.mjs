import fs from "node:fs";
import { fileURLToPath } from "node:url";

// Picture-first page budget. The ceilings come from the redesign the reader
// approved on 2026-10-30: the same facts as a 3,101-visible-word page, shown in
// 1,058 visible words and seven diagrams. A page that needs more than this is
// either two pages or has proof that belongs in an expander.
export const pageBudget = Object.freeze({
  maxVisibleWords: 1200,
  maxCaptionSentences: 2,
  maxParagraphWords: 60,
  minFigures: 1,
});

// Regions the reader does not see on arrival. Words inside them are depth, not
// spine: expanders, code, unrendered module templates, form controls, footers.
const depthTags = ["details", "template", "pre", "textarea", "fieldset", "footer", "script", "style", "head"];

function decodeHtml(text) {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/gi, "&");
}

function removeElements(html, tag) {
  // Innermost first, so nested expanders do not leave their outer tail behind.
  const innermost = new RegExp(`<${tag}\\b[^>]*>(?:(?!<${tag}\\b)[\\s\\S])*?<\\/${tag}>`, "gi");
  let previous = "";
  let current = html;
  while (current !== previous) {
    previous = current;
    current = current.replace(innermost, " ");
  }
  return current;
}

function visibleSpine(html) {
  return depthTags.reduce(removeElements, html.replace(/<!--[\s\S]*?-->/g, " "));
}

// Mirrors visibleSpine() in verify-human-readable-output.mjs, which compares this
// count with attentionBudgetMinutes × 220. Diagram labels and form text are read,
// so they count here, unlike in visibleWords. Keep the two functions in step.
function readingWordCount(html) {
  return html
    .replace(/<details\b[\s\S]*?<\/details>/gi, " ")
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, " ")
    .replace(/<(?:script|style|pre)\b[\s\S]*?<\/(?:script|style|pre)>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word !== "").length;
}

function leftoverKitErrors(html) {
  const errors = [];
  const modules = [...html.matchAll(/<template\b[^>]*\bdata-module\b/gi)].length;
  if (modules > 0) {
    errors.push({
      code: "leftover_template_module",
      message: "Delete every <template data-module> block from the delivered page; copy a module into the page only when its trigger applies.",
      count: modules,
    });
  }
  if (html.includes("explaining-with-html STARTING KIT")) {
    errors.push({
      code: "leftover_kit_comment",
      message: "Delete the template's STARTING KIT authoring comment from the delivered page.",
    });
  }
  return errors;
}

function plainText(fragment) {
  return decodeHtml(fragment.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function countWords(text) {
  return text.split(" ").filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

function countSentences(text) {
  // A sentence ends at . ! or ? followed by a capitalised word, or at the end.
  // Lower-case continuations ("e.g. on") and numbers do not start a sentence.
  return text
    .split(/(?<=[.!?])\s+(?=[\p{Lu}“"‘(])/u)
    .filter((sentence) => countWords(sentence) > 0).length;
}

function figuresWithSvg(html) {
  return [...html.matchAll(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi)]
    .filter((match) => /<svg\b/i.test(match[0]));
}

function sectionErrors(spine) {
  const errors = [];
  for (const match of spine.matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section>/gi)) {
    const [, attributes, inner] = match;
    const heading = inner.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i);
    if (heading === null) {
      continue;
    }
    const exemption = attributes.match(/\bdata-figure-exempt\s*=\s*(["'])(.*?)\1/i);
    if (exemption !== null && exemption[2].trim() !== "") {
      continue;
    }
    const hasFigure = figuresWithSvg(inner).length > 0 || /\bdata-visual-role\s*=/i.test(inner);
    if (!hasFigure) {
      errors.push({
        code: "section_without_figure",
        message: "Open this section with a figure: an inline SVG diagram or a marked visual. If the section is a form or a source list, mark it data-figure-exempt with the reason.",
        excerpt: plainText(heading[1]),
      });
    }
  }
  return errors;
}

function captionErrors(spine, budget) {
  return [...spine.matchAll(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/gi)]
    .map((match) => {
      // Evidence tags and status chips label the caption; they are not sentences.
      const withoutTags = match[1].replace(/<span\b[^>]*\bclass\s*=\s*(["'])[^"']*\b(?:tag|status)\b[^"']*\1[^>]*>[\s\S]*?<\/span>/gi, " ");
      const text = plainText(withoutTags);
      return { text, sentences: countSentences(text) };
    })
    .filter(({ sentences }) => sentences > budget.maxCaptionSentences)
    .map(({ text, sentences }) => ({
      code: "caption_too_long",
      message: `Cut the caption to ${budget.maxCaptionSentences} sentences: what the figure shows, then why it matters. Move the rest into an expander.`,
      sentences,
      excerpt: text,
    }));
}

function paragraphErrors(spine, budget) {
  return [...spine.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => plainText(match[1]))
    .map((text) => ({ text, words: countWords(text) }))
    .filter(({ words }) => words > budget.maxParagraphWords)
    .map(({ text, words }) => ({
      code: "paragraph_too_long",
      message: `Shorten the visible paragraph to ${budget.maxParagraphWords} words or fewer, or draw the relationship it describes.`,
      words,
      excerpt: text,
    }));
}

export function checkPageBudget(html, overrides = {}) {
  if (typeof html !== "string" || html.trim() === "") {
    throw new Error("checkPageBudget needs the page HTML as a non-empty string");
  }
  const budget = { ...pageBudget, ...overrides };
  const spine = visibleSpine(html);
  const figureCount = figuresWithSvg(spine).length;
  const visibleWords = countWords(plainText(removeElements(spine, "svg")));

  const readingWords = readingWordCount(html);

  const errors = [...leftoverKitErrors(html)];
  if (figureCount < budget.minFigures) {
    errors.push({
      code: "missing_figure",
      message: "Lead with at least one inline SVG figure that shows the mechanism the page explains.",
    });
  }
  errors.push(...sectionErrors(spine));
  errors.push(...captionErrors(spine, budget));
  errors.push(...paragraphErrors(spine, budget));
  if (visibleWords > budget.maxVisibleWords) {
    errors.push({
      code: "too_many_visible_words",
      message: `The page shows ${visibleWords} words before any expander is opened; the ceiling is ${budget.maxVisibleWords}. Replace prose with a figure or move proof into expanders.`,
      words: visibleWords,
    });
  }
  return { ok: errors.length === 0, visibleWords, readingWords, figureCount, budget, errors };
}

const isMain = process.argv[1] !== undefined
  && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  const [inputPath, ...extra] = process.argv.slice(2);
  if (inputPath === undefined || extra.length > 0) {
    throw new Error("Usage: node page-budget-check.mjs <page.html>");
  }
  const result = checkPageBudget(fs.readFileSync(inputPath, "utf8"));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.ok ? 0 : 1;
}
