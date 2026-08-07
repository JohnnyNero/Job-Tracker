import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves this repo at https://<user>.github.io/Job-Tracker/.
// The path segment is CASE-SENSITIVE and must match the repo name exactly
// (repo is "Job-Tracker"), or the page loads but its assets 404 → blank screen.
// Override with VITE_BASE for a custom domain (set VITE_BASE=/ ).
// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE ?? '/Job-Tracker/',
  plugins: [react()],
})
