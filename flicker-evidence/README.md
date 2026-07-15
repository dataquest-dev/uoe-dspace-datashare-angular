# Home-page reload flicker — reproduction & fix evidence

Reproduced locally in Docker (`Dockerfile.dist` production/SSR build, `docker/dspace-ui.json` via
pm2) against a local DSpace 8.x REST backend (`dspace/dspace:dspace-8_x-test` +
`dspace-postgres-pgcrypto` + `dspace-solr`, all `dspace-8_x`), with one seeded community/collection
so the home page has real async content to load. Screenshots captured with Playwright
(`page.reload({ waitUntil: 'commit' })`, screenshots every ~60ms).

## Root cause

`provideClientHydration()` is enabled, so Angular does not tear down and rebuild the whole SSR DOM
on reload as it does on this org's older Angular-15/DSpace-7 customer instances. But DSpace's
`ThemedComponent` (e.g. the themed header/navbar) builds its real content **imperatively** via
`ViewContainerRef.createComponent()` inside a client-side, async `ngAfterViewInit` (dynamic import
of the theme chunk). Angular hydration cannot reuse an imperatively-created component, so that
subtree is destroyed and re-created client-side — visibly, since it happens after the rest of the
page has already painted. Same class of bug as upstream DSpace/dspace-angular#3867.

## Before (unfixed) — `01`/`02`

- `01-before-half-built-1483ms.png` (t≈1.48s after reload): banner + search box are rendered, but
  the header navbar (Communities & Collections / Browse / Statistics / Log In) is **entirely
  missing** — just a thin green strip where it belongs.
- `02-before-navbar-pops-in-2004ms.png` (t≈2.00s): ~500ms later the navbar pops in, pushing
  everything below it down. That abrupt pop-in between these two frames is the reported flicker —
  confirmed as an 80%+ pixel-diff between consecutive captures, and reproduced consistently across
  repeated reloads (2 of 3 runs in one back-to-back batch).

## After (fixed) — `03`/`04`

With the hydration-safe anti-flicker overlay (`src/index.html` + `AppComponent`), a detached CLONE
of the SSR-painted page is held on top (not the live DOM Angular is hydrating underneath — that
would break hydration on this Angular-17 app) until the live `<ds-app>` DOM has settled (no
element added/removed for 600ms, with real content present). Only then is the clone faded out
over 150ms.

- `03-after-frozen-clone-951ms.png`: navbar already present (it's the frozen clone — pixel-identical
  to the final page).
- `04-after-settled-no-jump-1949ms.png`: after the crossfade, still pixel-identical content —
  no layout jump, no missing navbar at any point. The only frame-to-frame change during the whole
  reload is the ~150ms opacity crossfade itself (a smooth reveal, not a flicker), and repeated
  reloads showed no pop-in.

## Note on the overlay's WebDriver bypass

The bootstrap script intentionally no-ops when `navigator.webdriver` is true (Cypress/Playwright/
Selenium — see comment in `src/index.html`), so these captures spoof
`navigator.webdriver = false` via `page.addInitScript` to observe the overlay's real behavior
rather than its automation bypass. Captures against the *unfixed* app, and against the *fixed*
build with the spoof removed (overlay bypassed), both still show the same navbar pop-in — showing
it's genuinely the overlay that eliminates the flicker, not some other change.
