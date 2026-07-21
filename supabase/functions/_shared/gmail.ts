// Gmail OAuth and delivery helpers shared by backend-only Edge Functions.
// This module deliberately has no Expo imports and never persists access tokens.

export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
export const GOOGLE_OAUTH_SCOPES = [
  "openid",
  "email",
  GMAIL_SEND_SCOPE,
] as const;
export const GOOGLE_AUTHORIZATION_ENDPOINT =
  "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
export const GOOGLE_REVOCATION_ENDPOINT =
  "https://oauth2.googleapis.com/revoke";
export const GOOGLE_USERINFO_ENDPOINT =
  "https://openidconnect.googleapis.com/v1/userinfo";
export const GMAIL_SEND_ENDPOINT =
  "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

const MAX_PROVIDER_RESPONSE_BYTES = 64 * 1024;
const MAX_EMAIL_BODY_BYTES = 64 * 1024;
const EMAIL_PATTERN =
  /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;

export type GmailFailureDisposition = "rejected" | "reauthorize" | "ambiguous";

export class GoogleProviderError extends Error {
  constructor(
    public readonly safeCode: string,
    public readonly disposition: GmailFailureDisposition,
    public readonly status: number,
  ) {
    super("Google provider request failed.");
    this.name = "GoogleProviderError";
  }
}

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GoogleTokenSet {
  accessToken: string;
  refreshToken: string | null;
  expiresInSeconds: number;
  grantedScopes: string[];
}

export interface GoogleIdentity {
  subject: string;
  email: string;
  emailVerified: boolean;
  hostedDomain: string | null;
}

export interface GmailMessageInput {
  from: string;
  to: string;
  subject: string;
  textBody: string;
  messageId: string;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)),
    );
  }
  return btoa(binary);
}

