const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPages, isFullPage } = require('../src/StepModel.js');
const { animationGroups } = require('../src/PptxTiming.js');
const { loadPart, slidePath } = require('./helpers/fixture.js');

const SHAPE_A = '1';
const SHAPE_B = '2';
const TEXT = '3';

const entrance = (spid, paragraphs = null) => ({ spid, effectClass: 'entr', paragraphs });
const exit = (spid, paragraphs = null) => ({ spid, effectClass: 'exit', paragraphs });
const emphasis = (spid) => ({ spid, effectClass: 'emph', paragraphs: null });
const onClick = (...effects) => ({ onClick: true, effects });
const automatic = (...effects) => ({ onClick: false, effects });
const page = (hiddenShapes = [], hiddenParagraphs = {}) => ({ hiddenShapes, hiddenParagraphs });

test('buildPages turns animation groups into pages', async (t) => {
  const cases = [
    { label: 'no animations gives one full page', groups: [], pages: [page()] },
    {
      label: 'an entrance hides the element until its click',
      groups: [onClick(entrance(SHAPE_A))],
      pages: [page([SHAPE_A]), page()],
    },
    {
      label: 'an exit shows the element until its click',
      groups: [onClick(exit(SHAPE_A))],
      pages: [page(), page([SHAPE_A])],
    },
    {
      label: 'an element can enter and then exit',
      groups: [onClick(entrance(SHAPE_A)), onClick(exit(SHAPE_A))],
      pages: [page([SHAPE_A]), page(), page([SHAPE_A])],
    },
    {
      label: 'an automatic first group joins the initial page',
      groups: [automatic(entrance(SHAPE_A)), onClick(entrance(SHAPE_B))],
      pages: [page([SHAPE_B]), page()],
    },
    {
      label: 'an automatic later group joins the page of the click before it',
      groups: [onClick(entrance(SHAPE_A)), automatic(entrance(SHAPE_B))],
      pages: [page([SHAPE_A, SHAPE_B]), page()],
    },
    {
      label: 'a click with only emphasis adds no page',
      groups: [onClick(emphasis(SHAPE_A)), onClick(entrance(SHAPE_B))],
      pages: [page([SHAPE_B]), page()],
    },
    {
      label: 'paragraph ranges hide paragraphs, not the element',
      groups: [onClick(entrance(TEXT, { first: 0, last: 1 })), onClick(entrance(TEXT, { first: 2, last: 2 }))],
      pages: [page([], { [TEXT]: [0, 1, 2] }), page([], { [TEXT]: [2] }), page()],
    },
  ];
  for (const { label, groups, pages } of cases) {
    await t.test(label, () => {
      assert.deepEqual(buildPages(groups), pages);
    });
  }
});

test('buildPages on the exported test deck', async (t) => {
  const cases = [
    { slide: 1, pages: [page()] },
    { slide: 2, pages: [page(['60', '61', '62']), page()] },
    { slide: 3, pages: [page(['67']), page(), page(['67']), page(['67', '68'])] },
    {
      slide: 4,
      pages: [[0, 1, 2, 3], [1, 2, 3], [2, 3], [3]]
        .map((hidden) => page([], { 74: hidden }))
        .concat([page()]),
    },
    { slide: 5, pages: [page(['79', '82']), page(['82']), page(), page(['79'])] },
    { slide: 6, pages: [page()] },
  ];
  for (const { slide, pages } of cases) {
    await t.test(`slide ${slide}`, () => {
      assert.deepEqual(buildPages(animationGroups(loadPart(slidePath(slide)))), pages);
    });
  }
});

test('isFullPage is true only when nothing is hidden', async (t) => {
  const cases = [
    { label: 'nothing hidden', input: page(), expected: true },
    { label: 'a hidden shape', input: page([SHAPE_A]), expected: false },
    { label: 'a hidden paragraph', input: page([], { [TEXT]: [0] }), expected: false },
  ];
  for (const { label, input, expected } of cases) {
    await t.test(label, () => {
      assert.equal(isFullPage(input), expected);
    });
  }
});
