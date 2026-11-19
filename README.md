# GSsplit 🎞️

GSsplit is a Google Slides add-on. It makes a PDF with one page for each animation step of
your deck.

A PDF has no animations. When you export a deck to PDF, Google Slides shows each slide in its
final state. GSsplit makes one page for each click of a slide. As a result, the PDF shows your
animations step by step, like the [PPspliT](https://github.com/maxonthegit/PPspliT) add-in does
for PowerPoint.

## ✨ What GSsplit does

- It reads the animations of your deck: entrance and exit effects, with "On click", "With
  previous", and "After previous".
- It makes one page for the start of each slide, then one page for each click.
- It supports "By paragraph" animations: bullets appear one at a time.
- It supports groups and tables. Google Slides animates them as one object.
- It keeps the number of the original slide on each page that it makes from that slide.
- It saves the PDF in the folder of your deck, as `<deck name> (split).pdf`.
- If you select the option, it also keeps the split slides as a new deck.

GSsplit never changes your deck. It reads your deck and writes new files only.

## ⚠️ Limitations

- Each page shows each effect in its final state. GSsplit does not make intermediate frames.
- Emphasis effects (for example Spin) do not change the pages.
- GSsplit does not put skipped slides in the PDF.
- On a page, a hidden bullet becomes blank text of the same length. If a long bullet wraps onto
  two lines, the blank text can use a different number of lines. Then the visible bullets can
  move.
- If an item in the middle of a numbered list exits, the numbers of the next items can change.
- Apps Script stops a run after 6 minutes. A very large deck can get to this limit.

## 🔧 How it works

The Google Slides API does not give the animations of a deck. But the PowerPoint (`.pptx`) export
of Google Slides contains them. GSsplit downloads this export and reads the animation steps of
each slide. Then it makes a new deck with one slide for each step, and removes the hidden objects
from each slide. At the end, it exports the new deck to PDF.

## 📦 Install

GSsplit is not in the Google Workspace Marketplace. You install it for yourself, as a test
deployment of your own Apps Script project.

You need:

- A Google account.
- Node.js 22 or later.

Do these steps:

1. Download this repository, then run `npm install` in its folder.
2. Run `npx @google/clasp login`. When Google asks, give `clasp` access to your Apps Script
   projects.
3. Open https://script.google.com/home/usersettings and turn on **Google Apps Script API**.
4. On https://script.google.com, click **New project**. Give the project the name `GSsplit`.
5. In the project, open **Project Settings** and copy the **Script ID**.
6. In the repository folder, create a file `.clasp.json` with this content:

   ```json
   { "scriptId": "<your script ID>", "rootDir": "src" }
   ```

7. Run `npx @google/clasp push --force`. This command uploads the add-on to your project.
8. In the Apps Script editor, click **Deploy** > **Test deployments**.
9. Next to **Select type**, click the gear icon and select **Editor Add-on**.
10. Click **Create new test**. Set **Version** to **Latest code** and **Config** to
    **Installed and enabled**.
11. For **Test document**, select a deck. Then click **Save test**.
12. Select the saved test and click **Execute**. Your deck opens with GSsplit in the menu.

### 🤖 Install with an AI agent

An AI coding agent, for example Claude Code, can do most of the install for you. Some steps
need you in a browser, and the agent asks you to do them. Give the agent this request:

> Install the GSsplit add-on from this repository. Follow the section "Install with an AI
> agent" of its README.

**Instructions for the agent.** Do the steps of the "Install" section in their order,
with these changes:

1. Do steps 1, 6, and 7 yourself. Before step 7, run `npm test`.
2. Ask the user to do steps 2–5 in a terminal and a browser. Wait until the user is done.
3. If the user works in Claude Code, tell the user to type `! npx @google/clasp login` for
   step 2.
4. Get the Script ID from the user in step 5. Then write `.clasp.json` (step 6).
5. Ask the user to do steps 8–12 in the Apps Script editor.
6. Tell the user to follow the "Use" section for the first export.

Rules for the agent:

- Do not change `src/appsscript.json`. Its permissions are the minimum that GSsplit needs.
- Do not commit `.clasp.json`. It holds the Script ID of the user.
- Do not open or change decks of the user.
- If a command fails, show the error to the user and stop.

## ▶️ Use

A test deployment works in one deck only: its **Test document**. GSsplit is in the
**Extensions** menu only when you open that deck with **Execute**. From that deck, GSsplit can
split any deck that you can open.

1. In the Apps Script editor, click **Deploy** > **Test deployments**.
2. Select your saved test and click **Execute**. The test document opens.
3. In this deck, click **Extensions** > **GSsplit** > **Export split PDF…**.
4. If you want to split another deck, paste its URL into **Deck to split**. To split the open
   deck, leave this field empty.
5. If you also want the split slides as a deck, select **Also keep the split slides as a new
   deck**.
6. Click **Export PDF**.
7. When GSsplit is done, click **Open the PDF**.

GSsplit saves the PDF in the folder of the deck that it splits.

If you prefer GSsplit in the menu of a different deck, add a test for that deck. Click
**Create new test** in **Test deployments**, and use the same settings as in steps 9–11 of the
"Install" section. The editor keeps your saved tests, and all tests use your latest code.

The first time, Google asks you to give GSsplit some permissions. Google also shows a warning,
because Google did not review your copy of the add-on. GSsplit asks for these permissions:

| Permission | Why GSsplit needs it |
|---|---|
| Google Slides presentations | It reads your deck and edits the new deck. |
| See and download your Google Drive files | It exports your deck to .pptx. It never changes these files. |
| Only the Drive files that GSsplit uses | It saves the PDF and moves the new deck to the trash. |
| Connect to an external service | It downloads the .pptx and PDF exports from Google. |
| Show content in prompts and sidebars | It shows the export dialog. |

To remove these permissions, open https://myaccount.google.com/permissions.

## 🔄 Update

When a new release of GSsplit is on GitHub, upload the new code to your Apps Script project. Your
test deployment uses the latest code, so you do not deploy again. Read `CHANGELOG.md` to see what
changed.

Do these steps:

1. Get the new release:
   - If you cloned the repository with git, run `git pull` in its folder.
   - If you downloaded the repository, download the new release. Then copy your `.clasp.json`
     from the old folder into the new folder.
2. Run `npm install`.
3. Run `npx @google/clasp push --force`. This command uploads the new code to your project.
4. Reload the deck tab that your test deployment opened. If you closed that tab, open
   **Deploy** > **Test deployments** in the Apps Script editor. Then select the saved test and
   click **Execute**.

If the new release needs more permissions, Google asks you again at the next export.

If `clasp push` fails with an error about your login, run `npx @google/clasp login` again.

### 🤖 Update with an AI agent

Give the agent this request:

> Update the GSsplit add-on in this repository to the latest release. Follow the section
> "Update with an AI agent" of its README.

**Instructions for the agent.** Do the steps of the "Update" section in their order, with these
changes:

1. Before step 1, make sure that `.clasp.json` exists. If it does not exist, stop and tell the
   user to do the install first.
2. After step 2, run `npm test`. If a test fails, stop and show the error to the user.
3. Before step 3, compare `src/appsscript.json` with the old version. If its `oauthScopes`
   changed, tell the user which permissions Google will ask for.
4. Tell the user to do step 4, and give a summary of the new `CHANGELOG.md` entries.

Rules for the agent:

- Do not change `src/appsscript.json` or `.clasp.json`.
- Do not open or change decks of the user.
- If a command fails, show the error to the user and stop.

## 🧪 Development

The tests use the built-in test runner of Node.js:

```sh
npm test
```

The tests cover the parts that do not need Google: the .pptx reader, the page model, and the
text blanking. To test the add-on itself, push it with clasp and run it on a deck.

## 📄 License

GSsplit uses the GNU General Public License, version 3 or later. See [LICENSE](LICENSE).
