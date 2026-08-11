// TEMPLATE — not compiled (lives under docs/, outside the src/ tsconfig).
//
// NOTE: cross-device sync is now SHIPPED, but as a whole-dataset blob (see
// src/lib/supabase.ts + src/lib/merge.ts + supabase/migrations/0002_sync.sql and
// docs/setup-supabase.md), not the per-table relational approach sketched below.
// This file is kept only as a reference for a future full relational migration.
//
// This was the drop-in sketch for going online relationally. The offline app
// routes every read and write through the store in src/store/store.tsx, so it'd be:
//
//   1. npm install @supabase/supabase-js
//   2. Copy this file to src/store/supabaseClient.ts (+ a SupabaseStore).
//   3. Add a login gate (magic link) around <App/>.
//   4. Swap StoreProvider's localStorage calls for these async ones, OR keep
//      both and choose at runtime based on whether env vars are present.
//
// The Dataset shape here is identical to the offline one, so your exported JSON
// backup imports cleanly.

import { createClient } from '@supabase/supabase-js'
import type { Dataset } from '../src/types'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Present only when the two public env vars are set at build time. */
export const supabase = url && anon ? createClient(url, anon) : null

// --- auth (magic link, single user) ---------------------------------------

export async function signIn(email: string) {
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href },
  })
  if (error) throw error
}

export async function signOut() {
  await supabase?.auth.signOut()
}

// --- reads -----------------------------------------------------------------

/** Load the whole dataset. RLS guarantees you only ever get your own rows, so
 * no user_id filter is needed in the queries. */
export async function fetchDataset(): Promise<Dataset> {
  if (!supabase) throw new Error('Supabase not configured')
  const tables = [
    'capabilities',
    'role_profiles',
    'evidence',
    'cv_versions',
    'applications',
    'events',
    'application_evidence',
    'criteria',
  ] as const

  const results = await Promise.all(tables.map((t) => supabase!.from(t).select('*')))
  const out: Record<string, unknown[]> = {}
  tables.forEach((t, i) => {
    const { data, error } = results[i]
    if (error) throw error
    out[t] = data ?? []
  })
  return out as unknown as Dataset
}

// --- writes ----------------------------------------------------------------
//
// The offline mutations in src/store/mutations.ts already produce full rows
// (with ids and timestamps). Online you can either keep generating ids client
// side (simplest — keeps the same code path) or let Postgres defaults fill
// them. The DB triggers handle updated_at, stage events, and closed_from_stage,
// so DO NOT also write events by hand online — you'd double-log. That is the
// one behavioural difference from the offline store to remember.

export async function insertRow<T extends Record<string, unknown>>(table: string, row: T) {
  const { data, error } = await supabase!.from(table).insert(row).select().single()
  if (error) throw error
  return data
}

export async function updateRow<T extends Record<string, unknown>>(
  table: string,
  id: string,
  patch: T,
) {
  const { data, error } = await supabase!.from(table).update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteRow(table: string, id: string) {
  const { error } = await supabase!.from(table).delete().eq('id', id)
  if (error) throw error
}

// --- storage (CV files) ----------------------------------------------------

export async function uploadCv(file: File, path: string) {
  const { error } = await supabase!.storage.from('cvs').upload(path, file, { upsert: true })
  if (error) throw error
  return path
}

export async function cvDownloadUrl(path: string) {
  // Private bucket → signed, time-limited URL.
  const { data, error } = await supabase!.storage.from('cvs').createSignedUrl(path, 60 * 60)
  if (error) throw error
  return data.signedUrl
}
