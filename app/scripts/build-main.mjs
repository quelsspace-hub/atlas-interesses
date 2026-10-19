// Empacota processo principal e preload em CommonJS (o preload com sandbox exige CJS).
import { build } from 'esbuild'

const common = { bundle: true, platform: 'node', target: 'node22', format: 'cjs', sourcemap: true, external: ['electron'], logLevel: 'info' }

await build({ ...common, entryPoints: ['src/main/main.ts'], outfile: 'dist/main/main.cjs' })
await build({ ...common, entryPoints: ['src/preload/preload.ts'], outfile: 'dist/preload/preload.cjs' })
