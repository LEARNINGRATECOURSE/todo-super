// End-to-end smoke test against a running preview server (default http://localhost:4173).
// Usage: SHOTS=/some/dir node scripts/smoke.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const URL = process.env.URL || 'http://localhost:4173';
const SHOTS = process.env.SHOTS || '/tmp/taskflow-shots';
const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ executablePath: exe });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, permissions: ['notifications'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

let step = 0;
const shot = async (name) => page.screenshot({ path: `${SHOTS}/${String(++step).padStart(2, '0')}-${name}.png` });
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) process.exitCode = 1; };

await page.goto(URL);
await page.waitForSelector('.tabbar');
await shot('today-empty');
check(await page.locator('h1', { hasText: 'Today' }).count() > 0, 'Today screen renders');

// create a task
await page.getByRole('button', { name: /Task/ }).first().click();
await page.getByPlaceholder('What needs doing?').fill('Write PRD review');
await page.locator('input[type=time]').nth(1).fill('10:00'); // start
await page.locator('input[type=time]').nth(2).fill('11:00'); // end
await page.getByRole('button', { name: 'Save', exact: true }).click();
await page.waitForSelector('text=Write PRD review');
check(true, 'task created and shown on timeline');
await shot('task-created');

// complete via check button
await page.getByRole('button', { name: 'Mark complete' }).first().click();
await page.waitForSelector('.strike', { timeout: 3000 }).catch(() => {});
check(await page.locator('.strike', { hasText: 'Write PRD review' }).count() > 0, 'task completes');
await shot('task-completed');

// load demo data via settings
await page.getByRole('button', { name: 'More', exact: true }).click();
await page.getByRole('button', { name: 'Settings' }).click();
await page.getByRole('button', { name: /Load 60 days/ }).click();
await page.getByRole('button', { name: 'Load', exact: true }).click();
await page.waitForTimeout(600);
await shot('settings');
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

// insights
await page.getByRole('button', { name: 'Insights' }).click();
await page.waitForSelector('text=Workout momentum');
check(true, 'insights generated from demo data');
await shot('insights');
await page.getByRole('button', { name: 'Notes' }).click();
await page.waitForSelector('text=Weekly review');
await shot('notes');
await page.getByRole('button', { name: 'Focus' }).click();
await shot('focus');

// Today with demo
await page.getByRole('button', { name: 'Today', exact: true }).click();
await page.waitForTimeout(400);
await shot('today-demo');
check(await page.locator('.metric').count() === 4, '4 metric cards');
check(await page.locator('.datechip').count() === 43, '±21 day date strip (43 chips)');

// calendar
await page.getByRole('button', { name: 'Calendar', exact: true }).click();
await page.waitForSelector('.cal-grid');
await shot('calendar');

// workout
await page.getByRole('button', { name: 'Workout', exact: true }).click();
await page.waitForTimeout(300);
await shot('workout');
await page.getByRole('button', { name: 'Plates' }).click();
await page.waitForSelector('text=Plate calculator');
await shot('plates');
await page.keyboard.press('Escape');
await page.getByRole('button', { name: 'Programs' }).click();
await page.waitForSelector('text=Program catalog');
check(await page.locator('text=Arnold Classic Volume Split').count() > 0, 'program catalog lists all programs');
await shot('programs');
await page.keyboard.press('Escape');

// start empty workout, add exercise, complete a set
await page.getByRole('button', { name: /Start empty workout/ }).click();
await page.getByRole('button', { name: 'Add exercise' }).click();
await page.getByPlaceholder('Search exercises').fill('Bench');
await page.getByText('Barbell Bench Press').first().click();
await page.getByRole('button', { name: 'Done' }).click();
await page.waitForSelector('text=Add set');
await page.getByLabel('Weight in kg').first().fill('62.5');
await page.getByRole('button', { name: 'Complete set' }).first().click();
await page.waitForTimeout(300);
await shot('active-workout');
check(await page.locator('text=Rest').count() > 0, 'rest timer starts after set');
await page.getByRole('button', { name: 'Finish workout' }).click();
await page.waitForSelector('text=Workout complete');
await shot('summary');
await page.getByRole('button', { name: 'Nice' }).click();

// habits
await page.getByRole('button', { name: 'Habits', exact: true }).click();
await page.waitForSelector('text=Consistency heatmap');
await shot('habits');

// offline: service worker controls page after reload
await page.reload();
await page.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 8000 }).catch(() => {});
const controlled = await page.evaluate(() => !!navigator.serviceWorker?.controller);
check(controlled, 'service worker controls the page');
await ctx.setOffline(true);
await page.reload();
await page.waitForSelector('.tabbar', { timeout: 8000 });
check(true, 'app reloads while offline');
await shot('offline');

console.log('\nConsole/page errors:', errors.length ? '\n' + errors.join('\n') : 'none');
if (errors.length) process.exitCode = 1;
await browser.close();
