import assert from "node:assert/strict";
import test from "node:test";

import {
  MIN_ACCOUNT_PASSWORD_LENGTH,
  interpretSignUpResult,
  isUserAlreadyRegisteredError,
  isValidAccountEmail,
  validateSignUpInput
} from "../services/domain/accountAuth";

test("sign-up validation enforces email shape and the Supabase password minimum", () => {
  assert.equal(MIN_ACCOUNT_PASSWORD_LENGTH, 6);

  assert.equal(validateSignUpInput("", "secret1", "secret1"), "email_required");
  assert.equal(validateSignUpInput("   ", "secret1", "secret1"), "email_required");
  assert.equal(validateSignUpInput("not-an-email", "secret1", "secret1"), "email_invalid");
  assert.equal(validateSignUpInput("owner@restaurant", "secret1", "secret1"), "email_invalid");
  assert.equal(validateSignUpInput("owner@restaurant.com", "12345", "12345"), "password_too_short");
  assert.equal(validateSignUpInput("owner@restaurant.com", "123456", "1234567"), "password_mismatch");
  assert.equal(validateSignUpInput("owner@restaurant.com", "123456", "123456"), null);
  assert.equal(validateSignUpInput("  owner@restaurant.com  ", "123456", "123456"), null);

  assert.ok(isValidAccountEmail("chef@bistro.co"));
  assert.ok(!isValidAccountEmail("chef@bistro"));
  assert.ok(!isValidAccountEmail(`${"a".repeat(250)}@x.com`));
});

test("sign-up responses map to session, confirmation, and already-registered outcomes", () => {
  assert.equal(
    interpretSignUpResult({ user: { identities: [{}] }, session: { access_token: "token" } }),
    "session_ready"
  );
  assert.equal(interpretSignUpResult({ user: { identities: [{}] }, session: null }), "confirmation_required");
  // Supabase returns an obfuscated user with no identities when the email is taken.
  assert.equal(interpretSignUpResult({ user: { identities: [] }, session: null }), "already_registered");
  assert.equal(interpretSignUpResult({ user: null, session: null }), "confirmation_required");
});

test("already-registered auth errors are recognized by code and message", () => {
  assert.ok(isUserAlreadyRegisteredError({ code: "user_already_exists", message: "" }));
  assert.ok(isUserAlreadyRegisteredError({ code: "email_exists", message: "" }));
  assert.ok(isUserAlreadyRegisteredError({ message: "User already registered" }));
  assert.ok(isUserAlreadyRegisteredError(new Error("A user with this email address has already been registered")));
  assert.ok(!isUserAlreadyRegisteredError(new Error("Invalid login credentials")));
  assert.ok(!isUserAlreadyRegisteredError(null));
  assert.ok(!isUserAlreadyRegisteredError("already registered"));
});
