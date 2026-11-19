const test = require('node:test');
const assert = require('node:assert/strict');
const { slidePartPaths, shapeIdsInOrder, animationGroups } = require('../src/PptxTiming.js');
const { loadPart, slidePath } = require('./helpers/fixture.js');

// The test deck has 7 slides; see the table in each case for what each one animates.
const SLIDE_COUNT = 7;

test('slidePartPaths lists the slide parts in deck order', () => {
  const paths = slidePartPaths(
    loadPart('ppt/presentation.xml'),
    loadPart('ppt/_rels/presentation.xml.rels'),
  );

  const expected = Array.from({ length: SLIDE_COUNT }, (_, index) => slidePath(index + 1));
  assert.deepEqual(paths, expected);
});

test('shapeIdsInOrder walks elements in pre-order', async (t) => {
  const cases = [
    { label: 'title slide with placeholders', slide: 1, ids: ['54', '55'] },
    { label: 'three plain shapes', slide: 2, ids: ['60', '61', '62'] },
    { label: 'group before its children, then a table', slide: 5, ids: ['79', '80', '81', '82'] },
  ];
  for (const { label, slide, ids } of cases) {
    await t.test(label, () => {
      assert.deepEqual(shapeIdsInOrder(loadPart(slidePath(slide))), ids);
    });
  }
});

test('animationGroups reads the main sequence', async (t) => {
  const effect = (spid, effectClass, paragraphs = null) => ({ spid, effectClass, paragraphs });
  const onClick = (...effects) => ({ onClick: true, effects });
  const paragraph = (index) => ({ first: index, last: index });
  const cases = [
    { label: 'no animations', slide: 1, groups: [] },
    {
      label: 'with previous and after previous join the click',
      slide: 2,
      groups: [onClick(effect('60', 'entr'), effect('61', 'entr'), effect('62', 'entr'))],
    },
    {
      label: 'entrance then exit of one shape',
      slide: 3,
      groups: [onClick(effect('67', 'entr')), onClick(effect('67', 'exit')), onClick(effect('68', 'exit'))],
    },
    {
      label: 'by paragraph',
      slide: 4,
      groups: [0, 1, 2, 3].map((index) => onClick(effect('74', 'entr', paragraph(index)))),
    },
    {
      label: 'group and table',
      slide: 5,
      groups: [onClick(effect('79', 'entr')), onClick(effect('82', 'entr')), onClick(effect('79', 'exit'))],
    },
    { label: 'emphasis', slide: 6, groups: [onClick(effect('87', 'emph'))] },
    { label: 'skipped slide (export drops its timing)', slide: 7, groups: [] },
  ];
  for (const { label, slide, groups } of cases) {
    await t.test(label, () => {
      assert.deepEqual(animationGroups(loadPart(slidePath(slide))), groups);
    });
  }
});
