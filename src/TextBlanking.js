/**
 * Pure: builds the Slides API requests that blank out hidden paragraphs on one page.
 *
 * Hidden paragraphs are blanked instead of deleted: deleting would move the visible paragraphs
 * of a box that is not top-aligned, and the Slides API has no transparent text color. All
 * requests keep every text length, so the offsets read from the original slide stay valid on
 * every page and the requests can go out in one batch.
 *
 * A paragraph is {start, text, inList, collapsesSpacing, fontSize, lineSpacing}, as read from
 * the slide before duplication: `text` excludes the trailing newline, and `collapsesSpacing` is
 * true for a list item in the COLLAPSE_LISTS spacing mode.
 */

/**
 * Returns text of the same length that renders blank: every character becomes a space, except
 * tabs and soft line breaks (\u000b), which keep the lines and indentation a hidden paragraph
 * occupies.
 */
function blankText(text) {
  return text.replace(/[^\t\u000b]/g, ' ');
}

function blankingRange_(start, end) {
  return { type: 'FIXED_RANGE', startIndex: start, endIndex: end };
}

const ZERO_POINTS = { magnitude: 0, unit: 'PT' };

/**
 * Returns the requests that blank the paragraphs at `hiddenIndexes` in one shape.
 *
 * Three effects keep the visible paragraphs in place:
 * - The text becomes spaces of the same length.
 * - A hidden list item loses its bullet but keeps its rendered font size and line spacing,
 *   which a placeholder's list items can inherit from the layout.
 * - Spacing between consecutive list items is pinned to 0. In COLLAPSE_LISTS mode Slides
 *   already skips it, but once a hidden item leaves the list it would apply again (12 pt per
 *   hidden bullet in the test deck).
 */
function paragraphBlankRequests(objectId, paragraphs, hiddenIndexes) {
  if (hiddenIndexes.length === 0) return [];
  const requests = [];
  // The paragraph range includes its newline, so even an empty paragraph has a valid range.
  const paragraphRange = (paragraph) =>
    blankingRange_(paragraph.start, paragraph.start + paragraph.text.length + 1);

  paragraphs.forEach((paragraph, index) => {
    const pinBelow = paragraph.collapsesSpacing && paragraphs[index + 1]?.collapsesSpacing;
    const pinAbove = paragraph.collapsesSpacing && paragraphs[index - 1]?.collapsesSpacing;
    const fields = [pinAbove && 'spaceAbove', pinBelow && 'spaceBelow'].filter(Boolean);
    if (fields.length === 0) return;
    requests.push({
      updateParagraphStyle: {
        objectId,
        textRange: paragraphRange(paragraph),
        style: { spaceAbove: ZERO_POINTS, spaceBelow: ZERO_POINTS },
        fields: fields.join(','),
      },
    });
  });

  hiddenIndexes.forEach((index) => {
    const paragraph = paragraphs[index];
    if (!paragraph) return;
    const { start, text } = paragraph;
    if (text.length > 0) {
      requests.push({ deleteText: { objectId, textRange: blankingRange_(start, start + text.length) } });
      requests.push({ insertText: { objectId, insertionIndex: start, text: blankText(text) } });
    }
    if (!paragraph.inList) return;
    requests.push({ deleteParagraphBullets: { objectId, textRange: paragraphRange(paragraph) } });
    if (paragraph.fontSize !== null) {
      requests.push({
        updateTextStyle: {
          objectId,
          textRange: paragraphRange(paragraph),
          style: { fontSize: { magnitude: paragraph.fontSize, unit: 'PT' } },
          fields: 'fontSize',
        },
      });
    }
    if (paragraph.lineSpacing !== null) {
      requests.push({
        updateParagraphStyle: {
          objectId,
          textRange: paragraphRange(paragraph),
          style: { lineSpacing: paragraph.lineSpacing },
          fields: 'lineSpacing',
        },
      });
    }
  });
  return requests;
}

if (typeof module !== 'undefined') {
  module.exports = { blankText, paragraphBlankRequests };
}
