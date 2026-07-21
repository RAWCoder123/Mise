const projectRefPattern = /^[a-z0-9]{20}$/;

export function validateStagingTarget(urlValue, projectRef, productionProjectRef = process.env.SUPABASE_PRODUCTION_PROJECT_REF) {
  if (!urlValue || !projectRef) {
    throw new Error("Staging preflight requires SUPABASE_STAGING_URL and SUPABASE_STAGING_PROJECT_REF.");
  }
  if (!projectRefPattern.test(projectRef)) {
    throw new Error("SUPABASE_STAGING_PROJECT_REF must be the exact 20-character Supabase project reference.");
  }
  if (productionProjectRef && projectRef === productionProjectRef) {
    throw new Error("Staging preflight rejected the configured production project reference.");
  }

  let url;
  try {
    url = new URL(urlValue);
  } catch {
    throw new Error("SUPABASE_STAGING_URL must be a valid HTTPS URL.");
  }

  const expectedOrigin = `https://${projectRef}.supabase.co`;
  if (
    url.protocol !== "https:" ||
    url.origin !== expectedOrigin ||
    url.hostname !== `${projectRef}.supabase.co` ||
    (url.pathname !== "" && url.pathname !== "/") ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(`SUPABASE_STAGING_URL must exactly match ${expectedOrigin}.`);
  }

  return { url: expectedOrigin, projectRef };
}

export function assertLoopbackOrigin(urlValue, label) {
  let url;
  try {
    url = new URL(urlValue);
  } catch {
    throw new Error(`${label} must be a valid loopback URL.`);
  }
  if (
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password
  ) {
    throw new Error(`${label} must use an HTTP loopback origin for private-beta browser testing.`);
  }
  return url.origin;
}

export async function assertStagingPreflight(source = process.env, fetchImplementation = fetch) {
  const target = validateStagingTarget(
    source.SUPABASE_STAGING_URL,
    source.SUPABASE_STAGING_PROJECT_REF,
    source.SUPABASE_PRODUCTION_PROJECT_REF
  );
  const anonKey = source.SUPABASE_STAGING_ANON_KEY;
  const marker = source.MISE_STAGING_MARKER;
  if (!anonKey || !marker) {
    throw new Error("Staging preflight requires SUPABASE_STAGING_ANON_KEY and MISE_STAGING_MARKER.");
  }
  if (marker.length < 16 || marker.length > 200) {
    throw new Error("MISE_STAGING_MARKER must be a non-secret staging identity value between 16 and 200 characters.");
  }

  const response = await fetchImplementation(`${target.url}/rest/v1/rpc/verify_staging_identity`, {
    method: "POST",
    redirect: "error",
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${anonKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ p_expected_marker: marker })
  });
  if (!response.ok) {
    throw new Error(`Staging identity preflight failed with HTTP ${response.status}; no trusted credential was transmitted.`);
  }
  if ((await response.json()) !== true) {
    throw new Error("Staging identity marker did not match; no trusted credential was transmitted.");
  }
  return target;
}
