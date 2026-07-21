import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { Webhook } from "npm:svix@1";

import { normalizeOutreachEmail, suppressionReasonForProviderEvent } from "../../../services/domain/outreach.ts";

type JsonRecord = Record<string, unknown>;

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed.", { status: 405 });

  try {
    const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");
    if (!webhookSecret) return new Response("Webhook is not configured.", { status: 503 });

    const contentLength = Number(req.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > 256 * 1024) {
      return new Response("Payload too large.", { status: 413 });
    }
    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > 256 * 1024) {
      return new Response("Payload too large.", { status: 413 });
    }

    const svixId = req.headers.get("svix-id");
    const svixTimestamp = req.headers.get("svix-timestamp");
    const svixSignature = req.headers.get("svix-signature");
    if (!svixId || !svixTimestamp || !svixSignature) return new Response("Invalid webhook.", { status: 400 });

    const verified = new Webhook(webhookSecret).verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature
    }) as JsonRecord;
    const eventType = typeof verified.type === "string" ? verified.type : "";
    const data = verified.data && typeof verified.data === "object" ? verified.data as JsonRecord : {};
    if (!eventType.startsWith("email.")) return new Response("Ignored.", { status: 200 });

    const supabase = createServiceClient();
    const providerMessageId = readProviderMessageId(data);
    const message = providerMessageId ? await findMessage(supabase, providerMessageId) : null;

    if (eventType === "email.received") {
      await stopFollowUpsForReply(supabase, data);
    } else if (message) {
      await applyOutboundEvent(supabase, eventType, message);
    }

    const occurredAt = validIsoDate(verified.created_at) ?? validIsoDate(data.created_at) ?? new Date().toISOString();
    const eventInsert = await supabase.from("outreach_events").insert({
      provider_event_id: svixId,
      provider_message_id: providerMessageId,
      message_id: message?.id ?? null,
      event_type: eventType,
      occurred_at: occurredAt
    });
    if (eventInsert.error && eventInsert.error.code !== "23505") throw eventInsert.error;

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Outreach webhook failed", safeError(error));
    return new Response("Invalid webhook.", { status: 400 });
  }
});

function createServiceClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase environment is not configured.");
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function findMessage(supabase: SupabaseClient, providerMessageId: string) {
  const { data, error } = await supabase
    .from("outreach_messages")
    .select("id,lead_id,enrollment_id,status")
    .eq("provider_message_id", providerMessageId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function applyOutboundEvent(
  supabase: SupabaseClient,
  eventType: string,
  message: { id: string; lead_id: string; enrollment_id: string; status: string }
) {
  const now = new Date().toISOString();
  const suppressionReason = suppressionReasonForProviderEvent(eventType);
  if (suppressionReason) {
    const status = eventType === "email.bounced" ? "bounced" : eventType === "email.complained" ? "complained" : "suppressed";
    const messageUpdate = await supabase
      .from("outreach_messages")
      .update({ status, last_event_at: now, last_error: suppressionReason })
      .eq("id", message.id);
    if (messageUpdate.error) throw messageUpdate.error;
    await suppressLead(supabase, message.lead_id, suppressionReason);
    return;
  }

  if (eventType === "email.delivered") {
    const { error } = await supabase
      .from("outreach_messages")
      .update({ status: "delivered", last_event_at: now })
      .eq("id", message.id)
      .in("status", ["sent", "delivered"]);
    if (error) throw error;
    return;
  }

  if (eventType === "email.failed") {
    const [messageUpdate, enrollmentUpdate] = await Promise.all([
      supabase
        .from("outreach_messages")
        .update({ status: "failed", last_event_at: now, last_error: "provider_delivery_failed" })
        .eq("id", message.id),
      supabase
        .from("outreach_enrollments")
        .update({ status: "attention_required", claimed_at: null, claimed_from_status: null })
        .eq("id", message.enrollment_id)
        .in("status", ["contacted", "completed"])
    ]);
    const error = messageUpdate.error ?? enrollmentUpdate.error;
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("outreach_messages").update({ last_event_at: now }).eq("id", message.id);
  if (error) throw error;
}

async function suppressLead(supabase: SupabaseClient, leadId: string, reason: string) {
  const leadResult = await supabase.from("outreach_leads").select("email").eq("id", leadId).single();
  if (leadResult.error) throw leadResult.error;
  const source = "resend_webhook";
  const existing = await supabase
    .from("outreach_suppressions")
    .select("id")
    .eq("email_normalized", normalizeOutreachEmail(leadResult.data.email))
    .maybeSingle();
  if (existing.error) throw existing.error;
  const suppressionWrite = existing.data
    ? await supabase.from("outreach_suppressions").update({ reason, source }).eq("id", existing.data.id)
    : await supabase.from("outreach_suppressions").insert({ email: leadResult.data.email, reason, source });
  if (suppressionWrite.error) throw suppressionWrite.error;

  const leadStatus = reason === "hard_bounce" ? "bounced" : "unsubscribed";
  const [leadUpdate, enrollmentUpdate, messagesUpdate] = await Promise.all([
    supabase.from("outreach_leads").update({ status: leadStatus }).eq("id", leadId),
    supabase
      .from("outreach_enrollments")
      .update({ status: "suppressed", claimed_at: null, claimed_from_status: null })
      .eq("lead_id", leadId)
      .not("status", "in", '("replied","interested","not_interested")'),
    supabase
      .from("outreach_messages")
      .update({ status: "cancelled", last_error: reason })
      .eq("lead_id", leadId)
      .in("status", ["draft", "approved"])
  ]);
  const error = leadUpdate.error ?? enrollmentUpdate.error ?? messagesUpdate.error;
  if (error) throw error;
}

async function stopFollowUpsForReply(supabase: SupabaseClient, data: JsonRecord) {
  const from = typeof data.from === "string" ? data.from : Array.isArray(data.from) ? data.from[0] : null;
  const email = typeof from === "string" ? extractEmail(from) : null;
  if (!email) return;
  const leadResult = await supabase.from("outreach_leads").select("id").eq("email_normalized", email).maybeSingle();
  if (leadResult.error) throw leadResult.error;
  if (!leadResult.data) return;

  const leadId = leadResult.data.id;
  const [leadUpdate, enrollmentUpdate, messageUpdate] = await Promise.all([
    supabase
      .from("outreach_leads")
      .update({ status: "replied" })
      .eq("id", leadId)
      .in("status", ["approved", "contacted"]),
    supabase
      .from("outreach_enrollments")
      .update({ status: "replied", claimed_at: null, claimed_from_status: null })
      .eq("lead_id", leadId)
      .in("status", ["queued", "awaiting_review", "ready", "processing", "contacted", "completed"]),
    supabase
      .from("outreach_messages")
      .update({ status: "cancelled", last_error: "reply_received" })
      .eq("lead_id", leadId)
      .in("status", ["draft", "approved"])
  ]);
  const error = leadUpdate.error ?? enrollmentUpdate.error ?? messageUpdate.error;
  if (error) throw error;
}

function readProviderMessageId(data: JsonRecord) {
  if (typeof data.email_id === "string") return data.email_id;
  if (typeof data.id === "string") return data.id;
  return null;
}

function extractEmail(value: string) {
  const bracketed = value.match(/<([^<>\s@]+@[^<>\s@]+)>/);
  const candidate = bracketed?.[1] ?? value.trim();
  const normalized = normalizeOutreachEmail(candidate);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

function validIsoDate(value: unknown) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function safeError(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 300);
  return "Unexpected webhook error.";
}
