/**
 * ASCII C-locale case fold — mirrors SQL `lower(... collate "C")`
 * (MISE-005JM; complements open MISE-005JD / #674 and MISE-005AA / #435).
 * Only ASCII A-Z is folded; Unicode-aware `toLowerCase` would map Kelvin
 * sign `K` → `k` and invent a mailbox the hosted COLLATE C invite lookup
 * would not match.
 */
function asciiCLower(value: string) {
  return value.replace(/[A-Z]/g, (character) => character.toLowerCase());
}

/**
 * Trim only ASCII whitespace so hosted invite display mailboxes stay aligned
 * with server helpers that btrim under COLLATE "C".
 */
function asciiCTrim(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

/**
 * Display mailbox for a just-invited teammate before profile fields load.
 * Pinned to ASCII C so the optimistic team-row email cannot invent Kelvin
 * identity the `find_restaurant_member_candidate` path would not treat as
 * identical after MISE-005AA / MISE-005JD.
 */
export function normalizeHostedInviteEmailDisplay(value: string): string {
  return asciiCTrim(asciiCLower(value));
}
