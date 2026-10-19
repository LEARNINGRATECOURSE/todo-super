// Regression: typing several characters into a sheet input must keep focus.
import { chromium } from 'playwright-core';
const URL = process.env.URL || 'http://localhost:4175/todo-super/';
const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(URL); await page.waitForSelector('.tabbar');
await page.getByRole('button', { name: /Task/ }).first().click();
await page.getByPlaceholder('What needs doing?').click();
await page.keyboard.type('Buy milk and eggs');
const v = await page.getByPlaceholder('What needs doing?').inputValue();
console.log(v === 'Buy milk and eggs' ? 'PASS' : `FAIL  typed "Buy milk and eggs", got "${v}"`);
await browser.close();
