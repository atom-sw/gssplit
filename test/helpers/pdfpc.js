// Replays how pdfpc 4.6 loads a `.pdfpc` file (parse_pdfpc_page and the user-slide grouping
// loop in src/classes/metadata/pdf.vala), so tests can check what pdfpc really shows.

/** The page labels of a PDF without /PageLabels: its page numbers. */
function pageNumberLabels(pageCount) {
  return Array.from({ length: pageCount }, (_, index) => String(index + 1));
}

/**
 * Returns the note that pdfpc shows on each page, and its number of user slides.
 *
 * @param pdfpc the `.pdfpc` content
 * @param pdfLabels the PDF's own page labels, one per page
 */
function loadLikePdfpc(pdfpc, pdfLabels) {
  const notes = Array(pdfLabels.length).fill(null);
  const forced = Array(pdfLabels.length).fill(false);
  pdfpc.pages.forEach(({ idx, label, overlay, forcedOverlay, note }) => {
    // "Try to lookup the page by label; if fails, use the page index".
    const first = pdfLabels.indexOf(label);
    let page = first === -1 ? idx : first + overlay;
    if (pdfLabels[page] !== label) page = idx;
    if (forcedOverlay && page > 0) forced[page] = true;
    if (note) notes[page] = note;
  });
  // A new user slide starts where the label changes, unless the page is a forced overlay.
  let userSlides = 0;
  pdfLabels.forEach((label, index) => {
    if ((index === 0 || label !== pdfLabels[index - 1]) && !forced[index]) userSlides += 1;
  });
  return { notes, userSlides };
}

module.exports = { loadLikePdfpc, pageNumberLabels };
