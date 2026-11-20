const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPdfpc } = require('../src/Pdfpc.js');
const { slideNumbers, labelRanges, weavePdfpc, checkPdfpc } = require('../tools/weave.js');
const { loadLikePdfpc } = require('./helpers/pdfpc.js');

// Pages per kept slide of the exported test deck (slide 7 is skipped), and its notes.
const STEPS_BY_SLIDE = [1, 2, 4, 5, 4, 1];
const NOTES = { 2: 'Notes of slide 2', 3: 'Notes of slide 3', 4: 'Notes of slide 4' };

/** The .pdfpc that GSsplit exports for the test deck. */
function exportedPdfpc() {
  const pages = STEPS_BY_SLIDE.flatMap((steps, index) =>
    Array.from({ length: steps }, () => ({ slide: index + 1, note: NOTES[index + 1] || '' })),
  );
  return buildPdfpc(pages);
}

/** The slide number of each page of the test deck, as the PDF orders them. */
const EXPECTED_SLIDES = STEPS_BY_SLIDE.flatMap((steps, index) => Array(steps).fill(index + 1));

test('slideNumbers reads the slides of both forms of the file', async (t) => {
  const exported = exportedPdfpc();
  const cases = [
    { label: 'as GSsplit exports it', pdfpc: exported },
    { label: 'as weavePdfpc rewrites it', pdfpc: weavePdfpc(exported, EXPECTED_SLIDES) },
  ];
  for (const { label, pdfpc } of cases) {
    await t.test(label, () => {
      assert.deepEqual(slideNumbers(pdfpc), EXPECTED_SLIDES);
    });
  }
});

test('labelRanges starts one prefix-only range per slide', () => {
  const ranges = labelRanges([1, 2, 2, 3, 3, 3]);

  assert.deepEqual(ranges, [
    { startIndex: 0, label: '1' },
    { startIndex: 1, label: '2' },
    { startIndex: 3, label: '3' },
  ]);
});

test('weavePdfpc labels pages by slide and counts their steps', () => {
  const woven = weavePdfpc(exportedPdfpc(), EXPECTED_SLIDES);

  const slide4 = woven.pages.filter((page) => page.label === '4');
  assert.deepEqual(slide4.map((page) => page.overlay), [0, 1, 2, 3, 4]);
  assert.ok(slide4.every((page) => page.note === NOTES[4]));
  assert.ok(woven.pages.every((page) => !('forcedOverlay' in page)));
});

test('weaving twice gives the same file', () => {
  const once = weavePdfpc(exportedPdfpc(), EXPECTED_SLIDES);

  const twice = weavePdfpc(once, slideNumbers(once));

  assert.deepEqual(twice, once);
});

test('pdfpc shows each note on every step page of the woven PDF', () => {
  const woven = weavePdfpc(exportedPdfpc(), EXPECTED_SLIDES);
  // The woven PDF's own labels: every page carries the label of its slide.
  const pdfLabels = EXPECTED_SLIDES.map(String);

  const shown = loadLikePdfpc(woven, pdfLabels);

  assert.deepEqual(shown.notes, EXPECTED_SLIDES.map((slide) => NOTES[slide] || null));
  assert.equal(shown.userSlides, STEPS_BY_SLIDE.length);
});

test('checkPdfpc rejects files that do not fit the PDF', async (t) => {
  const exported = exportedPdfpc();
  const pageCount = exported.pages.length;
  const cases = [
    { label: 'not a pdfpc file', pdfpc: { pages: [] }, pages: 0, error: /not a \.pdfpc file in format 2/ },
    { label: 'another page count', pdfpc: exported, pages: pageCount + 1, error: /lists \d+ pages, but the PDF has/ },
    {
      label: 'pages out of order',
      pdfpc: { ...exported, pages: [...exported.pages].reverse() },
      pages: pageCount,
      error: /lists page \d+ at position 0/,
    },
  ];
  for (const { label, pdfpc, pages, error } of cases) {
    await t.test(label, () => {
      assert.throws(() => checkPdfpc(pdfpc, pages), error);
    });
  }

  await t.test('accepts the matching export', () => {
    assert.doesNotThrow(() => checkPdfpc(exported, pageCount));
  });
});
