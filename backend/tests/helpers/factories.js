// Small factories so each test creates only the fixtures it needs.
const request = require("supertest");
const app = require("../../app");
const { User, Post } = require("../../models");
const { TEST_PASSWORD } = require("./constants");

let counter = 0;
const uniq = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Registers a user through the real API and returns { user, token }. */
async function registerUser(overrides = {}) {
  const suffix = uniq();
  const body = {
    username: `user_${suffix}`,
    email: `user_${suffix}@example.com`,
    password: TEST_PASSWORD,
    ...overrides,
  };
  const res = await request(app).post("/api/auth/register").send(body);
  if (res.status !== 201) {
    throw new Error(`registerUser failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { user: res.body.user, token: res.body.token, password: body.password };
}

/** Creates a post directly in the DB for the given author id. */
async function createPost(authorId, overrides = {}) {
  return Post.create({
    authorId,
    content: "An unsent letter.",
    visibility: "public",
    ...overrides,
  });
}

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

module.exports = { app, request, registerUser, createPost, authHeader, User, Post };
