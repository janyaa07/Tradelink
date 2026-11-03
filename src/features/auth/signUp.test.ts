import { describe, expect, it } from "vitest";
import { readSignUpForm, SIGN_UP_MESSAGES, signUpMetadata, signUpOutcome, validateSignUp, welcomeToast } from "./signUp";

const valid = {
  kind: "buyer",
  businessName: "  Kopi Corner  ",
  fullName: "Mei Ling Tan",
  phone: "+65 9123 4567",
  email: " mei@kopicorner.sg ",
  password: "correct horse battery",
  confirm: "correct horse battery",
};

function errorFor(overrides: Partial<Record<keyof typeof valid, unknown>>) {
  const result = validateSignUp({ ...valid, ...overrides });
  if (result.ok) throw new Error("expected the form to be invalid");
  return result;
}

describe("validateSignUp", () => {
  it("accepts a valid buyer and trims text fields", () => {
    const result = validateSignUp(valid);
    expect(result).toEqual({
      ok: true,
      data: {
        kind: "buyer",
        businessName: "Kopi Corner",
        fullName: "Mei Ling Tan",
        phone: "+65 9123 4567",
        email: "mei@kopicorner.sg",
        password: "correct horse battery",
        confirm: "correct horse battery",
      },
    });
  });

  it("accepts a supplier without a phone, which is stored as null", () => {
    const result = validateSignUp({ ...valid, kind: "supplier", phone: "   " });
    expect(result.ok && result.data.kind).toBe("supplier");
    expect(result.ok && result.data.phone).toBeNull();
  });

  it.each(["platform", "admin", "", null])("rejects the account type %j", (kind) => {
    expect(errorFor({ kind })).toEqual({ ok: false, error: SIGN_UP_MESSAGES.kind, invalid: ["kind"] });
  });

  it.each(["A", " B ", "x".repeat(121)])("rejects the business name %j", (businessName) => {
    expect(errorFor({ businessName })).toEqual({ ok: false, error: SIGN_UP_MESSAGES.businessName, invalid: ["businessName"] });
  });

  it("accepts business and full names of exactly 2 and 120 characters", () => {
    expect(validateSignUp({ ...valid, businessName: "AB", fullName: "y".repeat(120) }).ok).toBe(true);
  });

  it("rejects a short or long name", () => {
    expect(errorFor({ fullName: "Z" }).error).toBe(SIGN_UP_MESSAGES.fullName);
    expect(errorFor({ fullName: "z".repeat(121) }).invalid).toEqual(["fullName"]);
  });

  it.each(["91234567", "+6591234567", "+65 9123 4567", "1234 5678 9012"])("accepts the phone %j", (phone) => {
    expect(validateSignUp({ ...valid, phone }).ok).toBe(true);
  });

  it.each(["1234567", "+65-9123-4567", "phone 91234567", "12345678901234567", "1234 5678 9012 34", "++6591234567"])("rejects the phone %j", (phone) => {
    expect(errorFor({ phone })).toEqual({ ok: false, error: SIGN_UP_MESSAGES.phone, invalid: ["phone"] });
  });

  it.each(["", "mei", "mei@", "@kopicorner.sg"])("rejects the email %j", (email) => {
    expect(errorFor({ email })).toEqual({ ok: false, error: SIGN_UP_MESSAGES.email, invalid: ["email"] });
  });

  it("needs a password of at least 12 characters", () => {
    expect(errorFor({ password: "short pass1", confirm: "short pass1" })).toEqual({
      ok: false,
      error: "Use at least 12 characters.",
      invalid: ["password"],
    });
    expect(validateSignUp({ ...valid, password: "twelve chars", confirm: "twelve chars" }).ok).toBe(true);
  });

  it("allows at most 72 bytes, the bcrypt limit", () => {
    expect(validateSignUp({ ...valid, password: "a".repeat(72), confirm: "a".repeat(72) }).ok).toBe(true);
    expect(errorFor({ password: "a".repeat(73), confirm: "a".repeat(73) }).error).toBe("Use 72 characters or fewer.");
  });

  it("needs the confirmation to match", () => {
    expect(errorFor({ confirm: "correct horse battery!" })).toEqual({
      ok: false,
      error: "The passwords do not match.",
      invalid: ["confirm"],
    });
  });

  it("puts every fix in one message, in form order", () => {
    const result = errorFor({ kind: "", businessName: "", email: "nope", confirm: "different" });
    expect(result.invalid).toEqual(["kind", "businessName", "email", "confirm"]);
    expect(result.error).toBe(
      [SIGN_UP_MESSAGES.kind, SIGN_UP_MESSAGES.businessName, SIGN_UP_MESSAGES.email, SIGN_UP_MESSAGES.confirm].join(" "),
    );
  });
});

