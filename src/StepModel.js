/**
 * Pure model: turns a slide's animation groups into the pages of the split deck.
 *
 * Each page shows the slide as it looks after a given number of clicks, with every effect in
 * its final state (like PPspliT: no intermediate frames). Only entrance and exit effects
 * change what is visible; emphasis effects such as Spin are ignored.
 *
 * A page is {hiddenShapes, hiddenParagraphs}: `hiddenShapes` lists the shape IDs to remove,
 * and `hiddenParagraphs` maps a shape ID to the sorted paragraph indexes to blank out in it.
 */

const STEP_ENTRANCE = 'entr';
const STEP_EXIT = 'exit';

/** Expands an effect into visibility keys: `spid` for a whole element, `spid:index` per paragraph. */
function stepKeys_(effect) {
  if (!effect.paragraphs) return [effect.spid];
  const keys = [];
  for (let index = effect.paragraphs.first; index <= effect.paragraphs.last; index += 1) {
    keys.push(`${effect.spid}:${index}`);
  }
  return keys;
}

function stepSnapshot_(hidden) {
  const hiddenShapes = [];
  const hiddenParagraphs = {};
  Object.keys(hidden)
    .filter((key) => hidden[key])
    .forEach((key) => {
      const [spid, paragraph] = key.split(':');
      if (paragraph === undefined) {
        hiddenShapes.push(spid);
      } else {
        (hiddenParagraphs[spid] = hiddenParagraphs[spid] || []).push(Number(paragraph));
      }
    });
  hiddenShapes.sort((a, b) => Number(a) - Number(b));
  Object.values(hiddenParagraphs).forEach((indexes) => indexes.sort((a, b) => a - b));
  return { hiddenShapes, hiddenParagraphs };
}

/**
 * Returns the pages for one slide: one page for the state before the first click, then one
 * per click. A group that starts on its own joins the page before it. Consecutive identical
 * pages collapse into one, so a click that only runs emphasis effects adds no page.
 */
function buildPages(groups) {
  const effects = [];
  groups.forEach((group) => {
    group.effects
      .filter((effect) => effect.effectClass === STEP_ENTRANCE || effect.effectClass === STEP_EXIT)
      .forEach((effect) => effects.push(effect));
  });

  // An element whose first effect is an entrance starts hidden; any other starts visible.
  const hidden = {};
  effects.forEach((effect) => {
    stepKeys_(effect).forEach((key) => {
      if (!(key in hidden)) hidden[key] = effect.effectClass === STEP_ENTRANCE;
    });
  });

  const pages = [];
  groups.forEach((group) => {
    if (group.onClick) pages.push(stepSnapshot_(hidden));
    group.effects.forEach((effect) => {
      if (effect.effectClass !== STEP_ENTRANCE && effect.effectClass !== STEP_EXIT) return;
      stepKeys_(effect).forEach((key) => {
        hidden[key] = effect.effectClass === STEP_EXIT;
      });
    });
  });
  pages.push(stepSnapshot_(hidden));

  return pages.filter(
    (page, index) => index === 0 || JSON.stringify(page) !== JSON.stringify(pages[index - 1]),
  );
}

/** True when a page shows the slide unchanged. */
function isFullPage(page) {
  return page.hiddenShapes.length === 0 && Object.keys(page.hiddenParagraphs).length === 0;
}

if (typeof module !== 'undefined') {
  module.exports = { buildPages, isFullPage };
}
