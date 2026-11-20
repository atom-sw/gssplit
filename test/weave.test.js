const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPdfpc } = require('../src/Pdfpc.js');
const { slideNumbers, labelRanges, weavePdfpc, checkPdfpc, wrapNote } = require('../tools/weave.js');
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

test('wrapNote breaks long lines at spaces to fit the width', async (t) => {
  const WIDTH = 20;
  const cases = [
    { label: 'a short line stays', note: 'Fits in one line', expected: 'Fits in one line' },
    {
      label: 'a long line breaks at spaces',
      note: 'For now, we are using the pdfpc format',
      expected: 'For now, we are\nusing the pdfpc\nformat',
    },
    { label: 'empty lines stay', note: 'First\n\nSecond', expected: 'First\n\nSecond' },
    {
      label: 'a list item continues under its text',
      note: '- For now, we are using the pdfpc format',
      expected: '- For now, we are\n  using the pdfpc\n  format',
    },
    {
      label: 'a numbered nested item keeps its indentation',
      note: '  12. Explain the first step in detail',
      expected: '  12. Explain the\n      first step in\n      detail',
    },
    {
      label: 'an indented plain line keeps its indentation',
      note: '    Indented text that is long',
      expected: '    Indented text\n    that is long',
    },
    {
      label: 'a word longer than the width stays whole',
      note: 'See https://example.com/a/very/long/path now',
      expected: 'See\nhttps://example.com/a/very/long/path\nnow',
    },
    {
      label: 'a dash inside a sentence is not a list',
      note: 'Note - this is a long sentence',
      expected: 'Note - this is a\nlong sentence',
    },
  ];
  for (const { label, note, expected } of cases) {
    await t.test(label, () => {
      assert.equal(wrapNote(note, WIDTH), expected);
    });
  }
});

test('wrapNote is stable: wrapping twice with the same width changes nothing', () => {
  const WIDTH = 24;
  const note = 'GSsplit can export notes too:\n- For now, we are using the .pdfpc format\n- But we might be able to embed them in PDFs too in the future\n\nWhat happens with a larger font size?';

  const once = wrapNote(note, WIDTH);

  assert.equal(wrapNote(once, WIDTH), once);
  assert.ok(once.split('\n').every((line) => line.length <= WIDTH));
});
