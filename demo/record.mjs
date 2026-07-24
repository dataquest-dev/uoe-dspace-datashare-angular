// Records BEFORE and AFTER videos of the repeatable-dropdown duplicate fix.
// Usage: npm install && npx playwright install chromium && node record.mjs
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { renameSync, mkdirSync, existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pageUrl = (mode) => pathToFileURL(join(__dirname, 'index.html')).href + '?mode=' + mode;
const outDir = join(__dirname, 'videos');
const size = { width: 940, height: 720 };

if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function step(page, tag, text, ms = 1500) {
  await page.evaluate(([t, x]) => window.setCaption(t, x), [tag, text]);
  await sleep(ms);
}

async function record(mode) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: size,
    recordVideo: { dir: outDir, size },
  });
  const page = await context.newPage();
  await page.goto(pageUrl(mode));
  await sleep(1200);

  const label = mode === 'after' ? 'AFTER (fixed)' : 'BEFORE (merged PR #26)';
  await step(page, label, 'Repeatable “Funder” field. Let\u2019s add two rows.', 2000);

  // Row 1 -> select National Science Foundation
  await step(page, 'Step 1', 'Row 1: open the funder dropdown.', 1200);
  await page.click('[data-testid="input-0"]');
  await sleep(700);
  await step(page, 'Step 1', 'Choose “National Science Foundation”.', 1400);
  await page.click('[data-testid="opt-0-nsf"]');
  await sleep(900);

  // Add row 2
  await step(page, 'Step 2', 'Add a second funder row.', 1300);
  await page.click('[data-testid="add"]');
  await sleep(700);
  await step(page, 'Step 2', 'Row 2: open the dropdown.', 1200);
  await page.click('[data-testid="input-1"]');
  await sleep(900);

  if (mode === 'before') {
    await step(page, 'Bug', 'BEFORE: the already-used funder is NOT greyed out\u2026', 2200);
    await step(page, 'Bug', 'Select the SAME funder again.', 1400);
    await page.click('[data-testid="opt-1-nsf"]');
    await sleep(900);
    await step(page, 'Result', '\u26A0 Duplicate persisted \u2014 same authority in two rows.', 3200);
  } else {
    await step(page, 'Fix', 'AFTER: the already-used funder is greyed out (disabled).', 2400);
    await step(page, 'Fix', 'Clicking it does nothing \u2014 duplicate is blocked.', 1600);
    await page.click('[data-testid="opt-1-nsf"]');
    await sleep(900);
    await step(page, 'Fix', 'Pick a different funder instead: “European Research Council”.', 1600);
    await page.click('[data-testid="opt-1-erc"]');
    await sleep(900);
    await step(page, 'Result', '\u2713 No duplicates \u2014 every row references a distinct funder.', 3200);
  }

  const videoPath = await page.video().path();
  await context.close();
  await browser.close();

  const target = join(outDir, mode + '.webm');
  renameSync(videoPath, target);
  console.log('Saved', target);
}

await record('before');
await record('after');
console.log('Done. Videos in', outDir);
