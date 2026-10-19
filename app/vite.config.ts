import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Renderer: arquivos locais carregados por loadFile, por isso base relativa.
export default defineConfig({
  root: 'src/renderer',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist/renderer', emptyOutDir: true, target: 'chrome130' }
})
