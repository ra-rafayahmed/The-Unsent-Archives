const mongoose = require("mongoose");
const { app, request, registerUser, authHeader } = require("./helpers/factories");
const { MediaAsset } = require("../models");

// Minimal but real-enough payloads; only the declared mime type is inspected.
const PNG_BYTES = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
const MP3_BYTES = Buffer.from("494433040000000000", "hex");

const uploadPng = (token, filename = "letter.png") =>
  request(app)
    .post("/api/uploads")
    .set(authHeader(token))
    .attach("file", PNG_BYTES, { filename, contentType: "image/png" });

describe("POST /api/uploads", () => {
  it("requires authentication", async () => {
    const res = await request(app)
      .post("/api/uploads")
      .attach("file", PNG_BYTES, { filename: "x.png", contentType: "image/png" });
    expect(res.status).toBe(401);
    expect(await MediaAsset.countDocuments({})).toBe(0);
  });

  it("stores an image and returns a fetchable url without the binary", async () => {
    const { user, token } = await registerUser();

    const res = await uploadPng(token);
    expect(res.status).toBe(201);
    expect(res.body.asset).toMatchObject({
      ownerId: user.id,
      mimeType: "image/png",
      mediaType: "image",
      size: PNG_BYTES.length,
    });
    expect(res.body.asset.data).toBeUndefined();
    expect(res.body.asset.url).toMatch(
      new RegExp(`^https?://[^/]+/api/uploads/${res.body.asset._id}/file$`)
    );

    const stored = await MediaAsset.findById(res.body.asset._id).select("+data");
    expect(stored.url).toBe(res.body.asset.url);
    expect(stored.data.equals(PNG_BYTES)).toBe(true);
  });

  it("classifies an audio upload as audio", async () => {
    const { token } = await registerUser();

    const res = await request(app)
      .post("/api/uploads")
      .set(authHeader(token))
      .attach("file", MP3_BYTES, { filename: "voice-note.mp3", contentType: "audio/mpeg" });

    expect(res.status).toBe(201);
    expect(res.body.asset).toMatchObject({ mediaType: "audio", mimeType: "audio/mpeg" });
  });

  it("rejects a file type that is neither image nor audio", async () => {
    const { token } = await registerUser();

    const res = await request(app)
      .post("/api/uploads")
      .set(authHeader(token))
      .attach("file", Buffer.from("dear diary"), {
        filename: "notes.txt",
        contentType: "text/plain",
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Only image and audio files are supported");
    expect(await MediaAsset.countDocuments({})).toBe(0);
  });

  it("rejects a request with no file attached", async () => {
    const { token } = await registerUser();
    const res = await request(app).post("/api/uploads").set(authHeader(token)).send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("File is required");
  });

  it("renames the file without trusting the client's name, keeping the extension", async () => {
    const { token } = await registerUser();

    const res = await uploadPng(token, "../../my letter (1).PNG");
    expect(res.status).toBe(201);
    expect(res.body.asset.fileName).toMatch(/^\d+-[a-z0-9]+\.png$/);
  });
});

describe("GET /api/uploads/my", () => {
  it("requires authentication", async () => {
    expect((await request(app).get("/api/uploads/my")).status).toBe(401);
  });

  it("lists only the caller's own assets, newest first, without binaries", async () => {
    const owner = await registerUser();
    const other = await registerUser();

    const first = await uploadPng(owner.token, "one.png");
    const second = await uploadPng(owner.token, "two.png");
    await uploadPng(other.token, "theirs.png");

    const res = await request(app).get("/api/uploads/my").set(authHeader(owner.token));
    expect(res.status).toBe(200);
    expect(res.body.results).toBe(2);
    expect(res.body.assets.map((a) => a._id)).toEqual([
      second.body.asset._id,
      first.body.asset._id,
    ]);
    expect(res.body.assets.every((a) => a.data === undefined)).toBe(true);
  });
});

describe("GET /api/uploads/:id/file", () => {
  it("streams the stored bytes to anonymous visitors", async () => {
    const { token } = await registerUser();
    const uploaded = await uploadPng(token);

    const res = await request(app).get(`/api/uploads/${uploaded.body.asset._id}/file`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    expect(res.headers["content-length"]).toBe(String(PNG_BYTES.length));
    expect(res.headers["cache-control"]).toMatch(/immutable/);
    expect(res.headers["cross-origin-resource-policy"]).toBe("cross-origin");
    expect(res.headers["content-disposition"]).toBe(
      `inline; filename="${uploaded.body.asset.fileName}"`
    );
    expect(Buffer.from(res.body).equals(PNG_BYTES)).toBe(true);
  });

  it("returns 404 for an unknown asset and 400 for a malformed id", async () => {
    const missing = await request(app).get(`/api/uploads/${new mongoose.Types.ObjectId()}/file`);
    expect(missing.status).toBe(404);

    const malformed = await request(app).get("/api/uploads/not-an-id/file");
    expect(malformed.status).toBe(400);
  });
});

describe("DELETE /api/uploads/:id", () => {
  it("requires authentication", async () => {
    const { token } = await registerUser();
    const uploaded = await uploadPng(token);

    const res = await request(app).delete(`/api/uploads/${uploaded.body.asset._id}`);
    expect(res.status).toBe(401);
    expect(await MediaAsset.findById(uploaded.body.asset._id)).not.toBeNull();
  });

  it("lets the owner delete their asset", async () => {
    const { token } = await registerUser();
    const uploaded = await uploadPng(token);
    const id = uploaded.body.asset._id;

    const res = await request(app).delete(`/api/uploads/${id}`).set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Media asset deleted");
    expect(await MediaAsset.findById(id)).toBeNull();
    expect((await request(app).get(`/api/uploads/${id}/file`)).status).toBe(404);
  });

  it("returns 403 when someone else tries to delete it", async () => {
    const owner = await registerUser();
    const other = await registerUser();
    const uploaded = await uploadPng(owner.token);
    const id = uploaded.body.asset._id;

    const res = await request(app).delete(`/api/uploads/${id}`).set(authHeader(other.token));
    expect(res.status).toBe(403);
    expect(await MediaAsset.findById(id)).not.toBeNull();
  });

  it("returns 404 for an asset that no longer exists", async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .delete(`/api/uploads/${new mongoose.Types.ObjectId()}`)
      .set(authHeader(token));
    expect(res.status).toBe(404);
  });
});
