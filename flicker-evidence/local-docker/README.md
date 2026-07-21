# Home-page reload flicker — local Docker reproduction & fix verification

This folder documents an independent, fully local reproduction of the reload flicker and a
verification of the consolidated fix (hydration-safe anti-flicker overlay + the two Copilot-review
follow-ups), captured on `2026-07-21`.

## Stack

- **Backend:** genuine upstream **stock `dspace/dspace:dspace-8_x-test`** (+ `dspace-postgres-pgcrypto`,
  `dspace-solr`, all `dspace-8_x`) on a **clean, empty DB** in Docker. (The UoE *datashare* backend was
  not used because its custom migrations fail on a clean DB, and the upstream demo-entities SQL dump now
  carries DSpace 9/10 Flyway history that the 8.3 backend rejects. Neither matters: the flicker is a
  front-end hydration/theming effect, so any working DSpace 8 REST backend reproduces it.)
- **Frontend:** this branch, built with `yarn build:prod` and served via the production SSR server
  (`node dist/server/main.js`), pointed at the local backend over `host.docker.internal`.
- **Theme:** base `dspace` theme (empty stock repo). The flicker and the fix are theme-independent —
  every visible wrapper is a `ThemedComponent` regardless of the concrete theme — and the id-gated CSS
  most at risk from the (rejected) id-stripping is actually *heavier* on the `dspace` theme, so this is
  a conservative test.
- **Capture:** Playwright + CDP `Page.startScreencast` (change-driven, high-fps, so the sub-second
  navbar rebuild is actually sampled), 4× CPU throttle to widen the window (mirrors low-end clients
  where the flicker is worst). Metric: per-frame pixel diff of the **navbar band (top 110 px)** against
  the final settled frame.

The overlay self-disables under `navigator.webdriver` (so it never touches Cypress/Playwright e2e).
The "before" run therefore uses Playwright's default (`webdriver = true` → overlay OFF → raw flicker);
the "after" run spoofs `navigator.webdriver = false` (→ overlay ON → fixed).

## Result

| Run | Overlay | Navbar max deviation from final | Flicker duration |
|-----|---------|--------------------------------:|-----------------:|
| **before** | OFF | **73.9 %** | **~2170 ms** |
| **after**  | ON  | **0.4 %** (noise) | **0 ms** |

- `01-before-navbar-missing-2330ms.png` — during reload the **entire header/navbar is gone** (just the
  thin green strip at the top); the banner/search below have already painted. This is the flicker.
- `02-before-settled-navbar-present.png` — the same page ~600 ms later, navbar fully rendered. The abrupt
  pop-in between these two is what the user sees on every reload.
- `03-after-overlay-clone-stable-1349ms.png` — with the overlay ON, a frozen **clone** of the SSR paint
  holds the complete navbar continuously while hydration + the themed re-render happen invisibly beneath;
  navbar deviation stays ≤ 0.4 % the whole time, then the clone fades out over 150 ms with no jump.
- `04-before-diff-navbar-region.png` — pixel-diff of the two "before" frames, highlighting the missing
  navbar region.

## Why id-stripping was NOT added (Copilot follow-up)

An earlier iteration stripped every `id` from the clone (a Copilot suggestion on the sibling PR #16).
Measured against this exact stack it made the frozen clone render **40.65 %** differently from the final
page — the id-gated CSS (`#main-content { flex: 1 1 100% }` globally; header/nav ids under emulated
encapsulation) stops matching once the id is dropped, so the fade-out became the very layout jump the
overlay exists to hide. It was reverted; the clone keeps all ids and stays pixel-identical (removal diff
0.4 % vs 40.65 %). Duplicate ids are harmless here because the clone is appended after `<ds-app>`, so
`getElementById`/`querySelector` resolve to the live element by document order. See the comment in
`src/index.html`.
