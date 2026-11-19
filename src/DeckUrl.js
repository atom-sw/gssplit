/**
 * Pure: reads the presentation ID from what the user types in the dialog's deck field.
 *
 * The field accepts a Google Slides URL in any of its usual forms (…/edit, …/edit#slide=…,
 * …/present, with /u/0/ in the path) or a bare presentation ID. The result is validated, so
 * only a well-formed ID ever reaches SlidesApp and the export URL.
 */

const DECK_ID_PATTERN = /^[A-Za-z0-9_-]{20,}$/;
const DECK_URL_PATTERN = /^https:\/\/docs\.google\.com\/presentation\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]+)/;

/**
 * Returns the presentation ID in `input`, or null when `input` is empty (meaning: the open
 * deck). Throws when `input` is neither a Google Slides URL nor a presentation ID.
 */
function parseDeckId(input) {
  const text = (input || '').trim();
  if (text === '') return null;
  const urlMatch = DECK_URL_PATTERN.exec(text);
  const id = urlMatch ? urlMatch[1] : text;
  if (!DECK_ID_PATTERN.test(id)) {
    throw new Error('This is not the URL of a Google Slides deck: copy the URL from the address bar of the deck');
  }
  return id;
}

if (typeof module !== 'undefined') {
  module.exports = { parseDeckId };
}
