const app = require("./app");
const config = require("./config");
const logger = require("./utils/logger");
const { connectDB } = require("./models/connection");

let server;

async function startServer() {
  await connectDB();
  
  server = app.listen(config.port, () => {
    logger.info({ env: config.env, port: config.port }, "Server started");
  });
}

startServer();

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  logger.fatal({ err }, "Unhandled promise rejection — shutting down");
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception — shutting down");
  process.exit(1);
});
