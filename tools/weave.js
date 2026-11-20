/**
 * Pure: plans how to weave the notes of a GSsplit `.pdfpc` file into its PDF.
 *
 * pympress reads speaker notes only from inside the PDF, as hidden /Text annotations, and the
 * Google Apps Script add-on cannot write those. tools/gssplit-notes.js applies this plan
 * locally with pdf-lib. The plan has three parts:
 * - one hidden note annotation on every page that has a note;
 * - /PageLabels that give all pages of a slide the same label, so pdfpc, pympress, and
 *   BeamerPresenter group the steps of a slide;
 * - a rewritten `.pdfpc` whose labels match those page labels: pdfpc attaches each entry to the
 *   page whose own label equals the entry's label (see DESIGN.md).
 */

/**
 * Returns the slide number (1-based, in PDF order) of each page.
 *
 * Reads both forms of the file: as GSsplit exports it (each page labeled with its page number,
 * later steps marked with forcedOverlay), and as weavePdfpc rewrites it (all steps of a slide
 * share one label). A page continues the previous slide if it is a forced overlay or has the
 * previous page's label.
 */
function slideNumbers(pdfpc) {
  let slide = 0;
  return pdfpc.pages.map((page, index) => {
    const continues =
      index > 0 && (page.forcedOverlay === true || page.label === pdfpc.pages[index - 1].label);
    if (!continues) slide += 1;
    return slide;
  });
}

/**
 * Returns the /PageLabels ranges: one {startIndex, label} per slide, starting at the slide's
 * first page. Every page of a range gets the same label, because the range has a prefix and no
 * numbering style.
 */
function labelRanges(slides) {
  return slides
    .map((slide, index) => ({ startIndex: index, label: String(slide) }))
    .filter((range, index) => index === 0 || slides[index - 1] !== slides[index]);
}

/**
 * Returns the `.pdfpc` content that matches the woven PDF: every page labeled with its slide,
 * and `overlay` counting the steps within the slide. Notes stay in the file for tools that do
 * not read annotations, such as BeamerPresenter.
 */
function weavePdfpc(pdfpc, slides) {
  let overlay = 0;
  return {
    ...pdfpc,
    pages: pdfpc.pages.map((page, index) => {
      overlay = index > 0 && slides[index - 1] === slides[index] ? overlay + 1 : 0;
      const entry = { idx: page.idx, label: String(slides[index]), overlay };
      if (page.note) entry.note = page.note;
      return entry;
    }),
  };
}

/**
 * Checks that a `.pdfpc` file can be woven into a PDF of `pageCount` pages: it must list every
 * page, in order. Throws with a message for the user otherwise.
 */
function checkPdfpc(pdfpc, pageCount) {
  if (!pdfpc || pdfpc.pdfpcFormat !== 2 || !Array.isArray(pdfpc.pages)) {
    throw new Error('This is not a .pdfpc file in format 2: export it again with GSsplit');
  }
  if (pdfpc.pages.length !== pageCount) {
    throw new Error(
      `The .pdfpc file lists ${pdfpc.pages.length} pages, but the PDF has ${pageCount}: ` +
        'use the two files of the same GSsplit export',
    );
  }
  pdfpc.pages.forEach((page, index) => {
    if (page.idx !== index) throw new Error(`The .pdfpc file lists page ${page.idx} at position ${index}`);
  });
}

module.exports = { slideNumbers, labelRanges, weavePdfpc, checkPdfpc };
