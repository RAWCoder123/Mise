import { createClient } from "npm:@supabase/supabase-js@2";

const SECURITY_HEADERS = {
  "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY"
};

Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "POST") return new Response("Method not allowed.", { status: 405 });

  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  if (!isUuid(token)) return htmlPage("This unsubscribe link is invalid.", 400);

  if (req.method === "GET") {
    return htmlPage(
      `<h1>Stop Mise marketing emails?</h1>
       <p>This will prevent future sales outreach from Mise to this email address.</p>
       <form method="post" action="?token=${escapeHtml(token)}">
         <button type="submit">Unsubscribe</button>
       </form>`,
      200,
      false
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return htmlPage("Unsubscribe is temporarily unavailable.", 503);
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { error } = await supabase.rpc("service_unsubscribe_outreach", {
      p_token: token,
      p_reason: "recipient_request"
    });
    if (error) throw error;
    return htmlPage("You’re unsubscribed. Mise will not send further marketing emails to this address.", 200);
  } catch {
    return htmlPage("Unsubscribe is temporarily unavailable. Please try again.", 503);
  }
});

function htmlPage(content: string, status: number, wrapInParagraph = true) {
  const body = wrapInParagraph ? `<p>${escapeHtml(content)}</p>` : content;
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mise email preferences</title><style>body{font-family:Arial,sans-serif;max-width:36rem;margin:5rem auto;padding:0 1.25rem;color:#111;line-height:1.5}button{min-height:44px;border:0;border-radius:8px;background:#e44332;color:#fff;font-weight:700;padding:.7rem 1rem;cursor:pointer}</style></head><body>${body}</body></html>`,
    { status, headers: { ...SECURITY_HEADERS, "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } }
  );
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
