import { isAbsolute, relative, resolve } from "node:path";

const EMAIL_MAX = 254;
const NAME_MAX = 120;
const INVITE_LINK_MAX = 20_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeProvisioningRequest(input) {
  const email = String(input.email ?? "").trim().toLowerCase();
  const restaurantName = String(input.restaurantName ?? "").trim();
  const cuisineType = String(input.cuisineType ?? "").trim();
  const idempotencyKey = String(input.idempotencyKey ?? "").trim().toLowerCase();
  const redirectTo = String(input.redirectTo ?? "mise://accept-invite").trim();
  const inviteFile = String(input.inviteFile ?? "").trim();

  if (
    email.length < 3 ||
    email.length > EMAIL_MAX ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new Error("A valid owner email is required.");
  }
  if (restaurantName.length < 1 || restaurantName.length > NAME_MAX) {
    throw new Error(`Restaurant name must be between 1 and ${NAME_MAX} characters.`);
  }
  if (cuisineType.length > NAME_MAX) {
    throw new Error(`Cuisine type must be at most ${NAME_MAX} characters.`);
  }
  if (!UUID_PATTERN.test(idempotencyKey)) {
    throw new Error("A stable RFC 4122 idempotency key is required.");
  }
  if (redirectTo !== "mise://accept-invite") {
    throw new Error("Beta invitations must return to mise://accept-invite.");
  }
  if (inviteFile && !isAbsolute(inviteFile)) {
    throw new Error("The invitation artifact path must be absolute.");
  }

  return {
    email,
    restaurantName,
    cuisineType,
    idempotencyKey,
    redirectTo,
    inviteFile
  };
}

export function assertProvisioningEnvironment(request, env) {
  const stagingRef = String(env.SUPABASE_STAGING_PROJECT_REF ?? "").trim();
  const productionRef = String(env.SUPABASE_PRODUCTION_PROJECT_REF ?? "").trim();
  const confirmedRef = String(request.confirmProjectRef ?? "").trim();
  if (!stagingRef || !confirmedRef || confirmedRef !== stagingRef) {
    throw new Error("The explicitly confirmed project ref must match hosted staging.");
  }
  if (productionRef && stagingRef === productionRef) {
    throw new Error("Beta provisioning refuses to target the production project.");
  }
  if (!env.SUPABASE_STAGING_URL || !env.SUPABASE_STAGING_SECRET_KEY) {
    throw new Error("Hosted staging URL and secret key are required for apply mode.");
  }
  if (env.SUPABASE_STAGING_SECRET_KEY === env.SUPABASE_STAGING_ANON_KEY) {
    throw new Error("Beta provisioning requires a server-only secret key.");
  }
}

export function assertInviteArtifactOutsideWorkspace(inviteFile, workspaceRoot) {
  if (!inviteFile) return;
  const relativePath = relative(resolve(workspaceRoot), resolve(inviteFile));
  if (!relativePath.startsWith("..") && !isAbsolute(relativePath)) {
    throw new Error("Invitation artifacts must be written outside the repository.");
  }
}

export function maskProvisioningEmail(email) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "<invalid>";
  return `${local.slice(0, 1)}***@${domain}`;
}

export function validateInviteArtifact(invite) {
  if (!invite?.userId || !invite?.actionLink) {
    throw new Error("Auth administration returned an incomplete invitation.");
  }
  if (
    typeof invite.actionLink !== "string" ||
    invite.actionLink.length < 1 ||
    invite.actionLink.length > INVITE_LINK_MAX
  ) {
    throw new Error("Auth administration returned an invalid invitation link.");
  }
  return invite;
}

/**
 * Execute a single replay-safe provisioning request through injected trusted
 * administration boundaries. No secret-bearing value is returned.
 */
export async function executeBetaRestaurantProvisioning(request, operations) {
  const users = await operations.findUsersByEmail(request.email);
  if (!Array.isArray(users) || users.length > 1) {
    throw new Error("Auth user lookup was ambiguous.");
  }

  let user = users[0] ?? null;
  let inviteCreated = false;
  let provisioningAccepted = false;

  try {
    if (!user) {
      if (!request.inviteFile) {
        throw new Error("A new owner requires an absolute invitation artifact path.");
      }
      await operations.reserveInviteArtifact(request.inviteFile);
      const invite = validateInviteArtifact(
        await operations.generateInvite({
          email: request.email,
          redirectTo: request.redirectTo
        })
      );
      user = { id: invite.userId, email: request.email };
      inviteCreated = true;
      await operations.writeInviteArtifact(request.inviteFile, {
        version: 1,
        kind: "mise_beta_owner_invitation",
        email: request.email,
        restaurantName: request.restaurantName,
        redirectTo: request.redirectTo,
        generatedAt: new Date().toISOString(),
        actionLink: invite.actionLink
      });
    }

    const restaurant = await operations.provisionRestaurant({
      ownerUserId: user.id,
      restaurantName: request.restaurantName,
      cuisineType: request.cuisineType,
      idempotencyKey: request.idempotencyKey
    });
    if (!restaurant?.id) throw new Error("Restaurant provisioning returned no authority.");
    provisioningAccepted = true;

    await operations.verifyProvisioning({
      userId: user.id,
      restaurantId: restaurant.id
    });

    return {
      userId: user.id,
      restaurantId: restaurant.id,
      ownerEmailMasked: maskProvisioningEmail(request.email),
      inviteArtifactCreated: inviteCreated,
      replaySafe: true
    };
  } catch (error) {
    if (inviteCreated && !provisioningAccepted) {
      await operations.removeInviteArtifact(request.inviteFile).catch(() => undefined);
      if (user?.id) await operations.deleteNewUser(user.id).catch(() => undefined);
    }
    if (provisioningAccepted) {
      throw new Error(
        "Provisioning was accepted but final verification failed; preserve the tenant and reconcile manually.",
        { cause: error }
      );
    }
    throw error;
  }
}
