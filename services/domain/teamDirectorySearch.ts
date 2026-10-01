/**
 * Ranked find for Settings → Team member directory.
 * Never invents members; only filters the caller-supplied loaded team list.
 */

export const TEAM_DIRECTORY_SEARCH_THRESHOLD = 6;

export type TeamDirectorySearchFields = {
  user_id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  status?: string | null;
};

function normalizeSearchKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function tokenize(query: string): string[] {
  return normalizeSearchKey(query)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function primaryLabel(member: TeamDirectorySearchFields): string {
  const name = member.name?.trim() ?? "";
  if (name) return name;
  const email = member.email?.trim() ?? "";
  if (email) return email;
  return "";
}

function scoreMemberMatch(member: TeamDirectorySearchFields, query: string): number | null {
  const normalizedQuery = normalizeSearchKey(query);
  if (!normalizedQuery) return 0;

  const labelKey = normalizeSearchKey(primaryLabel(member));
  if (!labelKey) return null;

  if (labelKey === normalizedQuery) return 1000;

  let score = 0;
  if (labelKey.startsWith(normalizedQuery)) score = 800;
  else if (labelKey.includes(normalizedQuery)) score = 600;

  const tokens = tokenize(query);
  if (tokens.length > 1) {
    const allTokensPresent = tokens.every((token) => labelKey.includes(token));
    if (allTokensPresent) score = Math.max(score, 700);
  }

  const nameKey = normalizeSearchKey(member.name ?? "");
  if (nameKey && nameKey.includes(normalizedQuery)) score = Math.max(score, 550);

  const emailKey = normalizeSearchKey(member.email ?? "");
  if (emailKey && emailKey.includes(normalizedQuery)) score = Math.max(score, 450);

  const roleKey = normalizeSearchKey(member.role ?? "");
  if (roleKey && roleKey.includes(normalizedQuery)) score = Math.max(score, 300);

  const statusKey = normalizeSearchKey(member.status ?? "");
  if (statusKey && statusKey.includes(normalizedQuery)) score = Math.max(score, 250);

  return score > 0 ? score : null;
}

/**
 * Rank restaurant team members for the Settings Team directory.
 * Empty query preserves caller order (full deduped list). Non-empty query ranks
 * name/email/role/status matches without inventing rows.
 */
export function filterTeamDirectoryBySearch<T extends TeamDirectorySearchFields>(
  members: readonly T[],
  query: string
): T[] {
  const unique: T[] = [];
  const seen = new Set<string>();
  for (const member of members) {
    const id = member.user_id?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    unique.push(member);
  }

  const normalizedQuery = normalizeSearchKey(query);
  if (!normalizedQuery) return unique;

  return unique
    .map((member, index) => {
      const score = scoreMemberMatch(member, query);
      if (score == null) return null;
      return { member, score, index };
    })
    .filter((match): match is { member: T; score: number; index: number } => match != null)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.index - right.index;
    })
    .map((match) => match.member);
}
