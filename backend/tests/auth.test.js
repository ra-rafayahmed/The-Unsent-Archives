const { app, request, registerUser, authHeader, User } = require("./helpers/factories");

describe("POST /api/auth/register", () => {
  it("creates a user, returns a JWT and one-time backup codes", async () => {
    const res = await request(app).post("/api/auth/register").send({
      username: "alice",
      email: "Alice@Example.com",
      password: "password123",
    });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("success");
    expect(typeof res.body.token).toBe("string");
    expect(res.body.user).toMatchObject({
      username: "alice",
      email: "alice@example.com",
      role: "user",
    });
    expect(res.body.backupCodes).toHaveLength(8);
    expect(res.body.user).not.toHaveProperty("passwordHash");

    // Password must be stored hashed, never in plaintext.
    const stored = await User.findOne({ email: "alice@example.com" }).select("+passwordHash");
    expect(stored.passwordHash).not.toBe("password123");
    expect(await stored.comparePassword("password123")).toBe(true);
  });

  it("grants the admin role to emails listed in ADMIN_EMAILS", async () => {
    const res = await request(app).post("/api/auth/register").send({
      username: "root",
      email: "admin@example.com",
      password: "password123",
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("admin");
  });

  it("rejects an invalid payload with 400 and a validation message", async () => {
    const res = await request(app).post("/api/auth/register").send({
      username: "no spaces allowed",
      email: "not-an-email",
      password: "123",
    });
    expect(res.status).toBe(400);
    expect(res.body.status).toBe("fail");
    expect(res.body.message).toMatch(/Validation failed/);
  });

  it("returns 409 for a duplicate email and for a duplicate username", async () => {
    await registerUser({ username: "bob", email: "bob@example.com" });

    const dupEmail = await request(app)
      .post("/api/auth/register")
      .send({ username: "bob2", email: "BOB@example.com", password: "password123" });
    expect(dupEmail.status).toBe(409);
    expect(dupEmail.body.message).toMatch(/Email/);

    const dupUsername = await request(app)
      .post("/api/auth/register")
      .send({ username: "bob", email: "other@example.com", password: "password123" });
    expect(dupUsername.status).toBe(409);
    expect(dupUsername.body.message).toMatch(/Username/);
  });
});

describe("POST /api/auth/login", () => {
  it("logs in with correct credentials", async () => {
    const { user, password } = await registerUser();
    const res = await request(app).post("/api/auth/login").send({ email: user.email, password });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.user.id).toBe(user.id);
  });

  it("returns 401 for a wrong password and for an unknown email", async () => {
    const { user } = await registerUser();
    const wrong = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "nope-nope" });
    expect(wrong.status).toBe(401);

    const unknown = await request(app)
      .post("/api/auth/login")
      .send({ email: "ghost@example.com", password: "password123" });
    expect(unknown.status).toBe(401);
  });

  it("returns 403 for a suspended account", async () => {
    const { user, password } = await registerUser();
    await User.updateOne({ _id: user.id }, { isSuspended: true });
    const res = await request(app).post("/api/auth/login").send({ email: user.email, password });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/suspended/);
  });
});

describe("GET /api/auth/me", () => {
  it("returns the current user for a valid token", async () => {
    const { user, token } = await registerUser();
    const res = await request(app).get("/api/auth/me").set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.user._id).toBe(user.id);
    expect(res.body.user).not.toHaveProperty("passwordHash");
  });

  it("returns 401 without a token or with a garbage token", async () => {
    expect((await request(app).get("/api/auth/me")).status).toBe(401);
    expect((await request(app).get("/api/auth/me").set(authHeader("garbage"))).status).toBe(401);
  });
});

describe("password reset flow", () => {
  it("issues a reset token (non-production) and lets the user set a new password", async () => {
    const { user } = await registerUser();

    const forgot = await request(app).post("/api/auth/forgot-password").send({ email: user.email });
    expect(forgot.status).toBe(200);
    expect(typeof forgot.body.resetToken).toBe("string");

    const reset = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: forgot.body.resetToken, password: "newpassword456" });
    expect(reset.status).toBe(200);
    expect(typeof reset.body.token).toBe("string");

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "newpassword456" });
    expect(login.status).toBe(200);
  });

  it("does not reveal whether an email exists", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "nobody@example.com" });
    expect(res.status).toBe(200);
    expect(res.body.resetToken).toBeUndefined();
  });

  it("rejects an invalid reset token", async () => {
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "x".repeat(40), password: "newpassword456" });
    expect(res.status).toBe(400);
  });
});

describe("backup code recovery", () => {
  it("recovers an account with an unused code, and refuses to reuse it", async () => {
    const reg = await request(app)
      .post("/api/auth/register")
      .send({ username: "carol", email: "carol@example.com", password: "password123" });
    const [code] = reg.body.backupCodes;

    const ok = await request(app)
      .post("/api/auth/recover")
      .send({ email: "carol@example.com", code, password: "recovered789" });
    expect(ok.status).toBe(200);
    expect(typeof ok.body.token).toBe("string");

    const status = await request(app).get("/api/auth/backup-codes").set(authHeader(ok.body.token));
    expect(status.body).toMatchObject({ total: 8, remaining: 7, used: 1 });

    const reuse = await request(app)
      .post("/api/auth/recover")
      .send({ email: "carol@example.com", code, password: "another000" });
    expect(reuse.status).toBe(400);
  });
});
