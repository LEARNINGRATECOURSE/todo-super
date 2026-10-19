// Renders public/icon.svg to PNG icons using the preinstalled Chromium (via playwright-core if available).
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const svg = fs.readFileSync('public/icon.svg', 'utf8');
const exe = process.env.CHROMIUM_PATH || undefined;
const browser = await chromium.launch({ executablePath: exe });
fs.mkdirSync('public/icons', { recursive: true });
for (const [name, size, pad] of [['icon-192', 192, 0], ['icon-512', 512, 0], ['icon-maskable-512', 512, 0.12]]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const inner = Math.round(size * (1 - pad * 2));
  const off = Math.round(size * pad);
  await page.setContent(
    `<body style="margin:0;background:#e0e5ec"><div style="position:absolute;left:${off}px;top:${off}px;width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body>`,
  );
  await page.screenshot({ path: `public/icons/${name}.png` });
  await page.close();
}
await browser.close();
console.log('icons written');
