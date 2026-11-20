#!/usr/bin/env node
/**
 * Weaves the speaker notes of a GSsplit `.pdfpc` file into its PDF, for pympress.
 *
 * Usage, from a clone of the repository (after `npm install`):
 *   node tools/gssplit-notes.js "talk (split).pdf"
 * or without a clone, with npx fetching the repository and pdf-lib into its cache:
 *   npx --yes --package=github:atom-sw/gssplit gssplit-notes "talk (split).pdf"
 *
 * Reads "talk (split).pdfpc" next to the PDF, then replaces both files: the PDF gets a hidden
 * note annotation on every page with a note, and page labels that group the steps of each
 * slide; the .pdfpc gets labels that match. Running it again replaces the earlier notes.
 */
const fs = require('fs');
const path = require('path');
const { PDFDocument, PDFName, PDFHexString, PDFNumber, PDFString, PDFDict, PDFArray, PDFRef } = require('pdf-lib');
const { slideNumbers, labelRanges, weavePdfpc, checkPdfpc } = require('./weave.js');

// Marks the annotations this tool writes (/NM), so that a second run can remove them.
const NOTE_NAME = 'gssplit-note';
// Hidden (2) and Print (4), as the LaTeX pdfpc package writes: viewers do not draw the note.
const HIDDEN_PRINT = 6;

/** Removes the note annotations of an earlier run from a page. */
function removeOwnNotes(doc, page) {
  const annots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
  if (!annots) return;
  for (let index = annots.size() - 1; index >= 0; index -= 1) {
    const annot = annots.lookupMaybe(index, PDFDict);
    const name = annot && annot.lookupMaybe(PDFName.of('NM'), PDFString, PDFHexString);
    if (!name || name.decodeText() !== NOTE_NAME) continue;
    // Delete the object too: pdf-lib saves every registered object, linked or not.
    const ref = annots.get(index);
    annots.remove(index);
    if (ref instanceof PDFRef) doc.context.delete(ref);
  }
}

function addNote(doc, page, note) {
  const annot = doc.context.obj({
    Type: 'Annot',
    Subtype: 'Text',
    Rect: [0, 0, 0, 0],
    F: HIDDEN_PRINT,
    NM: PDFString.of(NOTE_NAME),
    // UTF-16BE with a byte-order mark, so any character survives.
    Contents: PDFHexString.fromText(note),
  });
  // Not page.node.addAnnot: it "normalizes" the page, wrapping its content streams in another
  // save/restore pair on every run.
  let annots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
  if (!annots) {
    annots = doc.context.obj([]);
    page.node.set(PDFName.of('Annots'), annots);
  }
  annots.push(doc.context.register(annot));
}

/** Writes a file through a temporary sibling, so a failure never leaves half a file. */
function replaceFile(file, data) {
  const temporary = `${file}.gssplit-tmp`;
  fs.writeFileSync(temporary, data);
  fs.renameSync(temporary, file);
}

async function main(args) {
  if (args.length !== 1 || !args[0].toLowerCase().endsWith('.pdf')) {
    throw new Error('Usage: gssplit-notes "<deck> (split).pdf"');
  }
  const pdfFile = args[0];
  const pdfpcFile = `${pdfFile.slice(0, -'.pdf'.length)}.pdfpc`;
  if (!fs.existsSync(pdfpcFile)) {
    throw new Error(`${path.basename(pdfpcFile)} is missing: export the deck with speaker notes, and put both files in one folder`);
  }

  const pdfpc = JSON.parse(fs.readFileSync(pdfpcFile, 'utf8'));
  const doc = await PDFDocument.load(fs.readFileSync(pdfFile), { updateMetadata: false });
  checkPdfpc(pdfpc, doc.getPageCount());
  const slides = slideNumbers(pdfpc);

  const nums = [];
  labelRanges(slides).forEach(({ startIndex, label }) => {
    nums.push(PDFNumber.of(startIndex), doc.context.obj({ P: PDFHexString.fromText(label) }));
  });
  doc.catalog.set(PDFName.of('PageLabels'), doc.context.obj({ Nums: nums }));

  const pages = doc.getPages();
  let notes = 0;
  pdfpc.pages.forEach(({ idx, note }) => {
    removeOwnNotes(doc, pages[idx]);
    if (!note) return;
    addNote(doc, pages[idx], note);
    notes += 1;
  });

  // Without object streams: pdf-lib keeps the streams of an earlier save as dead objects, so
  // with them every run would grow the file.
  replaceFile(pdfFile, await doc.save({ useObjectStreams: false }));
  replaceFile(pdfpcFile, `${JSON.stringify(weavePdfpc(pdfpc, slides), null, 2)}\n`);
  console.log(`${path.basename(pdfFile)}: ${notes} of ${pages.length} pages have notes, in ${slides[slides.length - 1] || 0} slides`);
}

main(process.argv.slice(2)).catch((error) => {
  console.error(`gssplit-notes: ${error.message}`);
  process.exit(1);
});
