// Runs before every test file (jest `setupFiles`). Pins the environment so
// tests never depend on a developer's local .env or a real database.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-do-not-use-in-prod";
process.env.JWT_EXPIRES_IN = "1h";
process.env.ADMIN_EMAILS = "admin@example.com";
// MONGODB_URI is set at runtime by tests/helpers/db.js (in-memory MongoDB).

// Pin where mongodb-memory-server caches the mongod binary. Without this it
// resolves the "project root" from cwd (which changes when tests are run via
// the repo-root scripts) and re-downloads ~100 MB into a different folder.
const path = require("path");
process.env.MONGOMS_DOWNLOAD_DIR =
  process.env.MONGOMS_DOWNLOAD_DIR ||
  path.join(__dirname, "..", "..", "node_modules", ".cache", "mongodb-memory-server");
