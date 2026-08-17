// Runs before every test file (jest `setupFiles`). Pins the environment so
// tests never depend on a developer's local .env or a real database.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-do-not-use-in-prod";
process.env.JWT_EXPIRES_IN = "1h";
process.env.ADMIN_EMAILS = "admin@example.com";
// MONGODB_URI is set at runtime by tests/helpers/db.js (in-memory MongoDB).

// Pin where mongodb-memory-server caches the mongod binary. Without this it
// resolves the "project root" from cwd (which changes when tests run via the
// repo-root workspace scripts) and re-downloads ~100 MB each time. The repo
// root is used rather than node_modules so the cache survives a reinstall.
const path = require("path");
process.env.MONGOMS_DOWNLOAD_DIR =
  process.env.MONGOMS_DOWNLOAD_DIR || path.join(__dirname, "..", "..", "..", ".mongodb-binaries");
