/// <reference types="vite/client" />

// Typed access to the Supabase env vars (used only when you go online).
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_BASE?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
