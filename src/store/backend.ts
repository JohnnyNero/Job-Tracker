/** Pure backend decision so it is testable without rendering React. */
export function chooseBackend(online: boolean): 'supabase' | 'local' {
  return online ? 'supabase' : 'local'
}
