const test = require('node:test');
const assert = require('node:assert/strict');
const { blankText, paragraphBlankRequests } = require('../src/TextBlanking.js');

test('blankText keeps the length and the line structure', async (t) => {
  const SOFT_BREAK = '\u000b';
  const TAB = '\t';
  const WORDS = 'Item 1';
  const cases = [
    { label: 'plain words', input: WORDS, expected: ' '.repeat(WORDS.length) },
    { label: 'soft line break stays', input: `ab${SOFT_BREAK}c`, expected: `  ${SOFT_BREAK} ` },
    { label: 'tab stays', input: `a${TAB}b`, expected: ` ${TAB} ` },
    { label: 'empty text', input: '', expected: '' },
  ];
  for (const { label, input, expected } of cases) {
    await t.test(label, () => {
      assert.equal(blankText(input), expected);
    });
  }
});

const OBJECT_ID = 'shape';
const FONT_SIZE = 18;
const LINE_SPACING = 115;

/** Lays out paragraphs the way Slides indexes them: each one followed by a newline. */
function layout(texts, overrides = {}) {
  let start = 0;
  return texts.map((text) => {
    const paragraph = {
      start,
      text,
      inList: true,
      collapsesSpacing: true,
      fontSize: FONT_SIZE,
      lineSpacing: LINE_SPACING,
      ...overrides,
    };
    start += text.length + 1;
    return paragraph;
  });
}

const kinds = (requests) => requests.map((request) => Object.keys(request)[0]);
const ofKind = (requests, kind) => requests.filter((request) => kind in request).map((r) => r[kind]);

test('paragraphBlankRequests', async (t) => {
  const ITEMS = ['Item 1', 'Item 2', 'Item 3'];

  await t.test('nothing hidden gives no requests', () => {
    assert.deepEqual(paragraphBlankRequests(OBJECT_ID, layout(ITEMS), []), []);
  });

  await t.test('replaces a hidden paragraph with blanks of the same length', () => {
    const paragraphs = layout(ITEMS);
    const hidden = paragraphs[2];

    const requests = paragraphBlankRequests(OBJECT_ID, paragraphs, [2]);

    const [deletion] = ofKind(requests, 'deleteText');
    const [insertion] = ofKind(requests, 'insertText');
    assert.deepEqual(deletion.textRange, {
      type: 'FIXED_RANGE',
      startIndex: hidden.start,
      endIndex: hidden.start + hidden.text.length,
    });
    assert.equal(insertion.insertionIndex, hidden.start);
    assert.equal(insertion.text, blankText(hidden.text));
  });

  await t.test('removes the bullet and restores the font size and line spacing', () => {
    const requests = paragraphBlankRequests(OBJECT_ID, layout(ITEMS), [1]);

    assert.equal(ofKind(requests, 'deleteParagraphBullets').length, 1);
    const [textStyle] = ofKind(requests, 'updateTextStyle');
    assert.equal(textStyle.style.fontSize.magnitude, FONT_SIZE);
    const lineSpacing = ofKind(requests, 'updateParagraphStyle').find((r) => r.fields === 'lineSpacing');
    assert.equal(lineSpacing.style.lineSpacing, LINE_SPACING);
  });

  await t.test('pins spacing to 0 only between consecutive collapsing list items', () => {
    const requests = paragraphBlankRequests(OBJECT_ID, layout(ITEMS), [2]);

    const pins = ofKind(requests, 'updateParagraphStyle')
      .filter((r) => r.fields !== 'lineSpacing')
      .map((r) => r.fields);
    assert.deepEqual(pins, ['spaceBelow', 'spaceAbove,spaceBelow', 'spaceAbove']);
  });

  await t.test('leaves spacing alone outside COLLAPSE_LISTS', () => {
    const requests = paragraphBlankRequests(
      OBJECT_ID,
      layout(ITEMS, { collapsesSpacing: false }),
      [2],
    );

    const pins = ofKind(requests, 'updateParagraphStyle').filter((r) => r.fields !== 'lineSpacing');
    assert.deepEqual(pins, []);
  });

  await t.test('a plain paragraph only gets its text blanked', () => {
    const paragraphs = layout(ITEMS, { inList: false, collapsesSpacing: false });

    assert.deepEqual(kinds(paragraphBlankRequests(OBJECT_ID, paragraphs, [0])), [
      'deleteText',
      'insertText',
    ]);
  });

  await t.test('an empty paragraph gets no text requests', () => {
    const paragraphs = layout(['', ...ITEMS], { inList: false, collapsesSpacing: false });

    assert.deepEqual(paragraphBlankRequests(OBJECT_ID, paragraphs, [0]), []);
  });
});
