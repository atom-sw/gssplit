/**
 * Pure: builds the `.pdfpc` file that carries speaker notes to PDF presenter tools.
 *
 * pdfpc (4.5 and later) reads `<name>.pdfpc` next to `<name>.pdf`: JSON in the format
 * https://pdfpc.github.io/schema/pdfpc/2. Three facts from pdfpc's source (pdf.vala, 4.6) shape
 * this file:
 * - pdfpc attaches each entry to the PDF page whose own page label equals the entry's `label`,
 *   and falls back to `idx` only when no page matches. Google's PDF has no /PageLabels, so its
 *   labels are the page numbers "1", "2", ...: each entry must use its page number as label.
 * - A note belongs to one page, so a slide's note repeats on every step page made from it.
 * - pdfpc groups pages into one slide when their labels are equal, or when a page carries
 *   `forcedOverlay` (what pdfpc saves for Ctrl+o). With page-number labels, `forcedOverlay` on
 *   each later step page keeps pdfpc's slide counter at the number of original slides.
 */

const PDFPC_FORMAT = 2;

/**
 * Returns the `.pdfpc` content for the PDF pages, in order.
 *
 * @param pages one entry per PDF page: {slide, note}. `slide` is the number of the original
 *     slide; consecutive pages with the same slide are its steps. `note` is the slide's speaker
 *     notes, or '' for none.
 */
function buildPdfpc(pages) {
  return {
    pdfpcFormat: PDFPC_FORMAT,
    // Google Slides notes are plain text: `*`, `_`, and `#` must not turn into formatting.
    disableMarkdown: true,
    pages: pages.map((page, idx) => {
      const entry = { idx, label: String(idx + 1), overlay: 0 };
      if (idx > 0 && pages[idx - 1].slide === page.slide) entry.forcedOverlay = true;
      if (page.note.trim() !== '') entry.note = page.note;
      return entry;
    }),
  };
}

/**
 * Returns a note as plain text, keeping its lists readable: the plain text of a Google Slides
 * text box has no bullets, so each list item gets the glyph that Slides shows (●, ○, 1., ...),
 * indented two spaces per nesting level. Trailing empty lines are dropped.
 *
 * @param paragraphs the note's paragraphs, in order: {text, glyph, nestingLevel}. `text`
 *     excludes the paragraph's newline; `glyph` is null for a paragraph that is not in a list.
 */
function formatNote(paragraphs) {
  return paragraphs
    .map(({ text, glyph, nestingLevel }) =>
      glyph ? `${'  '.repeat(nestingLevel)}${glyph} ${text}` : text,
    )
    .join('\n')
    .replace(/\s+$/, '');
}

if (typeof module !== 'undefined') {
  module.exports = { buildPdfpc, formatNote };
}
