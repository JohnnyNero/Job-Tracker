// Crockford-ish alphabet with ambiguous glyphs (0 O 1 I L) removed so codes are
// easy to read aloud and type.
export const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** An 8-character human-friendly invite code. Uniqueness is enforced by the DB
 * unique constraint; callers retry on the rare collision. */
export function generateInviteCode(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const b of bytes) out += INVITE_ALPHABET[b % INVITE_ALPHABET.length]
  return out
}
