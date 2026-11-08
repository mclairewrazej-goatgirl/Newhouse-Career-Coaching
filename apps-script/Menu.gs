/**
 * Menu.gs — the "Coaching Tracker" sheet menu: Prepare my sheet,
 * Finish setup, Show my app link, Change email or password.
 * Also the two functions the Setup panel calls (getSetupInfo, saveSetup).
 *
 * Everything here runs only for someone who can open the sheet itself;
 * none of it is reachable through the app.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Coaching Tracker')
    .addItem('1. Prepare my sheet', 'prepareSheet')
    .addItem('2. Finish setup', 'showFinishSetup')
    .addSeparator()
    .addItem('Show my app link', 'showAppLink')
    .addItem('Change email or password', 'showChangePassword')
    .addToUi();
}

/** Creates any missing tabs with their header rows. Never touches tabs that already exist. */
function prepareSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  PropertiesService.getScriptProperties().setProperty(SPREADSHEET_ID_KEY_, ss.getId());

  var created = [];
  var added = [];
  var problems = [];
  TAB_NAMES.forEach(function (tab) {
    var sheet = ss.getSheetByName(tab);
    var headers = headersFor(tab);
    if (sheet) {
      var current = sheet.getLastRow() >= 1 ? sheet.getRange(1, 1, 1, headers.length).getValues()[0] : [];
      if (!headersMatch(tab, current)) {
        var missing = missingHeaders(tab, current);
        if (missing && missing.length) {
          addMissingColumns_(tab, sheet, current);
          added.push(tab + ' (' + missing.join(', ') + ')');
        } else {
          problems.push(tab);
        }
      }
      return;
    }
    sheet = ss.insertSheet(tab);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    // Text columns are stored as plain text so dates like 2026-11-10 stay as typed.
    var formats = rowFormats(tab);
    var rows = sheet.getMaxRows() - 1;
    for (var c = 0; c < formats.length; c++) {
      sheet.getRange(2, c + 1, rows, 1).setNumberFormat(formats[c]);
    }
    sheet.autoResizeColumns(1, headers.length);
    created.push(tab);
  });

  // Remove the empty "Sheet1" a new spreadsheet starts with.
  var blank = ss.getSheetByName('Sheet1');
  if (blank && TAB_NAMES.indexOf('Sheet1') < 0 && blank.getLastRow() === 0 && ss.getSheets().length > 1) {
    ss.deleteSheet(blank);
  }

  var lines = [];
  if (created.length) lines.push('Added these tabs: ' + created.join(', ') + '.');
  if (added.length) lines.push('Added new columns to: ' + added.join('; ') + '.');
  if (!created.length && !added.length) lines.push('All six tabs were already there. Nothing was changed.');
  if (problems.length) {
    lines.push('');
    lines.push('Please check the first row of: ' + problems.join(', ') + '. It has been changed, and the app needs the original column names back.');
  }
  lines.push('');
  lines.push("Your sheet's time zone is " + ss.getSpreadsheetTimeZone() + '. If that isn\'t where you work, change it in File › Settings.');
  lines.push('');
  lines.push(isSetUp_() ? 'Setup is already finished.' : 'Next: switch the connector on (Deploy), then choose Coaching Tracker › 2. Finish setup.');
  ui.alert(problems.length ? 'Almost ready' : 'Your sheet is ready', lines.join('\n'), ui.ButtonSet.OK);
}

function showFinishSetup() {
  showSetupPanel_('setup');
}

function showChangePassword() {
  showSetupPanel_('change');
}

function showSetupPanel_(mode) {
  var t = HtmlService.createTemplateFromFile('Setup');
  t.mode = mode;
  SpreadsheetApp.getUi().showSidebar(t.evaluate().setTitle(mode === 'change' ? 'Change email or password' : 'Finish setup'));
}

/** Personal app link: the app address plus this sheet's connector address, encoded. */
function appLink_(address) {
  return APP_URL + '?connect=' + Utilities.base64EncodeWebSafe(address).replace(/=+$/, '');
}