export function bytesToBase64Url(bytes: Uint8Array) {
  return bytesToBase64(bytes)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

export function randomBase64Url(byteLength: number) {
  if (
    !Number.isSafeInteger(byteLength) ||
    byteLength < 16 ||
    byteLength > 128
  ) {
    throw new Error("Random token length is outside the supported boundary.");
  }
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export async function sha256Base64Url(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return bytesToBase64Url(new Uint8Array(digest));
}

export async function sha256Hex(value: string) {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function buildGoogleAuthorizationUrl(
  config: Pick<GoogleOAuthConfig, "clientId" | "redirectUri">,
  state: string,
  codeChallenge: string,
) {
  requireBoundedString(config.clientId, "clientId", 512);
  requireHttpsUrl(config.redirectUri, "redirectUri");
  requireOpaqueToken(state, "state", 32, 512);
  requireOpaqueToken(codeChallenge, "codeChallenge", 32, 128);

  const url = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_OAUTH_SCOPES.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent select_account");
  url.searchParams.set("include_granted_scopes", "false");
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export async function exchangeGoogleAuthorizationCode(
  config: GoogleOAuthConfig,
  code: string,
  codeVerifier: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GoogleTokenSet> {
  requireGoogleOAuthConfig(config);
  requireOpaqueToken(code, "authorization code", 8, 4096);
  requireOpaqueToken(codeVerifier, "code verifier", 43, 128);

  const response = await fetchImpl(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
      code,
      code_verifier: codeVerifier,
    }),
  });
  const payload = await readProviderJson(response);
  if (!response.ok) throw tokenEndpointError(response.status, payload);
  return parseTokenSet(payload, true);
}

export async function refreshGoogleAccessToken(
  config: GoogleOAuthConfig,
  refreshToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GoogleTokenSet> {
  requireGoogleOAuthConfig(config);
  requireOpaqueToken(refreshToken, "refresh credential", 8, 4096);

  const response = await fetchImpl(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const payload = await readProviderJson(response);
  if (!response.ok) throw tokenEndpointError(response.status, payload);
  return parseTokenSet(payload, false);
}

export async function fetchGoogleIdentity(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GoogleIdentity> {
  requireOpaqueToken(accessToken, "access credential", 8, 4096);
  const response = await fetchImpl(GOOGLE_USERINFO_ENDPOINT, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json",
    },
  });
  const payload = await readProviderJson(response);
  if (!response.ok) throw providerHttpError(response.status, "userinfo_failed");

  const subject = stringField(payload, "sub", 255);
  const email = normalizeEmail(stringField(payload, "email", 254));
  if (payload.email_verified !== true) {
    throw new GoogleProviderError("google_email_unverified", "rejected", 422);
  }
  return {
    subject,
    email,
    emailVerified: true,
    hostedDomain:
      typeof payload.hd === "string" && payload.hd.length <= 255
        ? payload.hd
        : null,
  };
}

export async function revokeGoogleCredential(
  token: string,
  fetchImpl: typeof fetch = fetch,
) {
  requireOpaqueToken(token, "refresh credential", 8, 4096);
  const response = await fetchImpl(GOOGLE_REVOCATION_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  });
  if (response.ok) return { revoked: true, alreadyInvalid: false } as const;

  const payload = await readProviderJson(response);
  if (response.status === 400 && payload.error === "invalid_token") {
    return { revoked: true, alreadyInvalid: true } as const;
  }
  throw providerHttpError(response.status, "revocation_failed");
}

export function buildGmailRawMessage(input: GmailMessageInput) {
  const from = normalizeEmail(input.from);
  const to = normalizeEmail(input.to);
  const messageId = requireMessageId(input.messageId);
  const subject = sanitizeHeader(input.subject, 500);
  const bodyBytes = new TextEncoder().encode(input.textBody);
  if (bodyBytes.byteLength < 1 || bodyBytes.byteLength > MAX_EMAIL_BODY_BYTES) {
    throw new Error("Email body is outside the supported boundary.");
  }

  const encodedSubject = `=?UTF-8?B?${bytesToBase64(new TextEncoder().encode(subject))}?=`;
  const normalizedBody = input.textBody.replace(/\r?\n/gu, "\r\n");
  const mime = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    `Message-ID: ${messageId}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    normalizedBody,
  ].join("\r\n");
  return bytesToBase64Url(new TextEncoder().encode(mime));
}

export async function sendGmailMessage(
  accessToken: string,
  rawMessage: string,
  fetchImpl: typeof fetch = fetch,
) {
  requireOpaqueToken(accessToken, "access credential", 8, 4096);
  requireOpaqueToken(rawMessage, "raw message", 16, 200_000);
  const response = await fetchImpl(GMAIL_SEND_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json; charset=utf-8",
      accept: "application/json",
    },
    body: JSON.stringify({ raw: rawMessage }),
  });
  const payload = await readProviderJson(response);
  if (!response.ok)
    throw providerHttpError(response.status, "gmail_send_failed");
  return {
    id: stringField(payload, "id", 512),
    threadId:
      typeof payload.threadId === "string" && payload.threadId.length <= 512
        ? payload.threadId
        : null,
  };
}

export function gmailMessageId(orderId: string, domain = "mail.mise.app") {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      orderId,
    )
  ) {
    throw new Error("Order id must be a UUID.");
  }
  if (!/^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/iu.test(domain)) {
    throw new Error("Message id domain is invalid.");
  }
  return `<mise-${orderId.toLowerCase()}@${domain.toLowerCase()}>`;
}

function parseTokenSet(
  payload: Record<string, unknown>,
  requireRefreshToken: boolean,
): GoogleTokenSet {
  const accessToken = stringField(payload, "access_token", 4096);
  const refreshToken =
    typeof payload.refresh_token === "string" ? payload.refresh_token : null;
  if (requireRefreshToken && (!refreshToken || refreshToken.length > 4096)) {
    throw new GoogleProviderError(
      "refresh_credential_missing",
      "reauthorize",
      422,
    );
  }
  const expiresInSeconds = Number(payload.expires_in);
  if (
    !Number.isSafeInteger(expiresInSeconds) ||
    expiresInSeconds < 1 ||
    expiresInSeconds > 86_400
  ) {
    throw new GoogleProviderError("token_response_invalid", "reauthorize", 502);
  }
  const grantedScopes =
    typeof payload.scope === "string"
      ? payload.scope.split(/\s+/u).filter(Boolean)
      : [];
  if (!grantedScopes.includes(GMAIL_SEND_SCOPE)) {
    throw new GoogleProviderError(
      "gmail_send_scope_missing",
      "reauthorize",
      403,
    );
  }
  return { accessToken, refreshToken, expiresInSeconds, grantedScopes };
}

function requireGoogleOAuthConfig(config: GoogleOAuthConfig) {
  requireBoundedString(config.clientId, "clientId", 512);
  requireBoundedString(config.clientSecret, "clientSecret", 4096);
  requireHttpsUrl(config.redirectUri, "redirectUri");
}

function tokenEndpointError(status: number, payload: Record<string, unknown>) {
  const providerCode =
    typeof payload.error === "string" ? payload.error : "token_exchange_failed";
  const reauthorize =
    providerCode === "invalid_grant" || providerCode === "unauthorized_client";
  return new GoogleProviderError(
    reauthorize
      ? "google_reauthorization_required"
      : "google_token_exchange_failed",
    reauthorize
      ? "reauthorize"
      : status >= 500 || status === 429
        ? "ambiguous"
        : "rejected",
    status,
  );
}

function providerHttpError(status: number, fallbackCode: string) {
  if (status === 401)
    return new GoogleProviderError(
      "google_reauthorization_required",
      "reauthorize",
      status,
    );
  if (status === 408 || status === 429 || status >= 500) {
    return new GoogleProviderError(
      `${fallbackCode}_ambiguous`,
      "ambiguous",
      status,
    );
  }
  return new GoogleProviderError(fallbackCode, "rejected", status);
}

async function readProviderJson(
  response: Response,
): Promise<Record<string, unknown>> {
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_PROVIDER_RESPONSE_BYTES
  ) {
    throw new GoogleProviderError(
      "provider_response_too_large",
      "ambiguous",
      502,
    );
  }
  if (!response.body) return {};

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_PROVIDER_RESPONSE_BYTES) {
      await reader.cancel("provider response too large");
      throw new GoogleProviderError(
        "provider_response_too_large",
        "ambiguous",
        502,
      );
    }
    chunks.push(value);
  }
  if (received === 0) return {};
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function normalizeEmail(value: string) {
  const email = sanitizeHeader(value, 254).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw new Error("Email address is invalid.");
  return email;
}

function sanitizeHeader(value: string, maximumLength: number) {
  const sanitized = requireBoundedString(value, "header", maximumLength)
    .replace(/[\r\n]+/gu, " ")
    .trim();
  if (!sanitized) throw new Error("Email header is invalid.");
  return sanitized;
}

function requireMessageId(value: string) {
  const messageId = sanitizeHeader(value, 512);
  if (!/^<[^<>\s@]+@[^<>\s@]+>$/u.test(messageId))
    throw new Error("Message id is invalid.");
  return messageId;
}

function stringField(
  payload: Record<string, unknown>,
  field: string,
  maximumLength: number,
) {
  const value = payload[field];
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > maximumLength
  ) {
    throw new GoogleProviderError(
      "provider_response_invalid",
      "ambiguous",
      502,
    );
  }
  return value;
}

function requireBoundedString(
  value: string,
  field: string,
  maximumLength: number,
) {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > maximumLength
  ) {
    throw new Error(`${field} is outside the supported boundary.`);
  }
  return value;
}

function requireOpaqueToken(
  value: string,
  field: string,
  minimumLength: number,
  maximumLength: number,
) {
  requireBoundedString(value, field, maximumLength);
  if (value.length < minimumLength || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new Error(`${field} is invalid.`);
  }
  return value;
}

function requireHttpsUrl(value: string, field: string) {
  const url = new URL(requireBoundedString(value, field, 2048));
  if (url.protocol !== "https:" || url.username || url.password || url.hash) {
    throw new Error(
      `${field} must be an HTTPS URL without credentials or a fragment.`,
    );
  }
  return url.toString();
}
