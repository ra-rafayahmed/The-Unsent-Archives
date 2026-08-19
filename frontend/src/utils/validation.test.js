import { describe, it, expect } from "vitest";
import {
  USERNAME_MIN,
  USERNAME_MAX,
  PASSWORD_MIN,
  NOTE_MAX,
  TAGS_MAX,
  validateUsername,
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
  validateNoteContent,
  validateTags,
  validateForm,
} from "./validation";

describe("validateUsername", () => {
  it("accepts letters, numbers and underscores at both length boundaries", () => {
    expect(validateUsername("abc")).toBeNull();
    expect(validateUsername("midnight_pen")).toBeNull();
    expect(validateUsername("a1_")).toBeNull();
    expect(validateUsername("a".repeat(USERNAME_MAX))).toBeNull();
  });

  it("trims before measuring", () => {
    expect(validateUsername("  quiet_ink  ")).toBeNull();
  });

  it("rejects an empty or whitespace-only username", () => {
    expect(validateUsername("")).toBe("Username is required");
    expect(validateUsername("   ")).toBe("Username is required");
    expect(validateUsername(undefined)).toBe("Username is required");
    expect(validateUsername(null)).toBe("Username is required");
    expect(validateUsername(42)).toBe("Username is required");
  });

  it("rejects one character below the minimum", () => {
    expect(validateUsername("a".repeat(USERNAME_MIN - 1))).toBe(
      `Username must be at least ${USERNAME_MIN} characters`
    );
  });

  it("rejects one character above the maximum", () => {
    expect(validateUsername("a".repeat(USERNAME_MAX + 1))).toBe(
      `Username must be at most ${USERNAME_MAX} characters`
    );
  });

  it("rejects characters outside the backend's pattern", () => {
    const message = "Username can only contain letters, numbers, and underscores";
    expect(validateUsername("has space")).toBe(message);
    expect(validateUsername("dash-ed")).toBe(message);
    expect(validateUsername("dot.ted")).toBe(message);
    expect(validateUsername("emoji✍️")).toBe(message);
  });
});

describe("validateEmail", () => {
  it("accepts ordinary addresses", () => {
    expect(validateEmail("me@example.com")).toBeNull();
    expect(validateEmail("first.last+tag@mail.example.co.uk")).toBeNull();
    expect(validateEmail("  spaced@example.com  ")).toBeNull();
  });

  it("rejects an empty or whitespace-only address", () => {
    expect(validateEmail("")).toBe("Email is required");
    expect(validateEmail("   ")).toBe("Email is required");
    expect(validateEmail(undefined)).toBe("Email is required");
  });

  it("rejects malformed addresses", () => {
    const message = "Enter a valid email address";
    expect(validateEmail("not-an-email")).toBe(message);
    expect(validateEmail("no-at-sign.com")).toBe(message);
    expect(validateEmail("@example.com")).toBe(message);
    expect(validateEmail("me@example")).toBe(message);
    expect(validateEmail("me@example.")).toBe(message);
    expect(validateEmail("me@.com")).toBe(message);
    expect(validateEmail("me@exam ple.com")).toBe(message);
    expect(validateEmail("me@double..dot.com")).toBe(message);
  });
});

describe("validatePassword", () => {
  it("accepts exactly the minimum length and above", () => {
    expect(validatePassword("a".repeat(PASSWORD_MIN))).toBeNull();
    expect(validatePassword("hunter22")).toBeNull();
  });

  it("does not trim — inner spaces still count toward the length", () => {
    expect(validatePassword("a b c ")).toBeNull();
  });

  it("rejects an empty or whitespace-only password", () => {
    expect(validatePassword("")).toBe("Password is required");
    expect(validatePassword("        ")).toBe("Password is required");
    expect(validatePassword(undefined)).toBe("Password is required");
  });

  it("rejects one character below the minimum", () => {
    expect(validatePassword("a".repeat(PASSWORD_MIN - 1))).toBe(
      `Password must be at least ${PASSWORD_MIN} characters`
    );
  });
});

