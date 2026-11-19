// Loads XML parts of the test deck that Google Slides exported, as the plain trees that
// src/PptxTiming.js reads (the Node counterpart of xmlTree_ in src/Export.js).
const fs = require('node:fs');
const path = require('node:path');
const { DOMParser } = require('@xmldom/xmldom');

const DECK_DIR = path.join(__dirname, '..', 'fixtures', 'test-deck');
const ELEMENT_NODE = 1;

function toTree(element) {
  const attrs = {};
  Array.from(element.attributes).forEach((attribute) => {
    attrs[attribute.name] = attribute.value;
  });
  const children = Array.from(element.childNodes)
    .filter((child) => child.nodeType === ELEMENT_NODE)
    .map(toTree);
  return { name: element.localName, attrs, children };
}

/** Returns the tree of a part of the test deck, such as `ppt/slides/slide2.xml`. */
function loadPart(partPath) {
  const xml = fs.readFileSync(path.join(DECK_DIR, partPath), 'utf8');
  return toTree(new DOMParser().parseFromString(xml, 'text/xml').documentElement);
}

const slidePath = (number) => `ppt/slides/slide${number}.xml`;

module.exports = { loadPart, slidePath };
