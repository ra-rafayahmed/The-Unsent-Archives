// Spins up an in-memory MongoDB for the whole test file, wipes all
// collections between tests, and tears the server down afterwards.
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const models = require("../../models");

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGODB_URI);

  // Mongoose builds indexes in the background, so a `$text` query can reach
  // the server before its text index exists ("text index required for $text
  // query" -> 500) and make search tests flaky. Model.init() resolves once the
  // model's indexes are built, so wait for all of them before any test runs.
  await Promise.all(Object.values(models).map((model) => model.init()));
}, 60000);

afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});
