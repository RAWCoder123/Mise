import {
  TELEMETRY_MAX_PAYLOAD_BYTES,
  safeExternalError,
  sanitizeTelemetryRecord,
  telemetryPayloadFits,
  type SafeTelemetryValue
} from "./domain/telemetrySecurity";

type JsonValue = SafeTelemetryValue;

export type MiseAnalyticsEvent =
  | "setup_completed"
  | "inventory_item_added"
  | "recipe_mapped"
  | "recommendation_approved"
  | "recommendation_dismissed"
  | "recommendation_undo"
  | "order_copied"
  | "email_setup_started";

export type TelemetryProperties = Record<string, JsonValue | undefined>;

interface SentryExceptionEntry {
  type?: string;
  value?: string;
}

interface SentryEventShape {
  level?: string;
  exception?: { values?: SentryExceptionEntry[] };
  tags?: Record<string, string>;
  extra?: Record<string, JsonValue>;
  user?: unknown;
  request?: unknown;
  breadcrumbs?: unknown;
}

interface SentryModule {
  init(options: {
    dsn: string;
    environment: string;
    sendDefaultPii: boolean;
    maxBreadcrumbs: number;
    beforeSend: (event: SentryEventShape) => SentryEventShape;
  }): void;
  captureEvent(event: SentryEventShape): unknown;
}

interface PosthogClient {
  capture(event: string, properties?: Record<string, JsonValue>): unknown;
}

interface PosthogModule {
  PostHog: new (apiKey: string, options: { host: string }) => PosthogClient;
}

let telemetryInitialized = false;
let sentrySdk: SentryModule | null = null;
let posthogSdk: PosthogClient | null = null;

/**
 * Initializes the official Sentry and PostHog SDKs when their env vars are
 * present. Must be called once at app start (app/_layout.tsx). Without env
 * vars this is a no-op, so demo mode and local dev need zero configuration
 * and make zero telemetry network calls. The SDKs are loaded lazily so this
 * module stays importable in non-React-Native runtimes (Node test runner),
 * where the raw fetch fallbacks below are used instead.
 */
export function initMiseTelemetry() {
  if (telemetryInitialized) return;
  telemetryInitialized = true;

  const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (sentryDsn) {
    try {
      const sentry = require("@sentry/react-native") as SentryModule;
      sentry.init({
        dsn: sentryDsn,
        environment: process.env.EXPO_PUBLIC_APP_ENV ?? "development",
        sendDefaultPii: false,
        maxBreadcrumbs: 0,
        beforeSend: redactSentryEvent
      });
      sentrySdk = sentry;
    } catch {
      sentrySdk = null;
    }
  }

  const posthogKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
  const posthogHost = normalizePosthogHost(process.env.EXPO_PUBLIC_POSTHOG_HOST);
  if (posthogKey && posthogHost) {
    try {
      const { PostHog } = require("posthog-react-native") as PosthogModule;
      posthogSdk = new PostHog(posthogKey, { host: posthogHost });
    } catch {
      posthogSdk = null;
    }
  }
}

export function sanitizeTelemetryProperties(properties: TelemetryProperties = {}): Record<string, JsonValue> {
  return sanitizeTelemetryRecord(properties);
}

export function trackMiseEvent(name: MiseAnalyticsEvent, properties: TelemetryProperties = {}) {
  const posthogKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
  const posthogHost = normalizePosthogHost(process.env.EXPO_PUBLIC_POSTHOG_HOST);
  const payload = sanitizeTelemetryProperties({
    ...properties,
    app_env: process.env.EXPO_PUBLIC_APP_ENV ?? "development"
  });

  if (!posthogKey || !posthogHost) return;

  if (posthogSdk) {
    const bounded = telemetryPayloadFits(payload) ? payload : { telemetry_truncated: true };
    try {
      posthogSdk.capture(name, bounded);
    } catch {
      // Analytics must never break app flows.
    }
    return;
  }

  const distinctId = typeof payload.restaurant_id === "string" ? payload.restaurant_id : "anonymous_operator";
  let body = JSON.stringify({
    api_key: posthogKey,
    event: name,
    distinct_id: distinctId,
    properties: payload
  });
  if (!telemetryPayloadFits(body)) {
    body = JSON.stringify({
      api_key: posthogKey,
      event: name,
      distinct_id: "anonymous_operator",
      properties: { telemetry_truncated: true }
    });
  }
  if (!telemetryPayloadFits(body)) return;

  void fetch(`${posthogHost}/capture/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body
  }).catch(() => undefined);
}

export function captureMiseError(error: unknown, context: TelemetryProperties = {}) {
  const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  const sanitizedContext = sanitizeTelemetryProperties(context);

  if (!sentryDsn) {
    if (process.env.EXPO_PUBLIC_APP_ENV !== "production") {
      console.warn("Mise captured an app error", error);
    }
    return;
  }

  const externalError = safeExternalError(error);
  const sentryEvent: SentryEventShape = {
    level: "error",
    exception: {
      values: [
        {
          type: externalError.type,
          value: externalError.value
        }
      ]
    },
    tags: {
      app_env: process.env.EXPO_PUBLIC_APP_ENV ?? "development"
    },
    extra: externalError.code
      ? sanitizeTelemetryProperties({ ...sanitizedContext, error_code: externalError.code })
      : sanitizedContext
  };

  if (sentrySdk) {
    const bounded = telemetryPayloadFits(sentryEvent)
      ? sentryEvent
      : { ...sentryEvent, extra: { telemetry_truncated: true } };
    try {
      sentrySdk.captureEvent(bounded);
    } catch {
      // Error reporting must never break app flows.
    }
    return;
  }

  const endpoint = sentryEnvelopeEndpoint(sentryDsn);
  if (!endpoint) return;

  const event = {
    event_id: randomEventId(),
    timestamp: new Date().toISOString(),
    platform: "javascript",
    ...sentryEvent
  };

  let envelope = [
    JSON.stringify({ sent_at: new Date().toISOString(), dsn: sentryDsn }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event)
  ].join("\n");
  if (!telemetryPayloadFits(envelope)) {
    envelope = [
      JSON.stringify({ sent_at: new Date().toISOString(), dsn: sentryDsn }),
      JSON.stringify({ type: "event" }),
      JSON.stringify({ ...event, extra: { telemetry_truncated: true } })
    ].join("\n");
  }
  if (!telemetryPayloadFits(envelope)) return;

  void fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-sentry-envelope" },
    body: envelope
  }).catch(() => undefined);
}

/**
 * The Sentry SDK auto-captures unhandled errors whose raw messages we never
 * control. Mirror the manual redaction guarantees on every outgoing event:
 * no raw error messages, no user/request context.
 */
function redactSentryEvent(event: SentryEventShape): SentryEventShape {
  for (const entry of event.exception?.values ?? []) {
    const probe = new Error();
    probe.name = entry.type ?? "Error";
    const safe = safeExternalError(probe);
    entry.type = safe.type;
    entry.value = safe.value;
  }
  delete event.user;
  delete event.request;
  delete event.breadcrumbs;
  return event;
}

function normalizePosthogHost(value: string | undefined) {
  if (!value) return null;
  return value.replace(/\/$/, "");
}

function sentryEnvelopeEndpoint(dsn: string) {
  if (dsn.length > TELEMETRY_MAX_PAYLOAD_BYTES / 2) return null;
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace("/", "");
    if (!projectId) return null;
    return `${url.protocol}//${url.host}/api/${projectId}/envelope/`;
  } catch {
    return null;
  }
}

function randomEventId() {
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}
