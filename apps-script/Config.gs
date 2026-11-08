/**
 * Config.gs — settings for the Coaching Tracker connector.
 * APP_URL (the GitHub Pages address), connector version, password hashing,
 * token lifetime and sign-in lockout limits. (The mentor "give them a break"
 * threshold is worked out in the app, not here.)
 */

/** Where the app lives. The personal app link is APP_URL + "?connect=…". */
var APP_URL = 'https://mclairewrazej-goatgirl.github.io/Newhouse-Career-Coaching/';

/** Bump when the connector changes; returned by the "ping" action. */
var CONNECTOR_VERSION = '1.1.0';

/** Password hashing: salted SHA-256, repeated this many times. */
var HASH_ITERATIONS = 10000;

/** How long a sign-in lasts. */
var TOKEN_LIFETIME_DAYS = 30;

/** Wrong-password lockout: this many failures pauses sign-in for LOCKOUT_MINUTES. */
var MAX_FAILED_LOGINS = 5;
var LOCKOUT_MINUTES = 15;

/** Largest request the connector will read (characters). */
var MAX_REQUEST_CHARS = 200000;

/** How long a write waits for another write to finish. */
var LOCK_WAIT_MS = 15000;
