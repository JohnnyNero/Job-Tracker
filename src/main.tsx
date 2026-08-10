import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/app.css'
import { StoreProvider } from './store/store'
import { SupabaseStore } from './store/SupabaseStore'
import { LoginGate } from './store/LoginGate'
import { chooseBackend } from './store/backend'
import { isOnline } from './store/supabaseClient'
import { App } from './App'

const tree =
  chooseBackend(isOnline) === 'supabase' ? (
    <LoginGate>
      <SupabaseStore>
        <App />
      </SupabaseStore>
    </LoginGate>
  ) : (
    <StoreProvider>
      <App />
    </StoreProvider>
  )

createRoot(document.getElementById('root')!).render(<StrictMode>{tree}</StrictMode>)
