// Regression: estimate stays editable after start/end times are set, and the two stay in sync.
import { chromium } from 'playwright-core';
const URL = process.env.URL || 'http://localhost:4176/todo-super/';
const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(URL); await page.waitForSelector('.tabbar');
await page.getByRole('button', { name: /Task/ }).first().click();
await page.getByPlaceholder('What needs doing?').fill('Estimate test');
const start = page.getByLabel('Start (time block)');
const end = page.getByLabel('End', { exact: true });
const est = page.getByLabel('Value').first();
await start.fill('10:00');
await end.fill('11:00');
const results = [];
results.push(['estimate field visible after setting end time', await est.isVisible()]);
results.push([`estimate derived from span (got ${await est.inputValue()})`, (await est.inputValue()) === '60']);
await est.fill('90');
results.push([`estimate 90 moves end to 11:30 (got ${await end.inputValue()})`, (await end.inputValue()) === '11:30']);
await page.getByRole('button', { name: 'Increase' }).click();
results.push([`stepper + moves estimate to 95 (got ${await est.inputValue()})`, (await est.inputValue()) === '95']);
await end.fill('10:30');
results.push([`end 10:30 updates estimate to 30 (got ${await est.inputValue()})`, (await est.inputValue()) === '30']);
let ok = true;
for (const [msg, pass] of results) { console.log(pass ? 'PASS' : 'FAIL', msg); ok &&= pass; }
await browser.close();
process.exitCode = ok ? 0 : 1;
