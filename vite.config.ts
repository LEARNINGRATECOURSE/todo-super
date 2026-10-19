import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

/** Injects the hashed build assets into sw.js so the whole app works offline after the first visit. */
function precacheServiceWorker() {
  let outDir = 'dist';
  return {
    name: 'taskflow-precache-sw',
    apply: 'build' as const,
    configResolved(cfg: { build: { outDir: string } }) { outDir = cfg.build.outDir; },
    closeBundle() {
      const walk = (dir: string): string[] =>
        fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
      const files = walk(outDir)
        .map((f) => '/' + path.relative(outDir, f).split(path.sep).join('/'))
        .filter((f) => f.startsWith('/assets/') && !f.endsWith('.map'));
      const swPath = path.join(outDir, 'sw.js');
      if (!fs.existsSync(swPath)) return;
      const id = Date.now().toString(36);
      const src = fs.readFileSync(swPath, 'utf8').replace('/*__PRECACHE__*/[]', JSON.stringify(files)).replace('__BUILD_ID__', id);
      fs.writeFileSync(swPath, src);
    },
  };
}

export default defineConfig({
  plugins: [react(), precacheServiceWorker()],
  build: { target: 'es2022', sourcemap: false },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
