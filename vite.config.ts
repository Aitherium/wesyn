/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served at https://wesyn.aitherium.com/ -- assets load from the domain root (public/CNAME).
export default defineConfig({
  base: '/',
  plugins: [react()],
  test: { environment: 'jsdom' },
})
