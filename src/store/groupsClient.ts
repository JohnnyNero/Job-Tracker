import { supabase } from './supabaseClient'
import { generateInviteCode } from '../lib/inviteCode'

export interface Group {
  id: string
  name: string
  invite_code: string
}

export interface MemberSummary {
  user_id: string
  display_name: string
  applied_this_week: number
  active: number
  overdue: number
  interviews: number
  offers: number
}

export interface Profile {
  user_id: string
  display_name: string
}

function client() {
  if (!supabase) throw new Error('Supabase not configured')
  return supabase
}

async function uid(): Promise<string> {
  const { data, error } = await client().auth.getUser()
  if (error || !data.user) throw new Error('Not signed in')
  return data.user.id
}

export async function getMyProfile(): Promise<Profile | null> {
  const { data, error } = await client().from('profiles').select('user_id, display_name').maybeSingle()
  if (error) throw error
  return data ?? null
}

export async function setDisplayName(name: string): Promise<void> {
  const user_id = await uid()
  const { error } = await client().from('profiles').upsert({ user_id, display_name: name })
  if (error) throw error
}

export async function getMyGroup(): Promise<Group | null> {
  const me = await uid()
  const { data: mem, error: memErr } = await client()
    .from('group_members')
    .select('group_id')
    .eq('user_id', me)
    .maybeSingle()
  if (memErr) throw memErr
  if (!mem) return null
  const { data: g, error: gErr } = await client()
    .from('groups')
    .select('id, name, invite_code')
    .eq('id', mem.group_id)
    .maybeSingle()
  if (gErr) throw gErr
  return g ?? null
}

export async function createGroup(name: string): Promise<Group> {
  // Retry on the rare invite-code unique collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode()
    const { data, error } = await client().rpc('create_group', { p_name: name, p_code: code })
    if (!error) return data as Group
    if (!String(error.message).toLowerCase().includes('duplicate')) throw error
  }
  throw new Error('Could not generate a unique invite code, please try again')
}

export async function joinGroup(code: string): Promise<Group> {
  const { data, error } = await client().rpc('join_group', { p_code: code.trim().toUpperCase() })
  if (error) throw error
  return data as Group
}

export async function leaveGroup(): Promise<void> {
  const me = await uid()
  const { error } = await client().from('group_members').delete().eq('user_id', me)
  if (error) throw error
}

export async function fetchSummary(groupId: string): Promise<MemberSummary[]> {
  const { data, error } = await client().rpc('group_summary', { p_group_id: groupId })
  if (error) throw error
  return (data ?? []) as MemberSummary[]
}
