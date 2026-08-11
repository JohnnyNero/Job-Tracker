// The Supabase seam. Present ONLY when both public env vars are set at build
// time — otherwise every export here is a safe no-op and the app stays purely
// offline (exactly as before online was wired). Nothing in here is imported for
// its side effects; screens go through the store, which calls these.
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import type { Dataset } from '../types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** True when the build carried the two public Supabase values. */
export const isSupabaseConfigured = Boolean(url && anon)

// PKCE flow keeps the auth handshake in a `?code=` query param (which the hash
// router ignores) rather than the URL hash (which it does not) — so a magic-link
// return doesn't collide with `#/route`. detectSessionInUrl completes it on load.
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anon!, {
      auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
    })
  : null

/** Where the magic link returns to — the app's own origin + base path. Must be
 * added to the project's Auth → URL Configuration → Redirect URLs allowlist. */
export function redirectUrl(): string {
  return window.location.origin + import.meta.env.BASE_URL
}

// --- auth (magic link, single user) ----------------------------------------

/** Email a one-time magic link. Resolves once the mail is sent (not signed in). */
export async function sendMagicLink(email: string): Promise<void> {
  if (!supabase) throw new Error('Cloud sync is not configured for this build.')
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: redirectUrl() },
  })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut()
}

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session
}

/** Subscribe to sign-in / sign-out. Returns an unsubscribe fn. */
export function onAuthChange(cb: (session: Session | null) => void): () => void {
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange((_e, session) => cb(session))
  return () => data.subscription.unsubscribe()
}

// --- the synced blob (one row per user, see 0002_sync.sql) ------------------

export interface RemoteState {
  data: Dataset
  updated_at: string
}

/** Read this user's synced dataset, or null if they've never pushed one. */
export async function fetchState(): Promise<RemoteState | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('user_state')
    .select('data, updated_at')
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return { data: data.data as Dataset, updated_at: data.updated_at as string }
}

/** Upsert this user's dataset. The DB trigger stamps user_id + updated_at, so we
 * only send the blob; returns the server's new updated_at. */
export async function saveState(userId: string, dataset: Dataset): Promise<string | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('user_state')
    .upsert({ user_id: userId, data: dataset }, { onConflict: 'user_id' })
    .select('updated_at')
    .single()
  if (error) throw error
  return (data?.updated_at as string) ?? null
}

/** Live-subscribe to changes on this user's row (the other device pushing).
 * Calls back with the new state. Returns an unsubscribe fn. */
export function subscribeState(userId: string, cb: (state: RemoteState) => void): () => void {
  if (!supabase) return () => {}
  const channel = supabase
    .channel('user_state:' + userId)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'user_state', filter: `user_id=eq.${userId}` },
      (payload) => {
        const row = payload.new as { data?: Dataset; updated_at?: string }
        if (row && row.data && row.updated_at) cb({ data: row.data, updated_at: row.updated_at })
      },
    )
    .subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}
