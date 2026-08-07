/** UUID v4. Uses the platform crypto, matching Postgres's gen_random_uuid()
 * so ids look the same offline and online. */
export function newId(): string {
  return crypto.randomUUID()
}

/** ISO timestamp for "now" — the offline equivalent of now(). */
export function nowIso(): string {
  return new Date().toISOString()
}
