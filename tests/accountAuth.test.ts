import assert from "node:assert/strict";
import test from "node:test";

import {
  MIN_ACCOUNT_PASSWORD_LENGTH,
  MAX_INVITE_PASSWORD_LENGTH,
  MIN_INVITE_PASSWORD_LENGTH,
  interpretSignUpResult,
  isUserAlreadyRegisteredError,
  isValidAccountEmail,
  parseInviteCallbackUrl,
  validateInvitePassword,
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

test("owner invite callbacks accept one complete invite session from the Mise route", () => {
  const fragment = parseInviteCallbackUrl(
    "mise://accept-invite#access_token=access-123&refresh_token=refresh-456&type=invite"
  );
  assert.deepEqual(fragment, {
    accessToken: "access-123",
    refreshToken: "refresh-456"
  });

  const query = parseInviteCallbackUrl(
    "mise://accept-invite?access_token=access-789&refresh_token=refresh-012&type=invite"
  );
  assert.deepEqual(query, {
    accessToken: "access-789",
    refreshToken: "refresh-012"
  });
});

test("owner invite callbacks fail closed on the wrong route, type, errors, or mixed credentials", () => {
  assert.equal(parseInviteCallbackUrl(""), "invite_callback_required");
  assert.equal(parseInviteCallbackUrl("not a URL"), "invite_callback_invalid");
  assert.equal(
    parseInviteCallbackUrl(
      "https://example.com/accept-invite#access_token=a&refresh_token=b&type=invite"
    ),
    "invite_callback_wrong_destination"
  );
  assert.equal(
    parseInviteCallbackUrl(
      "mise://accept-invite#access_token=a&refresh_token=b&type=recovery"
    ),
    "invite_callback_wrong_type"
  );
  assert.equal(
    parseInviteCallbackUrl("mise://accept-invite#error=access_denied&type=invite"),
    "invite_callback_rejected"
  );
  assert.equal(
    parseInviteCallbackUrl("mise://accept-invite#access_token=a&type=invite"),
    "invite_callback_incomplete"
  );
  assert.equal(
    parseInviteCallbackUrl(
      "mise://accept-invite?type=invite#access_token=a&refresh_token=b&type=invite"
    ),
    "invite_callback_mixed_credentials"
  );
});

test("invited owners choose a bounded matching password", () => {
  assert.equal(MIN_INVITE_PASSWORD_LENGTH, 12);
  assert.equal(MAX_INVITE_PASSWORD_LENGTH, 128);
  assert.equal(validateInvitePassword("short", "short"), "password_too_short");
  assert.equal(
    validateInvitePassword("a".repeat(129), "a".repeat(129)),
    "password_too_long"
  );
  assert.equal(
    validateInvitePassword("long-enough-password", "different-password"),
    "password_mismatch"
  );
  assert.equal(
    validateInvitePassword("long-enough-password", "long-enough-password"),
    null
  );
});
