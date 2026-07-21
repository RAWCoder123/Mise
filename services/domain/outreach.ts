export const OUTREACH_DAILY_SEND_LIMIT_MAX = 50;
export const OUTREACH_FOLLOW_UP_MAX = 2;
export const OUTREACH_BATCH_SIZE_MAX = 25;

export type OutreachContactBasis = "public_business_contact" | "referral" | "opt_in";
export type OutreachProviderEventType =
  | "email.bounced"
  | "email.complained"
  | "email.delivered"
  | "email.failed"
  | "email.received"
  | "email.sent"
  | "email.suppressed";

export interface OutreachLeadInput {
  businessName: string;
  email: string;
  sourceUrl: string;
  contactBasis: OutreachContactBasis;
  contactName?: string | null;
  city?: string | null;
  state?: string | null;
  cuisine?: string | null;
  website?: string | null;
  fitNotes?: string | null;
}

export interface NormalizedOutreachLead {
  businessName: string;
  email: string;
  sourceUrl: string;
  contactBasis: OutreachContactBasis;
  contactName: string | null;
  city: string | null;
  state: string | null;
  cuisine: string | null;
  website: string | null;
  fitNotes: string | null;
}

export interface OutreachSendPolicy {
  timezone: string;
  sendWindowStartHour: number;
  sendWindowEndHour: number;
  sendWeekdays: number[];
}

export interface OutreachRenderInput {
  draft: RenderableOutreachDraft;
  companyName: string;
  postalAddress: string;
  unsubscribeUrl: string;
  ctaUrl?: string | null;
}

export interface RenderableOutreachDraft {
  subject: string;
  body: string;
  personalizationNote: string;
}

export function normalizeOutreachEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeOutreachLead(input: OutreachLeadInput): NormalizedOutreachLead {
  const businessName = requireText(input.businessName, "businessName", 160);
  const email = normalizeOutreachEmail(requireText(input.email, "email", 320));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("email must be a valid email address.");

  const sourceUrl = requireHttpUrl(input.sourceUrl, "sourceUrl");
  const website = optionalHttpUrl(input.website, "website");
  if (!(["public_business_contact", "referral", "opt_in"] as const).includes(input.contactBasis)) {
    throw new Error("contactBasis is not supported.");
  }

  return {
    businessName,
    email,
    sourceUrl,
    contactBasis: input.contactBasis,
    contactName: optionalText(input.contactName, "contactName", 120),
    city: optionalText(input.city, "city", 120),
    state: optionalText(input.state, "state", 80),
    cuisine: optionalText(input.cuisine, "cuisine", 120),
    website,
    fitNotes: optionalText(input.fitNotes, "fitNotes", 500)
  };
}

export function buildFallbackOutreachDraft(input: {
  businessName: string;
  contactName?: string | null;
  city?: string | null;
  valueProposition: string;
  sequenceNumber: number;
}): RenderableOutreachDraft {
  const greeting = input.contactName ? `Hi ${firstName(input.contactName)},` : `Hi ${input.businessName} team,`;
  const localContext = input.city ? ` for independent restaurants in ${input.city}` : " for independent restaurants";

  if (input.sequenceNumber > 0) {
    return {
      subject: `Quick follow-up from Mise for ${input.businessName}`.slice(0, 78),
      body: [
        greeting,
        "",
        `I wanted to follow up on Mise, a mobile-first operations workspace${localContext}.`,
        input.valueProposition,
        "",
        "Would a short walkthrough be useful?",
        "",
        "Best,",
        "The Mise team"
      ].join("\n"),
      personalizationNote: input.city ? `Used the supplied city (${input.city}).` : "Used only supplied business details."
    };
  }

  return {
    subject: `A simpler daily ops rhythm for ${input.businessName}`.slice(0, 78),
    body: [
      greeting,
      "",
      `I’m reaching out from Mise, a mobile-first operations workspace${localContext}.`,
      input.valueProposition,
      "",
      "Would a short walkthrough be useful?",
      "",
      "Best,",
      "The Mise team"
    ].join("\n"),
    personalizationNote: input.city ? `Used the supplied city (${input.city}).` : "Used only supplied business details."
  };
}

