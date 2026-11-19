/**
 * Orchestrates a split (Apps Script only): read the animations from a .pptx export of the open
 * deck, build the split pages in a new deck, save the PDF next to the original, and trash the
 * new deck unless the user asked to keep it. The open deck is only ever read.
 */

const EXPORT_BASE_URL = 'https://docs.google.com/presentation/d/';
const PDF_MIME_TYPE = 'application/pdf';

/** Converts an XmlService element into the plain tree that PptxTiming.js reads. */
function xmlTree_(element) {
  const attrs = {};
  element.getAttributes().forEach((attribute) => {
    const prefix = attribute.getNamespace().getPrefix();
    attrs[prefix ? `${prefix}:${attribute.getName()}` : attribute.getName()] = attribute.getValue();
  });
  return { name: element.getName(), attrs, children: element.getChildren().map(xmlTree_) };
}

function parseXmlPart_(parts, path) {
  const blob = parts[path];
  if (!blob) throw new Error(`The .pptx export has no ${path}`);
  return xmlTree_(XmlService.parse(blob.getDataAsString('UTF-8')).getRootElement());
}

/** Downloads a Google editors export of a deck in the given format. */
function fetchExport_(presentationId, format) {
  const response = UrlFetchApp.fetch(`${EXPORT_BASE_URL}${presentationId}/export/${format}`, {
    headers: { Authorization: `Bearer ${ScriptApp.getOAuthToken()}` },
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() !== 200) {
    throw new Error(`Exporting the deck as ${format} failed with HTTP ${response.getResponseCode()}`);
  }
  return response.getBlob();
}

/**
 * Plans one slide: its pages, and where each animated shape ID sits among the slide's page
 * elements. Throws when the export and the deck disagree on the slide's elements, because a
 * wrong mapping would hide the wrong element.
 */
function planSlide_(slideTree, slide, slideNumber) {
  const pages = buildPages(animationGroups(slideTree));
  const indexBySpid = {};
  if (pages.length > 1 || !isFullPage(pages[0])) {
    const spids = shapeIdsInOrder(slideTree);
    const elementCount = flattenElements_(slide).length;
    if (spids.length !== elementCount) {
      throw new Error(
        `Slide ${slideNumber}: the export lists ${spids.length} elements but the deck has ` +
          `${elementCount}, so its animations cannot be matched to elements`,
      );
    }
    spids.forEach((spid, index) => {
      indexBySpid[spid] = index;
    });
  }
  return { pages, indexBySpid };
}

/**
 * Opens the deck to split: the deck at `deckUrl`, or the open deck when the field is empty.
 * With a URL, one saved test deployment can split any deck the user can read.
 */
function openSourceDeck_(deckUrl) {
  const deckId = parseDeckId(deckUrl);
  if (deckId === null) return SlidesApp.getActivePresentation();
  try {
    return SlidesApp.openById(deckId);
  } catch (error) {
    throw new Error(`GSsplit cannot open the deck at this URL. Make sure that you have access to it. (${error.message})`);
  }
}

/**
 * Entry point called from the dialog. Returns links to the results.
 *
 * @param options {keepCopy: boolean, deckUrl: string}: an empty deckUrl means the open deck
 * @return {{deckName: string, pdfUrl: string, pageCount: number, copyUrl: (string|undefined)}}
 */
function runSplit(options) {
  const keepCopy = Boolean(options && options.keepCopy);
  const source = openSourceDeck_(options && options.deckUrl);
  const sourceId = source.getId();

  const parts = {};
  Utilities.unzip(fetchExport_(sourceId, 'pptx').setContentType('application/zip')).forEach(
    (blob) => {
      parts[blob.getName()] = blob;
    },
  );
  const paths = slidePartPaths(
    parseXmlPart_(parts, 'ppt/presentation.xml'),
    parseXmlPart_(parts, 'ppt/_rels/presentation.xml.rels'),
  );
  const slides = source.getSlides();
  if (paths.length !== slides.length) {
    throw new Error(`The export has ${paths.length} slides, but the deck has ${slides.length}`);
  }
  const plans = paths.map((path, index) =>
    planSlide_(parseXmlPart_(parts, path), slides[index], index + 1),
  );

  const meta = Drive.Files.get(sourceId, { fields: 'name,parents', supportsAllDrives: true });
  const name = `${meta.name} (split)`;
  // A new deck filled with appendSlide, rather than a Drive copy of the original: Drive's
  // files.copy failed with a spurious "User rate limit exceeded" under these scopes.
  const target = Slides.Presentations.create({
    title: name,
    pageSize: {
      width: { magnitude: source.getPageWidth(), unit: 'PT' },
      height: { magnitude: source.getPageHeight(), unit: 'PT' },
    },
  });
  const targetId = target.presentationId;
  try {
    splitDeck_(targetId, slides, plans);
    const pdf = Drive.Files.create(
      { name: `${name}.pdf`, parents: meta.parents, mimeType: PDF_MIME_TYPE },
      fetchExport_(targetId, 'pdf'),
      { supportsAllDrives: true, fields: 'id,webViewLink' },
    );
    const result = {
      deckName: meta.name,
      pdfUrl: pdf.webViewLink,
      pageCount: SlidesApp.openById(targetId).getSlides().length,
    };
    if (keepCopy) {
      result.copyUrl = `${EXPORT_BASE_URL}${targetId}/edit`;
      moveNextTo_(targetId, meta.parents);
    }
    return result;
  } finally {
    if (!keepCopy) Drive.Files.update({ trashed: true }, targetId, null, { supportsAllDrives: true });
  }
}

/**
 * Moves an app-created file from My Drive into the given folders. A failure (for example, no
 * write access to the original's folder) leaves the file in My Drive, where the link still works.
 */
function moveNextTo_(fileId, parents) {
  if (!parents || parents.length === 0) return;
  try {
    const current = Drive.Files.get(fileId, { fields: 'parents', supportsAllDrives: true });
    Drive.Files.update({}, fileId, null, {
      addParents: parents.join(','),
      removeParents: (current.parents || []).join(','),
      supportsAllDrives: true,
    });
  } catch (error) {
    console.warn(`Kept the split deck in My Drive: ${error.message}`);
  }
}
