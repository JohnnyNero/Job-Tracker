import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import type { Dataset } from '../types'
import type { RowOp } from './diffSync'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

const looksReal =
  !!url &&
  !!anon &&
  !url.includes('YOUR-PROJECT-ref') &&
  anon !== 'your-public-anon-key'

export const supabase: SupabaseClient | null = looksReal ? createClient(url!, anon!) : null
export const isOnline = supabase !== null

const ALL_TABLES: (keyof Dataset)[] = [
  'capabilities',
  'role_profiles',
  'evidence',
  'cv_versions',
  'applications',
  'events',
  'application_evidence',
  'criteria',
]

export async function signIn(email: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href },
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

export function onAuthStateChange(cb: (session: Session | null) => void): () => void {
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange((_e, session) => cb(session))
  return () => data.subscription.unsubscribe()
}

export async function fetchTables(names: (keyof Dataset)[]): Promise<Partial<Dataset>> {
  if (!supabase) throw new Error('Supabase not configured')
  const results = await Promise.all(names.map((t) => supabase.from(t as string).select('*')))
  const out: Partial<Dataset> = {}
  names.forEach((t, i) => {
    const { data, error } = results[i]
    if (error) throw error
    ;(out as Record<string, unknown[]>)[t as string] = data ?? []
  })
  return out
}

export async function fetchDataset(): Promise<Dataset> {
  return (await fetchTables(ALL_TABLES)) as Dataset
}

export async function applyOp(op: RowOp): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured')
  if (op.op === 'insert') {
    const { error } = await supabase.from(op.table).upsert(op.row)
    if (error) throw error
  } else if (op.op === 'update') {
    const { error } = await supabase.from(op.table).update(op.row).eq('id', op.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from(op.table).delete().eq('id', op.id)
    if (error) throw error
  }
}

export async function uploadCv(file: File, path: string): Promise<string> {
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase.storage.from('cvs').upload(path, file, { upsert: true })
  if (error) throw error
  return path
}

export async function cvDownloadUrl(path: string): Promise<string> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase.storage.from('cvs').createSignedUrl(path, 60 * 60)
  if (error) throw error
  return data.signedUrl
}
