import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

const rootUrl = new URL("../", import.meta.url);
const [easSource, telemetrySource, edgeSource, securitySource] = await Promise.all([
  readFile(new URL("eas.json", rootUrl), "utf8"),
  readFile(new URL("services/telemetry.ts", rootUrl), "utf8"),
  readFile(new URL("supabase/functions/_shared/mise.ts", rootUrl), "utf8"),
  readFile(new URL("services/domain/telemetrySecurity.ts", rootUrl), "utf8")
]);
const eas = JSON.parse(easSource);

for (const environment of ["development", "preview", "production"]) {
  if (eas.build?.[environment]?.environment !== environment) {
    throw new Error(`EAS ${environment} must select its own environment.`);
  }
}
for (const field of [
  "request_id",
  "operation_id",
  "restaurant_id",
  "authoritative_event_id",
  "release"
]) {
  if (!securitySource.includes(field)) {
    throw new Error(`The telemetry correlation contract must include ${field}.`);
  }
}
if (
  !telemetrySource.includes("buildTelemetryCorrelation(") ||
  !edgeSource.includes("buildTelemetryCorrelation(")
) {
  throw new Error("App and Edge telemetry must both use the shared correlation contract.");
}
if (!telemetrySource.includes("beforeSend: redactSentryEvent")) {
  throw new Error("Sentry must apply whole-event redaction.");
}

if (process.env.MISE_OBSERVABILITY_LIVE !== "1") {
  console.log(
    "Mise observability static check passed. Set MISE_OBSERVABILITY_LIVE=1 with staging provider proof credentials to verify live receipt."
  );
  process.exit(0);
}

const required = [
  "MISE_SENTRY_DSN",
  "MISE_SENTRY_AUTH_TOKEN",
  "MISE_SENTRY_ORG",
  "MISE_POSTHOG_PROJECT_KEY",
  "MISE_POSTHOG_HOST",
  "MISE_POSTHOG_PERSONAL_API_KEY",
  "MISE_POSTHOG_PROJECT_ID"
];
for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} is required for live observability proof.`);
}

const probeId = randomUUID();
const requestId = randomUUID();
const sentryEventId = randomUUID().replaceAll("-", "");
const release = process.env.MISE_RELEASE ?? "mise-staging-observability-proof";
const correlation = {
  app_env: "staging",
  release,
  operation: "observability_receipt_proof",
  request_id: requestId,
  operation_id: probeId,
  restaurant_id: "not_applicable",
  authoritative_event_id: "not_applicable"
};

await sendSentryProof(sentryEventId, correlation);
await sendPosthogProof(probeId, correlation);
const [sentryReceipt, posthogReceipt] = await Promise.all([
  waitForSentryReceipt(sentryEventId),
  waitForPosthogReceipt(probeId)
]);

console.log(
  JSON.stringify(
    {
      status: "passed",
      environment: "staging",
      release,
      request_id: requestId,
      operation_id: probeId,
      sentry_event_id: sentryReceipt,
      posthog_event_uuid: posthogReceipt,
      redaction_probe: "[redacted]"
    },
    null,
    2
  )
);

async function sendSentryProof(eventId, properties) {
  const dsn = new URL(process.env.MISE_SENTRY_DSN);
  const projectId = dsn.pathname.replaceAll("/", "");
  if (!projectId) throw new Error("MISE_SENTRY_DSN has no project ID.");
  const endpoint = `${dsn.protocol}//${dsn.host}/api/${projectId}/envelope/`;
  const event = {
    event_id: eventId,
    timestamp: new Date().toISOString(),
    platform: "javascript",
    level: "error",
    environment: "staging",
    release,
    exception: {
      values: [{ type: "MiseObservabilityProbe", value: "Mise operation failed." }]
    },
    tags: properties,
    extra: { ...properties, redaction_probe: "[redacted]" }
  };
  const envelope = [
    JSON.stringify({ sent_at: new Date().toISOString(), dsn: dsn.toString() }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event)
  ].join("\n");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-sentry-envelope" },
    body: envelope
  });
  if (!response.ok) throw new Error(`Sentry ingestion returned HTTP ${response.status}.`);
}

async function sendPosthogProof(id, properties) {
  const host = process.env.MISE_POSTHOG_HOST.replace(/\/$/, "");
  const response = await fetch(`${host}/capture/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.MISE_POSTHOG_PROJECT_KEY,
      event: "mise_beta_observability_proof",
      distinct_id: "mise_observability_probe",
      properties: {
        ...properties,
        probe_id: id,
        redaction_probe: "[redacted]",
        $lib: "mise-observability-proof"
      }
    })
  });
  if (!response.ok) throw new Error(`PostHog ingestion returned HTTP ${response.status}.`);
}

async function waitForSentryReceipt(eventId) {
  const apiBase = (process.env.MISE_SENTRY_API_BASE ?? "https://sentry.io").replace(/\/$/, "");
  const org = encodeURIComponent(process.env.MISE_SENTRY_ORG);
  return pollReceipt("Sentry", async () => {
    const response = await fetch(`${apiBase}/api/0/organizations/${org}/eventids/${eventId}/`, {
      headers: { authorization: `Bearer ${process.env.MISE_SENTRY_AUTH_TOKEN}` }
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Sentry receipt query returned HTTP ${response.status}.`);
    const body = await response.json();
    return body?.event?.eventID ?? body?.event?.id ?? eventId;
  });
}

async function waitForPosthogReceipt(probeId) {
  const host = process.env.MISE_POSTHOG_HOST.replace(/\/$/, "");
  const projectId = encodeURIComponent(process.env.MISE_POSTHOG_PROJECT_ID);
  return pollReceipt("PostHog", async () => {
    const response = await fetch(`${host}/api/projects/${projectId}/query/`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.MISE_POSTHOG_PERSONAL_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        query: {
          kind: "HogQLQuery",
          query:
            "select uuid, properties.redaction_probe from events where event = {event} and properties.probe_id = {probe} order by timestamp desc limit 1",
          values: {
            event: "mise_beta_observability_proof",
            probe: probeId
          }
        }
      })
    });
    if (!response.ok) throw new Error(`PostHog receipt query returned HTTP ${response.status}.`);
    const body = await response.json();
    const row = body?.results?.[0];
    if (!row) return null;
    if (row[1] !== "[redacted]") throw new Error("PostHog redaction proof was not preserved.");
    return row[0];
  });
}

async function pollReceipt(provider, lookup) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const receipt = await lookup();
    if (receipt) return receipt;
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new Error(`${provider} did not expose the controlled event within 30 seconds.`);
}
