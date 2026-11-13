/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served at https://aitherium.github.io/wesyn/ -- every asset path is under /wesyn/.
export default defineConfig({
  base: '/wesyn/',
  plugins: [react()],
  test: { environment: 'jsdom' },
})
