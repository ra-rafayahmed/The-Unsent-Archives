// Runs before every test file (jest `setupFiles`). Pins the environment so
// tests never depend on a developer's local .env or a real database.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-do-not-use-in-prod";
process.env.JWT_EXPIRES_IN = "1h";
process.env.ADMIN_EMAILS = "admin@example.com";
// MONGODB_URI is set at runtime by tests/helpers/db.js (in-memory MongoDB).