describe("readSignUpForm", () => {
  it("reads every field and turns missing ones into empty strings", () => {
    const form = new FormData();
    form.set("kind", "supplier");
    form.set("email", "a@b.co");
    expect(readSignUpForm(form)).toEqual({
      kind: "supplier",
      businessName: "",
      fullName: "",
      phone: "",
      email: "a@b.co",
      password: "",
      confirm: "",
    });
  });
});

describe("signUpMetadata", () => {
  it("sends only the tl_ keys the database trigger reads", () => {
    const result = validateSignUp({ ...valid, phone: "" });
    if (!result.ok) throw new Error("expected valid");
    expect(signUpMetadata(result.data)).toEqual({
      tl_kind: "buyer",
      tl_business_name: "Kopi Corner",
      tl_full_name: "Mei Ling Tan",
      tl_phone: null,
    });
  });
});

describe("copy", () => {
  it("matches the agreed messages", () => {
    expect(welcomeToast("Kopi Corner")).toBe("Welcome to Tradelink, Kopi Corner.");
    expect(SIGN_UP_MESSAGES.checkEmail).toBe("Check your email to confirm your account, then sign in.");
    expect(SIGN_UP_MESSAGES.alreadyRegistered).toBe("An account with this email already exists. Sign in instead.");
    expect(SIGN_UP_MESSAGES.businessNameTaken).toBe(
      "We could not create this account. That business name may already be in use. Try another name.",
    );
    expect(SIGN_UP_MESSAGES.rateLimited).toBe("Too many attempts. Try again in a few minutes.");
  });
});

describe("signUpOutcome", () => {
  const user = { identities: [{ id: "identity" }] };

  it("signs the user in when a session is returned", () => {
    expect(signUpOutcome({ data: { user, session: { access_token: "t" } }, error: null })).toEqual({ kind: "signedIn" });
  });

  it("asks the user to confirm their email when there is no session", () => {
    expect(signUpOutcome({ data: { user, session: null }, error: null })).toEqual({
      kind: "confirmEmail",
      message: SIGN_UP_MESSAGES.checkEmail,
    });
  });

  it("treats a user with no identities as an existing account", () => {
    expect(signUpOutcome({ data: { user: { identities: [] }, session: null }, error: null })).toMatchObject({
      kind: "error",
      reason: "already_registered",
      message: SIGN_UP_MESSAGES.alreadyRegistered,
      invalid: ["email"],
    });
  });

  it.each([
    { code: "user_already_exists", status: 422 },
    { code: "email_exists", status: 422 },
    { message: "User already registered", status: 400 },
  ])("treats %j as an existing account", (error) => {
    expect(signUpOutcome({ data: { user: null, session: null }, error })).toMatchObject({
      reason: "already_registered",
      message: SIGN_UP_MESSAGES.alreadyRegistered,
    });
  });

  it.each([
    { code: "unexpected_failure", status: 500, message: "Database error saving new user" },
    { status: 500, message: "Database error saving new user" },
  ])("treats a database error %j as a business name that may be taken", (error) => {
    expect(signUpOutcome({ data: { user: null, session: null }, error })).toEqual({
      kind: "error",
      reason: "business_name_taken",
      message: SIGN_UP_MESSAGES.businessNameTaken,
      invalid: ["businessName"],
    });
  });

  it.each([{ status: 429 }, { code: "over_email_send_rate_limit", status: 400 }, { code: "over_request_rate_limit" }])(
    "treats %j as rate limited",
    (error) => {
      expect(signUpOutcome({ data: null, error })).toEqual({
        kind: "error",
        reason: "rate_limited",
        message: SIGN_UP_MESSAGES.rateLimited,
        invalid: [],
      });
    },
  );

  it("explains a weak or leaked password", () => {
    expect(signUpOutcome({ data: null, error: { code: "weak_password", status: 422 } })).toMatchObject({
      reason: "weak_password",
      message: SIGN_UP_MESSAGES.weakPassword,
      invalid: ["password"],
    });
  });

  it("falls back to a generic message for anything else", () => {
    expect(signUpOutcome({ data: null, error: { code: "signup_disabled", status: 422 } })).toMatchObject({
      reason: "unknown",
      message: SIGN_UP_MESSAGES.failed,
    });
    expect(signUpOutcome({ data: { user: null, session: null }, error: null })).toMatchObject({ reason: "unknown" });
  });
});