export function renderOutreachEmail(input: OutreachRenderInput) {
  const complianceText = [
    `This is a commercial message from ${input.companyName}.`,
    input.postalAddress,
    `Unsubscribe: ${input.unsubscribeUrl}`
  ].join("\n");
  const ctaText = input.ctaUrl ? `\n\nLearn more: ${input.ctaUrl}` : "";
  const text = `${input.draft.body}${ctaText}\n\n---\n${complianceText}`;

  const bodyHtml = escapeHtml(input.draft.body).replaceAll("\n", "<br />");
  const ctaHtml = input.ctaUrl
    ? `<p><a href="${escapeHtml(input.ctaUrl)}">Learn more about Mise</a></p>`
    : "";
  const html = [
    `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">`,
    `<p>${bodyHtml}</p>`,
    ctaHtml,
    `<hr style="border:0;border-top:1px solid #ddd;margin:24px 0 16px" />`,
    `<p style="font-size:12px;color:#666">This is a commercial message from ${escapeHtml(input.companyName)}.<br />`,
    `${escapeHtml(input.postalAddress)}<br />`,
    `<a href="${escapeHtml(input.unsubscribeUrl)}">Unsubscribe from future Mise marketing emails</a></p>`,
    `</div>`
  ].join("");

  return { text, html };
}

export function isWithinOutreachSendWindow(now: Date, policy: OutreachSendPolicy) {
  if (!Number.isInteger(policy.sendWindowStartHour) || !Number.isInteger(policy.sendWindowEndHour)) return false;
  if (policy.sendWindowStartHour < 0 || policy.sendWindowEndHour > 24) return false;
  if (policy.sendWindowStartHour >= policy.sendWindowEndHour) return false;

  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: policy.timezone,
      hour: "2-digit",
      hourCycle: "h23",
      weekday: "short"
    }).formatToParts(now);
  } catch {
    return false;
  }

  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const weekday = weekdayNumber(parts.find((part) => part.type === "weekday")?.value);
  return (
    Number.isInteger(hour) &&
    weekday !== null &&
    policy.sendWeekdays.includes(weekday) &&
    hour >= policy.sendWindowStartHour &&
    hour < policy.sendWindowEndHour
  );
}

export function suppressionReasonForProviderEvent(type: string) {
  if (type === "email.bounced") return "hard_bounce";
  if (type === "email.complained") return "spam_complaint";
  if (type === "email.suppressed") return "provider_suppression";
  return null;
}

function firstName(value: string) {
  return value.trim().split(/\s+/)[0]?.slice(0, 80) || "there";
}

function weekdayNumber(value: string | undefined) {
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return value && value in weekdays ? weekdays[value]! : null;
}

function requireText(value: unknown, fieldName: string, maximumLength: number) {
  if (typeof value !== "string") throw new Error(`${fieldName} is required.`);
  const text = value.trim();
  if (!text || text.length > maximumLength) throw new Error(`${fieldName} must contain 1-${maximumLength} characters.`);
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)) {
    throw new Error(`${fieldName} contains unsupported control characters.`);
  }
  return text;
}

function optionalText(value: unknown, fieldName: string, maximumLength: number) {
  if (value === null || value === undefined || value === "") return null;
  return requireText(value, fieldName, maximumLength);
}

function requireHttpUrl(value: unknown, fieldName: string) {
  const text = requireText(value, fieldName, 2_048);
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
    return url.toString();
  } catch {
    throw new Error(`${fieldName} must be an HTTP(S) URL.`);
  }
}

function optionalHttpUrl(value: unknown, fieldName: string) {
  if (value === null || value === undefined || value === "") return null;
  return requireHttpUrl(value, fieldName);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
