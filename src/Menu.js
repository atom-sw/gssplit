/** Editor add-on menu and dialog (Apps Script only). */

function onOpen() {
  SlidesApp.getUi()
    .createAddonMenu()
    .addItem('Export split PDF…', 'showSplitDialog')
    .addToUi();
}

function onInstall(event) {
  onOpen(event);
}

function showSplitDialog() {
  const html = HtmlService.createHtmlOutputFromFile('Dialog').setWidth(420).setHeight(330);
  SlidesApp.getUi().showModalDialog(html, 'Split slides by animation');
}
