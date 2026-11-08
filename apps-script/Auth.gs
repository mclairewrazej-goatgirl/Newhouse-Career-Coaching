/**
 * Auth.gs — salted, iterated SHA-256 password hashing stored in Script
 * Properties, sign-in tokens with expiry, and the wrong-password lockout.
 * Passwords are never written to the sheet, logged or returned.
 *
 * Script Properties used:
 *   auth               {email, salt, hash, iterations, tokenVersion}
 *   connector_address  the coach's deployed connector address (…/exec)
 *   tok_<sha256(token)> {exp, v}   one per signed-in device
 * Script Cache used:
 *   login_fails, login_locked_until
 */

var AUTH_KEY_ = 'auth';
var ADDRESS_KEY_ = 'connector_address';
var TOKEN_PREFIX_ = 'tok_';

/** An error the API turns into {ok:false, error:{code, message}}. */
function apiError_(code, message) {
  var e = new Error(message);
  e.apiCode = code;
  return e;
}

function props_() {
  return PropertiesService.getScriptProperties();
}

function toHex_(bytes) {
  var out = '';
  for (var i = 0; i < bytes.length; i++) {
    var b = (bytes[i] + 256) % 256;
    out += (b < 16 ? '0' : '') + b.toString(16);
  }
  return out;
}

function sha256Hex_(text) {
  return toHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8));
}

/** Salted SHA-256, repeated `iterations` times. */
function hashPassword_(password, salt, iterations) {
  var alg = Utilities.DigestAlgorithm.SHA_256;
  var saltBytes = Utilities.newBlob(salt).getBytes();
  var bytes = Utilities.computeDigest(alg, salt + ':' + password, Utilities.Charset.UTF_8);
  for (var i = 1; i < iterations; i++) {
    bytes = Utilities.computeDigest(alg, bytes.concat(saltBytes));
  }
  return toHex_(bytes);
}

/** Compares two strings without stopping at the first difference. */
function constantTimeEquals_(a, b) {
  a = String(a);
  b = String(b);
  var diff = a.length ^ b.length;
  var n = Math.max(a.length, b.length);
  for (var i = 0; i < n; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function randomToken_() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
}

function readAuth_() {
  var raw = props_().getProperty(AUTH_KEY_);
  return raw ? JSON.parse(raw) : null;
}

function isSetUp_() {
  return !!readAuth_() && !!props_().getProperty(ADDRESS_KEY_);
}

function savedAddress_() {
  return props_().getProperty(ADDRESS_KEY_) || '';
}

/** Removes every sign-in token (and, if onlyExpired, only the old ones). */
function clearTokens_(onlyExpired) {
  var p = props_();
  var all = p.getProperties();
  var now = Date.now();
  Object.keys(all).forEach(function (key) {
    if (key.indexOf(TOKEN_PREFIX_) !== 0) return;
    if (onlyExpired) {
      var t = null;
      try { t = JSON.parse(all[key]); } catch (err) { t = null; }
      if (t && t.exp > now) return;
    }
    p.deleteProperty(key);
  });
}

/**
 * Saves a new email/password (and the connector address). Signs out every
 * device by bumping tokenVersion and deleting old tokens.
 */
function setCredentials_(email, password, address) {
  var old = readAuth_();
  var salt = Utilities.getUuid().replace(/-/g, '');
  var auth = {
    email: String(email).trim().toLowerCase(),
    salt: salt,
    hash: hashPassword_(password, salt, HASH_ITERATIONS),
    iterations: HASH_ITERATIONS,
    tokenVersion: (old && old.tokenVersion ? old.tokenVersion : 0) + 1,
  };
  var p = props_();
  p.setProperty(AUTH_KEY_, JSON.stringify(auth));
  p.setProperty(ADDRESS_KEY_, address);
  clearTokens_(false);
}

function lockedUntil_() {
  var v = CacheService.getScriptCache().get('login_locked_until');
  var t = v ? Number(v) : 0;
  return t > Date.now() ? t : 0;
}

function recordFailedLogin_() {
  var cache = CacheService.getScriptCache();
  var fails = Number(cache.get('login_fails') || 0) + 1;
  if (fails >= MAX_FAILED_LOGINS) {
    var until = Date.now() + LOCKOUT_MINUTES * 60 * 1000;
    cache.put('login_locked_until', String(until), LOCKOUT_MINUTES * 60);
    cache.remove('login_fails');
    return until;
  }
  cache.put('login_fails', String(fails), LOCKOUT_MINUTES * 60);
  return 0;
}

function lockedMessage_(until) {
  var mins = Math.max(1, Math.ceil((until - Date.now()) / 60000));
  return 'Too many wrong tries. Sign-in is paused for ' + mins + ' more minute' + (mins === 1 ? '' : 's') + '.';
}

/** action "login": {email, password} -> {token, email, expiresAt} */
function login_(payload) {
  payload = payload || {};
  var email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  var password = typeof payload.password === 'string' ? payload.password : '';
  if (!email || !password || password.length > 200 || email.length > 254) {
    throw apiError_('BAD_INPUT', 'Enter your email and password.');
  }

  var until = lockedUntil_();
  if (until) throw apiError_('LOCKED', lockedMessage_(until));

  var auth = readAuth_();
  if (!auth) throw apiError_('AUTH', "Sign-in isn't set up yet. Open your sheet and choose Coaching Tracker › 2. Finish setup.");

  var hash = hashPassword_(password, auth.salt, auth.iterations || HASH_ITERATIONS);
  var emailOk = constantTimeEquals_(email, auth.email);
  var hashOk = constantTimeEquals_(hash, auth.hash);
  if (!(emailOk && hashOk)) {
    var lockedNow = recordFailedLogin_();
    if (lockedNow) throw apiError_('LOCKED', lockedMessage_(lockedNow));
    throw apiError_('AUTH', 'Wrong email or password.');
  }

  CacheService.getScriptCache().remove('login_fails');
  clearTokens_(true);

  var token = randomToken_();
  var exp = Date.now() + TOKEN_LIFETIME_DAYS * 24 * 60 * 60 * 1000;
  props_().setProperty(TOKEN_PREFIX_ + sha256Hex_(token), JSON.stringify({ exp: exp, v: auth.tokenVersion }));
  return { token: token, email: auth.email, expiresAt: new Date(exp).toISOString() };
}

/** Throws AUTH unless the token is current. */
function requireToken_(token) {
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) {
    throw apiError_('AUTH', 'Please sign in.');
  }
  var auth = readAuth_();
  var raw = props_().getProperty(TOKEN_PREFIX_ + sha256Hex_(token));
  if (!auth || !raw) throw apiError_('AUTH', 'Please sign in.');
  var t = JSON.parse(raw);
  if (t.v !== auth.tokenVersion || !(t.exp > Date.now())) {
    throw apiError_('AUTH', 'Your sign-in has expired. Please sign in again.');
  }
}

/** action "logout": forgets this device's token. */
function logout_(token) {
  props_().deleteProperty(TOKEN_PREFIX_ + sha256Hex_(token));
  return {};
}