/** Called by Setup.html to pre-fill the form. Never returns the password or its hash. */
function getSetupInfo() {
  var auth = readAuth_();
  var address = savedAddress_();
  if (!address) {
    try {
      var url = ScriptApp.getService().getUrl();
      if (url && /\/exec$/.test(url)) address = url;
    } catch (err) {
      address = '';
    }
  }
  return { address: address, email: auth ? auth.email : '' };
}

/** Called by Setup.html. Returns {ok:true, appLink} or {ok:false, problems[]}. */
function saveSetup(form) {
  form = form || {};
  var address = typeof form.address === 'string' ? form.address.trim() : '';
  var email = typeof form.email === 'string' ? form.email.trim() : '';
  var problems = [];
  if (!isConnectorAddress(address)) {
    problems.push(
      /\/dev$/.test(address)
        ? 'That is the test address (it ends in /dev). Copy the one that ends in /exec from Deploy › Manage deployments.'
        : 'The connector address should start with https://script.google.com/macros/s/ and end with /exec.'
    );
  }
  problems = problems.concat(checkCredentials(email, form.password, form.confirm));
  if (problems.length) return { ok: false, problems: problems };

  var lock = LockService.getScriptLock();
  lock.waitLock(LOCK_WAIT_MS);
  try {
    PropertiesService.getScriptProperties().setProperty(SPREADSHEET_ID_KEY_, SpreadsheetApp.getActiveSpreadsheet().getId());
    setCredentials_(email, form.password, address);
    CacheService.getScriptCache().removeAll(['login_fails', 'login_locked_until']);
  } finally {
    lock.releaseLock();
  }
  return { ok: true, appLink: appLink_(address) };
}

function showAppLink() {
  var ui = SpreadsheetApp.getUi();
  if (!isSetUp_()) {
    ui.alert('Setup isn\'t finished yet', 'Choose Coaching Tracker › 2. Finish setup first. It gives you your app link at the end.', ui.ButtonSet.OK);
    return;
  }
  var link = appLink_(savedAddress_());
  var safe = link.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  var html =
    '<style>' +
    'body{font-family:Inter,system-ui,sans-serif;color:#1B1F1E;margin:0;padding:4px 2px;font-size:14px}' +
    'p{margin:0 0 10px;color:#3E4441}' +
    'input{width:100%;box-sizing:border-box;min-height:44px;padding:8px 10px;border:1px solid #CFCCC2;border-radius:12px;font:inherit}' +
    '.row{display:flex;gap:8px;margin-top:12px}' +
    'a,button{min-height:44px;padding:0 16px;border-radius:12px;font:inherit;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;text-decoration:none}' +
    'a{background:#1F5E57;color:#fff;border:0}button{background:#fff;color:#1F5E57;border:1px solid #1F5E57}' +
    '#done{color:#1F5E57;margin-left:4px;align-self:center}' +
    '</style>' +
    '<p>Open this link on each phone or computer you use. It connects the app to this sheet.</p>' +
    '<label for="link" style="position:absolute;left:-9999px">Your app link</label>' +
    '<input id="link" readonly value="' + safe + '" onclick="this.select()">' +
    '<div class="row"><a href="' + safe + '" target="_blank" rel="noopener">Open the app</a>' +
    '<button type="button" onclick="copyLink()">Copy</button><span id="done" role="status"></span></div>' +
    '<script>function copyLink(){var i=document.getElementById("link");i.select();' +
    'function ok(){document.getElementById("done").textContent="Copied";}' +
    'if(navigator.clipboard){navigator.clipboard.writeText(i.value).then(ok,function(){document.execCommand("copy");ok();});}' +
    'else{document.execCommand("copy");ok();}}</script>';
  ui.showModalDialog(HtmlService.createHtmlOutput(html).setWidth(480).setHeight(220), 'Your app link');
}
