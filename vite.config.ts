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
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }

          if (id.includes('lucide-react')) {
            return 'lucide'
          }

          if (id.includes('xlsx')) {
            return 'xlsx'
          }

          if (id.includes('@supabase/supabase-js')) {
            return 'supabase'
          }

          if (id.includes('recharts')) {
            return 'recharts'
          }

          if (id.includes('date-fns')) {
            return 'date-fns'
          }

          if (id.includes('radix-ui')) {
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
