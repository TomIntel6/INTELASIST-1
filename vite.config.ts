import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }

          const normalizedId = id.replace(/\\/g, '/')

          if (normalizedId.includes('react-dom')) {
            return 'react-dom'
          }

          if (normalizedId.includes('react-router')) {
            return 'router'
          }

          if (normalizedId.includes('react/')) {
            return 'react'
          }

          if (normalizedId.includes('lucide-react')) {
            return 'lucide'
          }

          if (normalizedId.includes('xlsx')) {
            return 'xlsx'
          }

          if (normalizedId.includes('@supabase/supabase-js')) {
            return 'supabase'
          }

          if (normalizedId.includes('recharts')) {
            return 'recharts'
          }

          if (normalizedId.includes('date-fns')) {
            return 'date-fns'
          }

          if (normalizedId.includes('sonner')) {
            return 'sonner'
          }

          if (normalizedId.includes('react-hook-form') || normalizedId.includes('@hookform')) {
            return 'forms'
          }

          if (normalizedId.includes('radix-ui')) {
            return 'radix-ui'
          }

          return 'vendor'
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: [
      "intelasist.local"
    ],
    proxy: {
      "/auth": {
        target: "https://intelasist.onrender.com",
        changeOrigin: true,
        secure: true,
      },
      "/usuarios": {
        target: "https://intelasist.onrender.com",
        changeOrigin: true,
        secure: true,
      },
      "/reportes": {
        target: "https://intelasist.onrender.com",
        changeOrigin: true,
        secure: true,
      },
      "/upload": {
        target: "https://intelasist.onrender.com",
        changeOrigin: true,
        secure: true,
      },
      "/uploads": {
        target: "https://intelasist.onrender.com",
        changeOrigin: true,
        secure: true,
      },
    }
  },
})
