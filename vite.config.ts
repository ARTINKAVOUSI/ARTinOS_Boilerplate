import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // One React and one Three for the whole app. Duplicates surface as
    // "Invalid hook call" and "Multiple instances of Three.js being imported".
    dedupe: ['react', 'react-dom', 'three', '@react-three/fiber', '@react-three/drei'],
  },
  // PORT lets a launcher run a second copy beside the first.
  server: { port: Number(process.env.PORT) || 5190, strictPort: true },
  build: {
    target: 'es2022',
    // Three WebGPU + TSL is one engine chunk by design.
    chunkSizeWarningLimit: 3500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@mediapipe/tasks-vision')) return 'vision'
          // drei's WebGL-only entry (troika text, GLSL Image) is imported lazily; keep it out of startup.
          if (id.includes('@react-three/drei/legacy')) return 'drei-legacy'
          if (id.includes('/three/') || id.includes('@react-three')) return 'engine'
        },
      },
    },
  },
})
