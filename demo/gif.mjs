// Builds animated GIFs (before.gif / after.gif) of the dropdown behaviour,
// so they can be embedded inline in a GitHub PR comment. No ffmpeg required.
import { chromium } from 'playwright';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import gifenc from 'gifenc';

const { GIFEncoder, quantize, applyPalette } = gifenc;

const __dirname = dirname(fileURLToPath(import.meta.url));
const pageUrl = (mode) => pathToFileURL(join(__dirname, 'index.html')).href + '?mode=' + mode;
const size = { width: 820, height: 600 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function frames(mode) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: size });
  await page.goto(pageUrl(mode));
  const out = [];

  const cap = async (tag, text, delay, action) => {
    if (action) { await action(); }
    await page.evaluate(([t, x]) => window.setCaption(t, x), [tag, text]);
    await sleep(350);
    const png = PNG.sync.read(await page.screenshot());
    out.push({ rgba: new Uint8Array(png.data), w: png.width, h: png.height, delay });
  };

  const label = mode === 'after' ? 'AFTER (fixed)' : 'BEFORE (PR #26)';
  await cap(label, 'Repeatable \u201CFunder\u201D field \u2014 authority-controlled.', 1700);
  await cap('Step 1', 'Row 1: open the funder dropdown.', 1200, () => page.click('[data-testid="input-0"]'));
  await cap('Step 1', 'Choose \u201CNational Science Foundation\u201D.', 1300, () => page.click('[data-testid="opt-0-nsf"]'));
  await cap('Step 2', 'Add a second funder row.', 1100, () => page.click('[data-testid="add"]'));
  await cap('Step 2', 'Row 2: open the dropdown.', 1300, () => page.click('[data-testid="input-1"]'));

  if (mode === 'before') {
    await cap('Bug', 'BEFORE: the already-used funder is NOT greyed out.', 2100);
    await cap('Bug', 'Select the SAME funder again\u2026', 1300, () => page.click('[data-testid="opt-1-nsf"]'));
    await cap('Result', '\u26A0 Duplicate persisted \u2014 same authority twice.', 2700);
  } else {
    await cap('Fix', 'AFTER: the used funder is greyed out (disabled).', 2200);
    await cap('Fix', 'Clicking it does nothing \u2014 blocked.', 1500, () => page.click('[data-testid="opt-1-nsf"]'));
    await cap('Fix', 'Pick a different funder instead.', 1300, () => page.click('[data-testid="opt-1-erc"]'));
    await cap('Result', '\u2713 No duplicates \u2014 distinct funders.', 2700);
  }

  await browser.close();
  return out;
}

async function build(mode) {
  const fs = await frames(mode);
  const gif = GIFEncoder();
  for (const f of fs) {
    const palette = quantize(f.rgba, 256);
    const index = applyPalette(f.rgba, palette);
    gif.writeFrame(index, f.w, f.h, { palette, delay: f.delay });
  }
  gif.finish();
  const target = join(__dirname, 'videos', mode + '.gif');
  writeFileSync(target, gif.bytes());
  console.log('Saved', target, (gif.bytes().length / 1024).toFixed(0) + ' KB');
}

await build('before');
await build('after');
console.log('Done.');
