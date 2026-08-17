// Shared test-only values. Generated per run so no literal credential is
// committed and naive secret scanners have nothing to flag.
const crypto = require("crypto");

const randomPassword = (label) => `${label}-${crypto.randomBytes(9).toString("hex")}`;

/** Password every fixture user registers with. */
const TEST_PASSWORD = randomPassword("pw");
/** A different valid password, used when exercising reset/recovery flows. */
const NEW_PASSWORD = randomPassword("new");
/** A second replacement password, for "can this code be reused?" assertions. */
const OTHER_PASSWORD = randomPassword("other");
/** Never registered anywhere — used to assert failed logins. */
const WRONG_PASSWORD = randomPassword("wrong");

module.exports = {
  randomPassword,
  TEST_PASSWORD,
  NEW_PASSWORD,
  OTHER_PASSWORD,
  WRONG_PASSWORD,
};
