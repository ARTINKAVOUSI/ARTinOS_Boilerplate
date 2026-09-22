import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // pnpm junctions packages back to its store on D:\, outside this project, and
    // esbuild resolves real paths -- so a bare `react` import from a store package
    // escapes the project tree and resolves nothing (@react-three/drei ->
    // tunnel-rat). Pinning the bare specifiers to this project's single copy fixes
    // that, and simultaneously keeps every workspace package in packages/* on one
    // React and one Three: each has its own node_modules link, and duplicates
    // surface as "Invalid hook call" and "Multiple instances of Three.js".
    // Anchored regexes so subpaths (three/webgpu, three/tsl, react/jsx-runtime)
    // still resolve normally.
    alias: [
      { find: /^react$/, replacement: fileURLToPath(new URL('./node_modules/react', import.meta.url)) },
      { find: /^react-dom$/, replacement: fileURLToPath(new URL('./node_modules/react-dom', import.meta.url)) },
      { find: /^three$/, replacement: fileURLToPath(new URL('./node_modules/three', import.meta.url)) },
    ],
    dedupe: ['react', 'react-dom', 'three', '@react-three/fiber', '@react-three/drei'],
  },
  // 5173 is occupied on this machine by another node process; strictPort makes a
  // clash fail loudly rather than silently drifting to the next free port, which
  // would leave .claude/launch.json waiting on the wrong one.
  server: {
    port: 5180,
    host: '0.0.0.0',
    strictPort: true,
    // VISUAL_REFERENCES holds design screenshots that get dropped in while the
    // server runs. On Windows a file still being written is locked, chokidar's
    // watch() throws EBUSY, and the FSWatcher error event takes the dev server
    // down with it. Nothing in there is an import, so it is not worth watching.
    watch: { ignored: ['**/VISUAL_REFERENCES/**'] },
  },
  build: {
    target: 'es2022',
    // ARTINOS copies MediaPipe runtime assets into dist. They may be held open
    // by a live local preview on Windows, so do not delete that directory as
    // part of a JavaScript bundle rebuild. New hashed application assets still
    // replace the referenced output in index.html.
    emptyOutDir: false,
    // Three WebGPU, TSL, R3F and the native Inspector intentionally share one
    // engine chunk. It is cacheable and smaller than duplicating engine graphs.
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@mediapipe/tasks-vision')) return 'vision'
          if (id.includes('postfx-pipeline') || id.includes('/addons/tsl/display/')) return 'postfx'
          if (id.includes('@react-three') || id.includes('/three/') || id.includes('three-stdlib') || id.includes('/react/') || id.includes('react-dom')) return 'rendering'
        },
      },
    },
  },
})
