/**
 * Pure parsing of the .pptx that Google Slides exports for a deck.
 *
 * The Slides API does not expose animations, but Google's .pptx export writes them to each
 * slide's <p:timing> element. These functions read that export. They work on a plain tree
 * ({name, attrs, children}) instead of a DOM, so the same code runs in Apps Script (on top of
 * XmlService) and in Node tests (on top of xmldom). Element names are local names without a
 * prefix. Attribute names keep their prefix, because <p:sldId> carries both `id` and `r:id`.
 */

/** Element kinds that appear as page elements, in the order Google exports them. */
const PPTX_SHAPE_KINDS = ['sp', 'grpSp', 'graphicFrame', 'pic', 'cxnSp'];

function pptxChildren_(node, name) {
  return node.children.filter((child) => child.name === name);
}

function pptxDescendants_(node, predicate, found = []) {
  node.children.forEach((child) => {
    if (predicate(child)) found.push(child);
    pptxDescendants_(child, predicate, found);
  });
  return found;
}

function pptxFirstDescendant_(node, predicate) {
  for (const child of node.children) {
    if (predicate(child)) return child;
    const match = pptxFirstDescendant_(child, predicate);
    if (match) return match;
  }
  return null;
}

/**
 * Returns the zip paths of the slide parts in deck order, such as `ppt/slides/slide1.xml`.
 *
 * @param presentationTree tree of `ppt/presentation.xml`
 * @param relsTree tree of `ppt/_rels/presentation.xml.rels`
 */
function slidePartPaths(presentationTree, relsTree) {
  const targetById = {};
  pptxChildren_(relsTree, 'Relationship').forEach((rel) => {
    targetById[rel.attrs.Id] = rel.attrs.Target;
  });
  const idList = pptxFirstDescendant_(presentationTree, (node) => node.name === 'sldIdLst');
  if (!idList) return [];
  return pptxChildren_(idList, 'sldId').map((slideId) => {
    const target = targetById[slideId.attrs['r:id']];
    if (!target) throw new Error(`The export has no part for slide relationship ${slideId.attrs['r:id']}`);
    return `ppt/${target}`;
  });
}

/**
 * Returns the shape IDs (`spid`) of a slide's elements in pre-order: each group comes before
 * its children. This order matches a pre-order walk of the deck's page elements, which is how
 * an animation target maps back to a Google page element: the export renumbers every shape,
 * so the IDs themselves never match Google object IDs.
 */
function shapeIdsInOrder(slideTree) {
  const spTree = pptxFirstDescendant_(slideTree, (node) => node.name === 'spTree');
  const ids = [];
  const walk = (container) => {
    container.children.forEach((child) => {
      if (!PPTX_SHAPE_KINDS.includes(child.name)) return;
      const nonVisual = child.children.find((part) => part.name.startsWith('nv'));
      const props = nonVisual && pptxChildren_(nonVisual, 'cNvPr')[0];
      if (!props) throw new Error(`A <${child.name}> element has no shape ID`);
      ids.push(props.attrs.id);
      if (child.name === 'grpSp') walk(child);
    });
  };
  if (spTree) walk(spTree);
  return ids;
}

/**
 * Returns the slide's animation groups in playback order. Each group is one entry of the main
 * sequence: `onClick` is false when the group starts on its own (its start delay is not
 * "indefinite"), for example an "After previous" animation that opens the sequence.
 *
 * Each effect is {spid, effectClass, paragraphs}: `effectClass` is the PowerPoint preset class
 * ("entr", "exit", "emph", ...), and `paragraphs` is {first, last} for a "By paragraph"
 * effect, or null when the effect targets the whole element.
 */
function animationGroups(slideTree) {
  const mainSeq = pptxFirstDescendant_(
    slideTree,
    (node) => node.name === 'cTn' && node.attrs.nodeType === 'mainSeq',
  );
  if (!mainSeq) return [];
  const list = pptxChildren_(mainSeq, 'childTnLst')[0];
  if (!list) return [];
  return pptxChildren_(list, 'par').map((group) => {
    const timeNode = pptxChildren_(group, 'cTn')[0];
    const conditions = timeNode && pptxChildren_(timeNode, 'stCondLst')[0];
    const start = conditions && pptxChildren_(conditions, 'cond')[0];
    const effects = pptxDescendants_(
      group,
      (node) => node.name === 'cTn' && node.attrs.presetClass !== undefined,
    ).map((effect) => {
      const target = pptxFirstDescendant_(effect, (node) => node.name === 'spTgt');
      if (!target) throw new Error('An animation effect has no shape target');
      const range = pptxFirstDescendant_(target, (node) => node.name === 'pRg');
      return {
        spid: target.attrs.spid,
        effectClass: effect.attrs.presetClass,
        paragraphs: range ? { first: Number(range.attrs.st), last: Number(range.attrs.end) } : null,
      };
    });
    return { onClick: !start || start.attrs.delay === 'indefinite', effects };
  });
}

if (typeof module !== 'undefined') {
  module.exports = { slidePartPaths, shapeIdsInOrder, animationGroups };
}
