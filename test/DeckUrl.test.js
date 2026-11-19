const test = require('node:test');
const assert = require('node:assert/strict');
const { parseDeckId } = require('../src/DeckUrl.js');

// The presentation ID of the test deck.
const DECK_ID = '1clyj1LSJN9D-Vl_g3Gul5eGaSyBxsOs7UYP-OX6Dba0';
const BASE = 'https://docs.google.com/presentation';

test('parseDeckId reads the ID from the usual forms of a deck URL', async (t) => {
  const cases = [
    { label: 'edit URL', input: `${BASE}/d/${DECK_ID}/edit` },
    { label: 'edit URL with a slide fragment', input: `${BASE}/d/${DECK_ID}/edit#slide=id.p` },
    { label: 'sharing URL', input: `${BASE}/d/${DECK_ID}/edit?usp=sharing` },
    { label: 'present URL', input: `${BASE}/d/${DECK_ID}/present` },
    { label: 'URL with an account index', input: `${BASE}/u/1/d/${DECK_ID}/edit` },
    { label: 'URL without a trailing path', input: `${BASE}/d/${DECK_ID}` },
    { label: 'bare ID', input: DECK_ID },
    { label: 'surrounding whitespace', input: `  ${BASE}/d/${DECK_ID}/edit\n` },
  ];
  for (const { label, input } of cases) {
    await t.test(label, () => {
      assert.equal(parseDeckId(input), DECK_ID);
    });
  }
});

test('parseDeckId returns null for an empty field', async (t) => {
  for (const input of ['', '   ', undefined, null]) {
    await t.test(JSON.stringify(input) ?? 'undefined', () => {
      assert.equal(parseDeckId(input), null);
    });
  }
});

test('parseDeckId rejects input that is not a deck', async (t) => {
  const cases = [
    { label: 'a Google Docs URL', input: `https://docs.google.com/document/d/${DECK_ID}/edit` },
    { label: 'another host', input: `https://example.com/presentation/d/${DECK_ID}/edit` },
    { label: 'plain HTTP', input: `http://docs.google.com/presentation/d/${DECK_ID}/edit` },
    { label: 'free text', input: 'my slides' },
    { label: 'an ID with a slash', input: `${DECK_ID}/../x` },
    { label: 'a too-short ID', input: 'abc123' },
  ];
  for (const { label, input } of cases) {
    await t.test(label, () => {
      assert.throws(() => parseDeckId(input), /not the URL of a Google Slides deck/);
    });
  }
});
