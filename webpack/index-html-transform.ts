import { readFileSync } from 'fs';
import { join } from 'path';
import { minify } from 'terser';

/**
 * Build-time index.html transform (wired via `indexTransform` in angular.json).
 *
 * Inlines `src/anti-flicker-overlay.js` into index.html as a synchronous `<script>` at the
 * ANTI_FLICKER_OVERLAY marker. The overlay has to run inline, before the deferred module bundles,
 * so it cannot live inside the Angular app — but keeping its source in a real, lint-and-format-able
 * file rather than pasted into index.html is the only reason this transform exists.
 *
 * The script is minified before it is inlined, so the served HTML carries a single compact line
 * rather than the full readable source. The source file stays readable; the browser gets the minified
 * form. Runtime behaviour is unchanged.
 */

const MARKER = /<!--\s*ANTI_FLICKER_OVERLAY:[\s\S]*?-->/;
const OVERLAY_SRC = join(__dirname, '..', 'src', 'anti-flicker-overlay.js');
const BANNER = '/* anti-flicker overlay - source: src/anti-flicker-overlay.js */';

export default async function transformIndexHtml(_targetOptions: unknown, indexHtml: string): Promise<string> {
  if (!MARKER.test(indexHtml)) {
    throw new Error(
      'index-html-transform: ANTI_FLICKER_OVERLAY marker not found in index.html — ' +
      'the anti-flicker overlay would be missing from the build.',
    );
  }

  const source = readFileSync(OVERLAY_SRC, 'utf8');
  const result = await minify(source, {
    ecma: 5,             // the overlay is ES5 and must stay ES5 (it runs before any polyfill)
    compress: true,
    mangle: true,
    format: { comments: false, preamble: BANNER },
  });
  if (!result.code) {
    throw new Error('index-html-transform: terser produced no output for the anti-flicker overlay.');
  }

  // Guard against a literal "</script>" in the minified output closing the tag early.
  const safe = result.code.replace(/<\/script>/gi, '<\\/script>');
  return indexHtml.replace(MARKER, `<script>${safe}</script>`);
}
