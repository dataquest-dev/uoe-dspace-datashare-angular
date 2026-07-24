// Captures still screenshots of the decisive BEFORE/AFTER states.
import { chromium } from 'playwright';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pageUrl = (mode) => pathToFileURL(join(__dirname, 'index.html')).href + '?mode=' + mode;
const size = { width: 940, height: 720 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();

// BEFORE: duplicate persisted
{
  const page = await browser.newPage({ viewport: size });
  await page.goto(pageUrl('before'));
  await page.click('[data-testid="input-0"]');
  await page.click('[data-testid="opt-0-nsf"]');
  await page.click('[data-testid="add"]');
  await page.click('[data-testid="input-1"]');
  await page.click('[data-testid="opt-1-nsf"]');
  await page.evaluate(() => window.setCaption('Before', 'Duplicate funder persisted (same authority in two rows).'));
  await sleep(400);
  await page.screenshot({ path: join(__dirname, 'videos', 'before.png') });
  await page.close();
}

// AFTER: option greyed out / blocked
{
  const page = await browser.newPage({ viewport: size });
  await page.goto(pageUrl('after'));
  await page.click('[data-testid="input-0"]');
  await page.click('[data-testid="opt-0-nsf"]');
  await page.click('[data-testid="add"]');
  await page.click('[data-testid="input-1"]');
  await page.evaluate(() => window.setCaption('After', 'The already-used funder is greyed out and cannot be selected.'));
  await sleep(400);
  await page.screenshot({ path: join(__dirname, 'videos', 'after.png') });
  await page.close();
}

await browser.close();
console.log('Screenshots saved to videos/before.png and videos/after.png');
