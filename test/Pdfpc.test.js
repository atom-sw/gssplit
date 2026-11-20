const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPdfpc, formatNote } = require('../src/Pdfpc.js');
const { loadLikePdfpc, pageNumberLabels } = require('./helpers/pdfpc.js');

// Keys that the pdfpc JSON schema allows (https://pdfpc.github.io/schema/pdfpc/2), whose
// `additionalProperties` is false at both levels.
const SCHEMA_TOP_KEYS = [
  'pdfpcFormat', 'duration', 'startTime', 'endTime', 'endSlide', 'savedSlide', 'lastMinutes',
  'disableMarkdown', 'noteFontSize', 'defaultTransition', 'beamerNotePosition', 'pages',
];
const SCHEMA_PAGE_KEYS = ['idx', 'label', 'overlay', 'forcedOverlay', 'hidden', 'note'];

/** Expands {slide, steps, note} slides into the per-page input of buildPdfpc. */
function pagesOf(slides) {
  return slides.flatMap(({ slide, steps, note = '' }) =>
    Array.from({ length: steps }, () => ({ slide, note })),
  );
}

test('buildPdfpc writes the pdfpc JSON format, version 2, with plain-text notes', () => {
  const result = buildPdfpc(pagesOf([{ slide: 1, steps: 1 }]));

  assert.equal(result.pdfpcFormat, 2);
  assert.equal(result.disableMarkdown, true);
});

test('buildPdfpc labels each page with its page number', () => {
  const result = buildPdfpc(pagesOf([{ slide: 1, steps: 2 }, { slide: 2, steps: 1 }]));

  assert.deepEqual(
    result.pages.map(({ idx, label, overlay }) => [idx, label, overlay]),
    [[0, '1', 0], [1, '2', 0], [2, '3', 0]],
  );
});

test('buildPdfpc marks the later steps of a slide as forced overlays', async (t) => {
  const cases = [
    { label: 'no pages', slides: [], expected: [] },
    { label: 'one page per slide', slides: [{ slide: 1, steps: 1 }, { slide: 2, steps: 1 }], expected: [false, false] },
    { label: 'steps of one slide', slides: [{ slide: 1, steps: 3 }], expected: [false, true, true] },
    {
      label: 'each slide starts a new group',
      slides: [{ slide: 1, steps: 2 }, { slide: 2, steps: 1 }, { slide: 3, steps: 3 }],
      expected: [false, true, false, false, true, true],
    },
  ];
  for (const { label, slides, expected } of cases) {
    await t.test(label, () => {
      const result = buildPdfpc(pagesOf(slides));

      assert.deepEqual(result.pages.map((page) => page.forcedOverlay === true), expected);
    });
  }
});

test('buildPdfpc repeats a slide note on every step page', () => {
  const NOTE = 'Explain A first.\nThen *B* and #C.';
  const STEPS = 3;

  const result = buildPdfpc(pagesOf([{ slide: 2, steps: STEPS, note: NOTE }]));

  assert.deepEqual(result.pages.map((page) => page.note), Array(STEPS).fill(NOTE));
});

test('buildPdfpc lists pages without notes but omits their note key', async (t) => {
  for (const note of ['', '  \n ']) {
    await t.test(JSON.stringify(note), () => {
      const result = buildPdfpc(pagesOf([{ slide: 1, steps: 2, note }]));

      assert.equal(result.pages.length, 2);
      result.pages.forEach((page) => assert.equal('note' in page, false));
    });
  }
});

test('buildPdfpc uses only keys of the pdfpc schema', () => {
  const result = buildPdfpc(pagesOf([{ slide: 1, steps: 2, note: 'Note' }, { slide: 2, steps: 1 }]));

  Object.keys(result).forEach((key) => assert.ok(SCHEMA_TOP_KEYS.includes(key), key));
  result.pages.forEach((page) =>
    Object.keys(page).forEach((key) => assert.ok(SCHEMA_PAGE_KEYS.includes(key), key)),
  );
});

test('pdfpc shows each note on every step page of its slide, for the test deck', () => {
  // Pages per kept slide of the exported test deck (slide 7 is skipped), with notes on slides
  // 2 to 4, as in the live test that first exposed the label mismatch.
  const STEPS_BY_SLIDE = [1, 2, 4, 5, 4, 1];
  const NOTES = { 2: 'Notes of slide 2', 3: 'Notes of slide 3', 4: 'Notes of slide 4' };
  const slides = STEPS_BY_SLIDE.map((steps, index) => ({
    slide: index + 1,
    steps,
    note: NOTES[index + 1] || '',
  }));
  const pages = pagesOf(slides);

  const shown = loadLikePdfpc(buildPdfpc(pages), pageNumberLabels(pages.length));

  assert.deepEqual(shown.notes, pages.map((page) => page.note || null));
  assert.equal(shown.userSlides, STEPS_BY_SLIDE.length);
});

test('formatNote turns note paragraphs into readable plain text', async (t) => {
  const plain = (text) => ({ text, glyph: null, nestingLevel: 0 });
  const item = (text, glyph, nestingLevel = 0) => ({ text, glyph, nestingLevel });
  const INTRO = 'GSsplit can export notes too:';
  const FIRST = 'For now, we use the .pdfpc format';
  const SECOND = 'Later, the notes may go into the PDF';
  const DISC = '●';
  const CIRCLE = '○';
  const cases = [
    { label: 'no paragraphs', paragraphs: [], expected: '' },
    { label: 'plain lines stay as they are', paragraphs: [plain(INTRO), plain(FIRST)], expected: `${INTRO}\n${FIRST}` },
    {
      label: 'list items get their glyph',
      paragraphs: [plain(INTRO), item(FIRST, DISC), item(SECOND, DISC)],
      expected: `${INTRO}\n${DISC} ${FIRST}\n${DISC} ${SECOND}`,
    },
    {
      label: 'nested items are indented',
      paragraphs: [item(FIRST, DISC), item(SECOND, CIRCLE, 1)],
      expected: `${DISC} ${FIRST}\n  ${CIRCLE} ${SECOND}`,
    },
    { label: 'numbered items keep their number', paragraphs: [item(FIRST, '1.'), item(SECOND, '2.')], expected: `1. ${FIRST}\n2. ${SECOND}` },
    { label: 'trailing empty lines are dropped', paragraphs: [plain(INTRO), plain(''), plain('')], expected: INTRO },
    { label: 'empty lines inside the note stay', paragraphs: [plain(INTRO), plain(''), plain(FIRST)], expected: `${INTRO}\n\n${FIRST}` },
  ];
  for (const { label, paragraphs, expected } of cases) {
    await t.test(label, () => {
      assert.equal(formatNote(paragraphs), expected);
    });
  }
});
