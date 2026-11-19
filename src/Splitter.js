/**
 * Builds the split deck inside a new presentation (Apps Script only).
 *
 * The functions here edit only the new deck whose ID they receive. They read the slides of the
 * deck the user has open, but never change them.
 */

/** Returns a slide's page elements in pre-order (each group before its children). */
function flattenElements_(slide) {
  const elements = [];
  const walk = (list) => {
    list.forEach((element) => {
      elements.push(element);
      if (element.getPageElementType() === SlidesApp.PageElementType.GROUP) {
        walk(element.asGroup().getChildren());
      }
    });
  };
  walk(slide.getPageElements());
  return elements;
}

/** Returns a slide's slide-number fields, last first so replacing one keeps the others valid. */
function slideNumberFields_(slide) {
  const fields = [];
  flattenElements_(slide)
    .filter((element) => element.getPageElementType() === SlidesApp.PageElementType.SHAPE)
    .forEach((element) => {
      element
        .asShape()
        .getText()
        .getAutoTexts()
        .forEach((autoText) => {
          if (autoText.getAutoTextType() === SlidesApp.AutoTextType.SLIDE_NUMBER) fields.push(autoText);
        });
    });
  return fields.reverse();
}

/** Returns the number a slide of the original deck displays, or null when it shows none. */
function displayedSlideNumber_(slide) {
  const fields = slideNumberFields_(slide);
  return fields.length ? fields[0].getRange().asRenderedString() : null;
}

/**
 * Replaces each slide-number field on a slide with static text. Run it before duplicating, so
 * every page split from a slide shows that slide's number in the original deck.
 */
function freezeSlideNumbers_(slide, number) {
  if (number === null) return;
  slideNumberFields_(slide).forEach((field) => field.getRange().setText(number));
}

/**
 * Reads the paragraph layout of a text shape for TextBlanking.js: one batch of reads per
 * animated text box, taken before any page is edited, so no read waits on a pending write.
 */
function readParagraphs_(shape) {
  return shape
    .getText()
    .getParagraphs()
    .map((paragraph) => {
      const range = paragraph.getRange();
      const style = range.getParagraphStyle();
      const inList = range.getListStyle().isInList();
      return {
        start: range.getStartIndex(),
        text: range.asString().replace(/\n$/, ''),
        inList,
        collapsesSpacing: inList && style.getSpacingMode() === SlidesApp.SpacingMode.COLLAPSE_LISTS,
        fontSize: range.getTextStyle().getFontSize(),
        lineSpacing: style.getLineSpacing(),
      };
    });
}

/**
 * Removes the hidden elements of one page from a slide, and queues the Slides API requests
 * that blank its hidden paragraphs.
 */
function applyPage_(slide, page, indexBySpid, paragraphsBySpid, requests) {
  const elements = flattenElements_(slide);
  const removed = new Set(page.hiddenShapes);

  Object.keys(page.hiddenParagraphs).forEach((spid) => {
    if (removed.has(spid)) return;
    const objectId = elements[indexBySpid[spid]].getObjectId();
    requests.push(
      ...paragraphBlankRequests(objectId, paragraphsBySpid[spid], page.hiddenParagraphs[spid]),
    );
  });

  // Children come after their group in pre-order, so removing from the end never touches an
  // element whose group is already gone.
  page.hiddenShapes
    .map((spid) => indexBySpid[spid])
    .sort((a, b) => b - a)
    .forEach((index) => elements[index].remove());
}

/**
 * Fills the empty target deck with the split pages of the source slides. Skipped slides are
 * left out, and the blank slides the target started with are removed. Paragraph blanking goes
 * out last as a single Slides API batch, after SlidesApp has saved its own edits.
 *
 * @param targetId ID of the new, app-created deck to fill
 * @param sourceSlides the slides of the original deck, which are only read
 * @param plans one plan per source slide, in deck order: {pages, indexBySpid}
 */
function splitDeck_(targetId, sourceSlides, plans) {
  const deck = SlidesApp.openById(targetId);
  const blankSlides = deck.getSlides();
  const requests = [];

  sourceSlides.forEach((sourceSlide, slideIndex) => {
    if (sourceSlide.isSkipped()) return;
    const { pages, indexBySpid } = plans[slideIndex];
    const slide = deck.appendSlide(sourceSlide);
    freezeSlideNumbers_(slide, displayedSlideNumber_(sourceSlide));
    if (pages.length === 1 && isFullPage(pages[0])) return;

    const elementCount = flattenElements_(slide).length;
    if (elementCount !== Object.keys(indexBySpid).length) {
      throw new Error(`Slide ${slideIndex + 1}: copying the slide changed its elements`);
    }
    const sourceElements = flattenElements_(sourceSlide);
    const paragraphsBySpid = {};
    pages.forEach((page) => {
      Object.keys(page.hiddenParagraphs).forEach((spid) => {
        if (paragraphsBySpid[spid]) return;
        paragraphsBySpid[spid] = readParagraphs_(sourceElements[indexBySpid[spid]].asShape());
      });
    });

    // Duplicate first, while every copy still matches the original slide; edit afterwards.
    const copies = [slide];
    for (let page = 1; page < pages.length; page += 1) {
      copies.push(copies[copies.length - 1].duplicate());
    }
    copies.forEach((copy, page) =>
      applyPage_(copy, pages[page], indexBySpid, paragraphsBySpid, requests),
    );
  });

  blankSlides.forEach((slide) => slide.remove());
  deck.saveAndClose();
  if (requests.length > 0) Slides.Presentations.batchUpdate({ requests }, targetId);
}
