# Input validation at the API boundary

Every request body that reaches a controller has already been validated. This
page is the audit: it lists **all 26 mutating routes**, the Joi schema each one
applies, and the justification for the five that carry no body schema.

## How it works

Three pieces, all under `backend/`:

1. **`validators/*.js`** — Joi schemas, one export per operation. Example from
   `validators/interactionValidator.js`:

   ```js
   const reactionSchema = Joi.object({
     type: Joi.string()
       .valid(...REACTION_TYPES)
       .required()
       .messages({ "any.only": `type must be one of: ${REACTION_TYPES.join(", ")}` }),
   });
   ```

2. **`middleware/validate.js`** — one generic middleware that runs a schema
   against `req.body` and converts a Joi failure into a 400 `ApiError`:

   ```js
   const validate = (schema) => (req, res, next) => {
     const { error } = schema.validate(req.body, { abortEarly: false });

     if (error) {
       const details = error.details.map((d) => d.message).join(", ");
       return next(new ApiError(400, `Validation failed: ${details}`));
     }

     next();
   };
   ```

3. **`routes/*.js`** — the middleware is applied per route, before the
   controller:

   ```js
   router.post("/", auth, validate(createPostSchema), ctrl.createPost);
   ```

A rejected request never reaches a controller and never touches the database.
The response is the standard error envelope:

```json
{
  "status": "fail",
  "statusCode": 400,
  "message": "Validation failed: \"content\" is not allowed to be empty"
}
```

## Coverage: 21 of 26 mutating routes carry a body schema

| Route                                 | Schema                         |
| ------------------------------------- | ------------------------------ |
| `PUT /api/admin/reports/:id/resolve`  | `resolveReportSchema`          |
| `PUT /api/admin/users/:id/role`       | `setRoleSchema`                |
| `PUT /api/admin/users/:id/suspend`    | `suspendUserSchema`            |
| `POST /api/auth/forgot-password`      | `forgotPasswordSchema`         |
| `POST /api/auth/login`                | `loginSchema`                  |
| `POST /api/auth/recover`              | `recoverWithBackupCodeSchema`  |
| `POST /api/auth/register`             | `registerSchema`               |
| `POST /api/auth/reset-password`       | `resetPasswordSchema`          |
| `POST /api/collections`               | `createCollectionSchema`       |
| `PUT /api/collections/:id`            | `updateCollectionSchema`       |
| `POST /api/collections/:id/posts`     | `addPostToCollectionSchema`    |
| `POST /api/events`                    | `analyticsEventSchema`         |
| `POST /api/follows`                   | `followSchema`                 |
| `POST /api/posts`                     | `createPostSchema`             |
| `PUT /api/posts/:id`                  | `updatePostSchema`             |
| `POST /api/posts/:id/comments`        | `commentSchema`                |
| `POST /api/posts/:id/reactions`       | `reactionSchema`               |
| `POST /api/posts/:id/repost`          | `repostSchema`                 |
| `POST /api/recommendations/refresh`   | `refreshRecommendationsSchema` |
| `POST /api/reports`                   | `reportSchema`                 |
| `PUT /api/users/:id`                  | `updateProfileSchema`          |

### The five without a body schema, and why

| Route                                   | Why no schema                                                                                                                          |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/logout`                 | Takes no body. The handler only answers 200; the JWT is discarded client-side.                                                          |
| `POST /api/auth/backup-codes/regenerate`| Takes no body. Operates purely on `req.user.id` from the verified token.                                                                |
| `POST /api/admin/users/:id/issue-reset` | Takes no body. The target is the `:id` path param, and the route sits behind `auth` + `requireAdmin`.                                   |
| `POST /api/users/:id/follow`            | Takes no body. The target is the `:id` path param. (The body-carrying sibling, `POST /api/follows`, **is** validated by `followSchema`.) |
| `POST /api/uploads`                     | Multipart, not JSON. Validated by multer in `middleware/upload.js`: a mime allow-list (jpeg/png/webp/gif, mpeg/wav/ogg/mp4/aac) and a 15 MB size cap. |

Path parameters are not validated by Joi: an ill-formed ObjectId becomes a
mongoose `CastError`, which `middleware/errorHandler.js` maps to a 400.

## Proof

`backend/tests/validation.test.js` posts malformed payloads at each mutating
endpoint and asserts a 400 **and** that nothing was written. Examples of what
it pins:

- unknown/missing reaction type, and that no `Reaction` document is created
- empty, whitespace-only and over-length (1001-char) comments
- malformed `followeeId`, unknown report `targetType`/`reason`
- analytics events for a malformed or non-existent `postId`
- non-boolean `suspended`, unknown admin `role`

Per-resource suites (`posts.test.js`, `users.test.js`, `collections.test.js`,
`auth.test.js` …) carry their own 400 cases for their own schemas.

Coverage of the validator layer, from `npm run test:coverage --workspace backend`:

```
 backend/validators   |     100 |      100 |     100 |     100 |
 backend/middleware   |   90.47 |    82.69 |   88.23 |   90.67 |
```

## Reproducing this audit

The table above is derived from source, not written by hand:

```bash
cd backend
grep -rnE "^router\.(post|put|patch)\(" routes/
```

Every line printed either contains `validate(<schema>)` or is one of the five
exceptions listed above.

## Client-side validation

`frontend/src/utils/validation.js` mirrors the same rules so a user sees the
error immediately instead of after a round trip. **The server remains the
authority** — the client copy is a convenience, never a substitute, and every
rule below is also enforced by the Joi schema it names.

| Client rule                    | Mirrors                                              |
| ------------------------------ | ---------------------------------------------------- |
| `validateUsername`             | `registerSchema.username` — 3-30, `^[a-zA-Z0-9_]+$`  |
| `validateEmail`                | `registerSchema.email`                               |
| `validatePassword`             | `password.min(6)` (register / reset / recover)       |
| `validatePasswordConfirmation` | client-only — the confirm field is never sent        |
| `validateNoteContent`          | `createPostSchema.content` — 1-5000                  |
| `validateTags`                 | `tags.max(10)`, `^[a-zA-Z0-9-]+$`                    |

Wired into `Register`, `ResetPassword`, `RecoverWithCode` and the note editor:
an invalid field renders its message inline and the request is not sent.

Two deliberate divergences:

1. **Email.** Joi's `.email()` validates against the full IANA TLD list, which
   cannot ship to the browser. The client regex requires *a* TLD — stricter
   than the native `type="email"` control (which accepts `q@example`), looser
   than Joi. A bogus-but-well-formed TLD is caught by the server.
2. **Whitespace.** Joi accepts `"      "` as a six-character password; the
   client reports it as missing. Deliberately stricter.

Covered by `frontend/src/utils/validation.test.js` (30 tests) plus per-page
cases asserting the API is **not** called when a field is invalid.
