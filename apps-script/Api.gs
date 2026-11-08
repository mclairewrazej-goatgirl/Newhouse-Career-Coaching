/**
 * Api.gs — doGet/doPost router. Parses {action, token, payload}, checks the
 * token for every action except login and ping, and returns
 * {ok:true, data} or {ok:false, error:{code, message}}.
 *
 * The app sends POST with Content-Type text/plain so the browser doesn't
 * need a CORS preflight (Apps Script can't answer one).
 */

/** Actions that need a sign-in token: everything except "ping" and "login",
 * which are handled first in doPost. Each gets (payload, token)
 * and returns `data`. */
var ACTIONS_ = {
  logout: function (payload, token) { return logout_(token); },
  getAll: function () { return getAll_(); },
  upsertClient: function (p) { return upsertClient_(p); },
  upsertPlanned: function (p) { return upsertPlanned_(p); },
  cancelPlanned: function (p) { return cancelPlanned_(p); },
  logSession: function (p) { return logSession_(p); },
  setSuggestionOutcome: function (p) { return setSuggestionOutcome_(p); },
  setSuggestionDone: function (p) { return setSuggestionDone_(p); },
  upsertMentor: function (p) { return upsertMentor_(p); },
  upsertMentorLink: function (p) { return upsertMentorLink_(p); },
  deleteMentorLink: function (p) { return deleteMentorLink_(p); },
};

/** Health check only. Never returns data. */
function doGet() {
  return json_({ ok: true, app: 'coaching-tracker' });
}

function doPost(e) {
  var action = '';
  try {
    var body = e && e.postData && typeof e.postData.contents === 'string' ? e.postData.contents : '';
    if (!body) throw apiError_('BAD_INPUT', 'Empty request.');
    if (body.length > MAX_REQUEST_CHARS) throw apiError_('BAD_INPUT', 'That request is too large.');

    var req;
    try {
      req = JSON.parse(body);
    } catch (err) {
      throw apiError_('BAD_INPUT', 'The request could not be read.');
    }
    if (!req || typeof req !== 'object' || typeof req.action !== 'string') {
      throw apiError_('BAD_INPUT', 'The request could not be read.');
    }
    action = req.action;
    var payload = req.payload && typeof req.payload === 'object' ? req.payload : {};

    if (action === 'ping') return json_({ ok: true, data: { version: CONNECTOR_VERSION } });
    if (action === 'login') return json_({ ok: true, data: login_(payload) });

    if (!Object.prototype.hasOwnProperty.call(ACTIONS_, action)) {
      // Check the token first so an unknown action doesn't reveal anything without one.
      requireToken_(req.token);
      throw apiError_('BAD_INPUT', 'Unknown action.');
    }
    requireToken_(req.token);
    return json_({ ok: true, data: ACTIONS_[action](payload, req.token) });
  } catch (err) {
    return json_(errorBody_(err, action));
  }
}

/** Turns any thrown error into a safe response. No stack traces leave the connector. */
function errorBody_(err, action) {
  if (err && err.apiCode) {
    return { ok: false, error: { code: err.apiCode, message: err.message } };
  }
  // Log only the action and the error text: never the request body, which may hold a password.
  console.error('Connector error in "' + action + '": ' + (err && err.message ? err.message : err));
  return { ok: false, error: { code: 'SERVER', message: 'Something went wrong in your sheet. Please try again.' } };
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
