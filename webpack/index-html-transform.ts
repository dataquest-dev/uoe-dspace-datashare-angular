import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Build-time index.html transform (wired via `indexTransform` in angular.json).
 *
 * Inlines `src/anti-flicker-overlay.js` into index.html as a synchronous `<script>` at the
 * ANTI_FLICKER_OVERLAY marker. The overlay has to run inline, before the deferred module bundles,
 * so it cannot live inside the Angular app — but keeping its source in a real, lint-and-format-able
 * file rather than pasted into index.html is the only reason this transform exists. The browser still
 * receives it inline; nothing about the runtime behaviour changes.
 */

const MARKER = /<!--\s*ANTI_FLICKER_OVERLAY:[\s\S]*?-->/;
const OVERLAY_SRC = join(__dirname, '..', 'src', 'anti-flicker-overlay.js');

export default function transformIndexHtml(_targetOptions: unknown, indexHtml: string): string {
  if (!MARKER.test(indexHtml)) {
    throw new Error(
      `index-html-transform: ANTI_FLICKER_OVERLAY marker not found in index.html — ` +
      `the anti-flicker overlay would be missing from the build.`,
    );
  }
  const script = readFileSync(OVERLAY_SRC, 'utf8');
  // Guard against a "</script>" sequence inside the source closing the tag early.
  const safe = script.replace(/<\/script>/gi, '<\\/script>');
  return indexHtml.replace(MARKER, `<script>\n${safe}\n</script>`);
}