describe("validatePasswordConfirmation", () => {
  it("accepts an exact match", () => {
    expect(validatePasswordConfirmation("hunter22", "hunter22")).toBeNull();
  });

  it("asks for a confirmation when it is empty", () => {
    expect(validatePasswordConfirmation("hunter22", "")).toBe("Please confirm your password");
    expect(validatePasswordConfirmation("hunter22", undefined)).toBe(
      "Please confirm your password"
    );
  });

  it("rejects a mismatch, including case and trailing whitespace", () => {
    expect(validatePasswordConfirmation("hunter22", "hunter23")).toBe("Passwords do not match");
    expect(validatePasswordConfirmation("hunter22", "Hunter22")).toBe("Passwords do not match");
    expect(validatePasswordConfirmation("hunter22", "hunter22 ")).toBe("Passwords do not match");
  });
});

describe("validateNoteContent", () => {
  it("accepts one character through the maximum", () => {
    expect(validateNoteContent("a")).toBeNull();
    expect(validateNoteContent("a".repeat(NOTE_MAX))).toBeNull();
  });

  it("rejects an empty or whitespace-only note", () => {
    const message = "Write something before you archive it";
    expect(validateNoteContent("")).toBe(message);
    expect(validateNoteContent("  \n\t ")).toBe(message);
    expect(validateNoteContent(undefined)).toBe(message);
  });

  it("rejects one character above the maximum", () => {
    expect(validateNoteContent("a".repeat(NOTE_MAX + 1))).toBe(
      `Note must be at most ${NOTE_MAX} characters`
    );
  });
});

describe("validateTags", () => {
  it("accepts no tags at all", () => {
    expect(validateTags(undefined)).toBeNull();
    expect(validateTags(null)).toBeNull();
    expect(validateTags([])).toBeNull();
  });

  it("accepts alphanumeric and hyphenated tags up to the maximum", () => {
    expect(validateTags(["late-night", "letters", "2am"])).toBeNull();
    expect(validateTags(Array.from({ length: TAGS_MAX }, (_, i) => `tag-${i}`))).toBeNull();
  });

  it("rejects one tag above the maximum", () => {
    expect(validateTags(Array.from({ length: TAGS_MAX + 1 }, (_, i) => `tag-${i}`))).toBe(
      `You can add at most ${TAGS_MAX} tags`
    );
  });

  it("rejects an empty or whitespace-only tag", () => {
    expect(validateTags(["ok", ""])).toBe("Tags cannot be empty");
    expect(validateTags(["ok", "   "])).toBe("Tags cannot be empty");
  });

  it("rejects characters outside the backend's pattern", () => {
    const message = "Tags can only contain alphanumeric characters and hyphens";
    expect(validateTags(["two words"])).toBe(message);
    expect(validateTags(["under_score"])).toBe(message);
    expect(validateTags(["hash#tag"])).toBe(message);
  });

  it("rejects a value that is not a list", () => {
    expect(validateTags("late-night")).toBe("Tags must be a list");
  });
});

describe("validateForm", () => {
  const rules = {
    username: validateUsername,
    email: validateEmail,
    password: validatePassword,
    confirm: (/** @type {unknown} */ value, /** @type {Record<string, unknown>} */ values) =>
      validatePasswordConfirmation(values.password, value),
  };

  it("returns an empty object when every rule passes", () => {
    expect(
      validateForm(
        {
          username: "quiet_ink",
          email: "q@example.com",
          password: "hunter22",
          confirm: "hunter22",
        },
        rules
      )
    ).toEqual({});
  });

  it("collects one message per failing field", () => {
    expect(
      validateForm({ username: "no", email: "nope", password: "short", confirm: "shore" }, rules)
    ).toEqual({
      username: `Username must be at least ${USERNAME_MIN} characters`,
      email: "Enter a valid email address",
      password: `Password must be at least ${PASSWORD_MIN} characters`,
      confirm: "Passwords do not match",
    });
  });

  it("only reports the fields it was given rules for", () => {
    expect(
      validateForm({ username: "quiet_ink", email: "nope" }, { email: validateEmail })
    ).toEqual({ email: "Enter a valid email address" });
  });

  it("treats a missing field as absent rather than skipping it", () => {
    expect(validateForm({}, { username: validateUsername })).toEqual({
      username: "Username is required",
    });
  });

  it("returns an empty object when there are no rules", () => {
    expect(validateForm({ username: "!!" }, {})).toEqual({});
  });
});
