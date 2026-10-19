// Gesture + feature flows against a running preview server. Usage: SHOTS=dir node scripts/flows.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const URL = process.env.URL || 'http://localhost:4173';
const SHOTS = process.env.SHOTS || '/tmp/taskflow-shots2';
const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ executablePath: exe });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
let n = 0;
const shot = (name) => page.screenshot({ path: `${SHOTS}/${String(++n).padStart(2, '0')}-${name}.png` });
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) process.exitCode = 1; };
const tab = (name) => page.getByRole('button', { name, exact: true }).last().click();

await page.goto(URL);
await page.waitForSelector('.tabbar');

// ---- add 3 tasks
for (const t of ['Alpha task', 'Beta task', 'Gamma task']) {
  await page.getByRole('button', { name: /Task/ }).first().click();
  await page.getByPlaceholder('What needs doing?').fill(t);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForSelector(`text=${t}`);
}
await page.waitForTimeout(3300);

// ---- swipe right to complete (pointer events)
const swipe = async (text, dx) => {
  const box = await page.locator('.swipe', { hasText: text }).first().boundingBox();
  const y = box.y + box.height / 2, x = box.x + box.width / 2;
  await page.mouse.move(x, y); await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(x + (dx * i) / 10, y);
  await page.mouse.up();
};
await swipe('Alpha task', 160);
await page.waitForTimeout(400);
check(await page.locator('.strike', { hasText: 'Alpha task' }).count() > 0, 'swipe-right completes a task');

// ---- swipe left to delete, undo restores
await swipe('Beta task', -160);
await page.waitForTimeout(400);
check(await page.locator('.swipe', { hasText: 'Beta task' }).count() === 0, 'swipe-left deletes a task');
await page.getByRole('button', { name: 'Undo' }).click();
await page.waitForSelector('.swipe >> text=Beta task');
check(true, 'undo restores the deleted task');

// ---- long press -> multi-select -> batch complete
const gamma = await page.locator('.swipe', { hasText: 'Gamma task' }).first().boundingBox();
await page.mouse.move(gamma.x + 150, gamma.y + 30); await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up();
await page.waitForSelector('text=1 selected');
await page.locator('.swipe', { hasText: 'Beta task' }).first().click();
await page.waitForSelector('text=2 selected');
await shot('multiselect');
await page.getByRole('button', { name: /Complete all/ }).click();
await page.waitForTimeout(300);
check(await page.locator('.strike').count() >= 3, 'batch complete all selected');

// ---- board + matrix render
await page.getByRole('button', { name: 'Board' }).click();
await page.waitForSelector('text=In progress');
await shot('board');
await page.getByRole('button', { name: 'Matrix' }).click();
await page.waitForSelector('text=Do first');
await shot('matrix');
await page.getByRole('button', { name: 'Timeline' }).click();

// ---- create interval habit and chain
await tab('Habits');
await page.getByRole('button', { name: /Habit/ }).first().click();
await page.getByPlaceholder('e.g. Drink water').fill('Hydrate');
await page.getByRole('button', { name: 'Interval' }).click();
await page.waitForSelector('text=Every (h)');
await shot('habit-editor');
await page.getByRole('button', { name: 'Save', exact: true }).click();
await page.waitForSelector('text=Hydrate');
// second habit: chained from the first? create "Stretch" then chain Hydrate -> Stretch
await page.getByRole('button', { name: /Habit/ }).first().click();
await page.getByPlaceholder('e.g. Drink water').fill('Stretch');
await page.getByRole('button', { name: 'Save', exact: true }).click();
await page.getByRole('button', { name: 'Edit habit' }).first().click();
await page.locator('select').last().selectOption({ label: '💧 Stretch' });
await page.getByRole('button', { name: 'Save', exact: true }).click();
await page.waitForTimeout(300);
await shot('habits-list');

// check-in a slot on Habits tab -> partial
const slotBtn = page.locator('.pill[aria-pressed]').filter({ hasText: /AM|PM/ }).first();
await slotBtn.click();
check((await slotBtn.getAttribute('aria-pressed')) === 'true', 'slot check-in toggles');

// toggle Stretch boolean complete -> no chain; complete Hydrate fully triggers anchor on Today
await tab('Today');
await page.waitForTimeout(300);
await shot('today-with-slots');
const slotsOnTimeline = await page.locator('.tl-item .check').count();
check(slotsOnTimeline >= 3, `habit slots appear on the timeline (${slotsOnTimeline})`);

// ---- freeze
await tab('Habits');
await page.getByRole('button', { name: 'Freeze streak for this day' }).nth(1).click();
await page.waitForSelector('text=Streak protected');
check(true, 'freeze day shows protected state');
await shot('freeze');

// ---- workout flows with demo data
await tab('More');
await page.getByRole('button', { name: 'Settings' }).click();
await page.getByRole('button', { name: /Load 60 days/ }).click();
await page.getByRole('button', { name: 'Load', exact: true }).click();
await page.waitForTimeout(500);
// export backup download
const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download' }).click()]);
const backupPath = `${SHOTS}/backup.json`;
await dl.saveAs(backupPath);
const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
check(backup.app === 'taskflow-pro' && Object.keys(backup.tables).length === 17 && backup.tables.workout_sessions.length > 20, 'JSON backup has all 17 tables');
await page.keyboard.press('Escape');

await tab('Workout');
// switch to LB, instant conversion
await page.getByRole('button', { name: 'LB', exact: true }).click();
await page.getByRole('button', { name: 'History' }).click();
await page.waitForSelector('text=lb');
check(true, 'unit toggle converts history display to lb');
await page.getByRole('button', { name: 'KG', exact: true }).click();
await page.getByRole('button', { name: 'Progress' }).click();
await page.waitForSelector('text=Weekly volume');
await shot('progress');
await page.getByRole('button', { name: 'Routines' }).click();
await shot('routines');

// start planned workout, push bench to trigger PR
await page.getByRole('button', { name: 'Start', exact: true }).first().click();
await page.waitForSelector('text=Add exercise');
await shot('routine-workout');
const w = page.getByLabel('Weight in kg').first();
await w.fill('140');
await page.getByRole('button', { name: 'Complete set' }).first().click();
await page.waitForSelector('text=New personal record', { timeout: 3000 });
check(true, 'PR celebration banner on heavier-than-history set');
await shot('pr');
await page.getByRole('button', { name: "Let's go" }).click();
// reload mid-workout -> persists
await page.reload();
await page.waitForSelector('.tabbar');
await tab('Workout');
check(await page.getByText('Workout in progress').count() > 0, 'active workout survives reload');
await page.getByText('Workout in progress').first().click();
await page.waitForSelector('text=Session wrap-up');
await page.getByRole('button', { name: 'Finish workout' }).click();
await page.waitForSelector('text=Workout complete');
await shot('summary');
await page.getByRole('button', { name: 'Nice' }).click();

// calendar day agenda
await tab('Calendar');
await page.waitForSelector('.cal-grid');
await page.locator('.cal-day:not(.out)').nth(14).click();
await shot('calendar-agenda');

// restore backup through UI
await tab('More');
await page.getByRole('button', { name: 'Settings' }).click();
await page.locator('input[type=file]').setInputFiles(backupPath);
await page.getByRole('button', { name: 'Restore', exact: true }).click();
await page.waitForSelector('text=Backup restored');
check(true, 'backup restore succeeds');
await page.keyboard.press('Escape');

console.log('\nConsole/page errors:', errors.length ? '\n' + errors.join('\n') : 'none');
if (errors.length) process.exitCode = 1;
await browser.close();
