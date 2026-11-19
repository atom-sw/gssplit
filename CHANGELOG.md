# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.2.0] - 2026-11-19

### Added

- "Deck to split" field in the export dialog: paste the URL of any deck that you can open, and
  GSsplit splits that deck instead of the open one. One saved test deployment is thus enough
  for all your decks.
- README section on using GSsplit with more than one deck.

## [0.1.0] - 2026-11-19

### Added

- Google Slides Editor add-on that exports a PDF with one page per animation step, from the
  "Export split PDF…" menu item.
- Entrance and exit effects, with "On click", "With previous", and "After previous" start
  conditions; emphasis effects add no pages.
- "By paragraph" builds: hidden bullets turn into blank text, so the visible bullets keep their
  position.
- Groups and tables, animated as one object.
- Each page shows the slide number of its original slide; skipped slides stay out of the PDF.
- Option to keep the split slides as a new deck next to the original.
- README instructions to install and update GSsplit, by hand or with an AI coding agent such as
  Claude Code.
