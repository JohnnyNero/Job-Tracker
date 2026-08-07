import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves this repo at https://<user>.github.io/job-tracker/,
// so the base path must match the repo name. Override with VITE_BASE for a
// custom domain (set VITE_BASE=/ ).
// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE ?? '/job-tracker/',
  plugins: [react()],
})
