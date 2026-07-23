/* eslint-disable */
// This file is inlined verbatim into index.html at build time (see webpack/index-html-transform.ts,
// wired via the build's indexTransform in angular.json). It must stay dependency-free, ES5-safe and
// self-contained: it runs as a synchronous inline <script> before the deferred module bundles, which
// is the only point at which a mask can be installed before the SSR DOM is painted. Editing it here
// keeps index.html clean while the browser still receives it inline.

/*
  Anti-flicker overlay: paints a detached clone of the settled page on top while <ds-app> re-renders,
  and lifts once the routed page is genuinely painted (150ms fade).

  Why it is needed: provideClientHydration() is enabled, but DSpace's theme system defeats it. Every
  wrapper is a `ds-themed-*` whose real content is built imperatively via ViewContainerRef
  .createComponent() in a client-side ngAfterViewInit, so hydration cannot reuse it and every themed
  subtree is destroyed and rebuilt a beat after first paint. Upstream: DSpace/dspace-angular#3867.
  The same mask covers the post-login white flash, where root.component hides `.outer-wrapper` behind
  `.ds-full-screen-loader` across the `/reload/<ts>` -> `/home` redirect.

  It must be inline and synchronous: the CLI injects the bundles as deferred module scripts, so no
  Angular hook can run before the SSR DOM has already been painted.

  Safety rails: self-disables under Cypress / navigator.webdriver, never absorbs input, lifts on the
  first user interaction, and has a 15s hard cap -- it can never trap the user behind a frozen frame.
*/
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') { return; }
  // Cypress drives the real app; a duplicated clone would break element-uniqueness selectors.
  if (typeof window.Cypress !== 'undefined') { return; }
  // Same reasoning for any WebDriver-based automation (Playwright/Selenium/headless CI).
  if (typeof navigator !== 'undefined' && navigator.webdriver) { return; }

  var STORE_KEY = '__dspace_ssr_frame';
  var LOGIN_ANIM_KEY = 'ds-login-sidebar-anim'; // one-shot flag set by the auth effect on a real login
  var OVERLAY_ID = '__dspace_ssr_overlay';
  var MIN_CONTENT_HEIGHT = 200; // px: proves #main-content is no longer the d-none'd / empty shell
  var MASK_MAX_MS = 15000;      // absolute cap per mask -- never trap the user behind a frozen frame

  function dsApp() { return document.querySelector('ds-app'); }

  // "Real content" = has children and is NOT the fullscreen auth/theme loader (white + spinner).
  function isRealContent(el) {
    return !!(el && el.firstElementChild && !el.querySelector('.ds-full-screen-loader'));
  }

  // True if this <ds-app> subtree is rendered in the LOGGED-IN state: the header shows the user-menu
  // (avatar / logout), never present when logged out. Used to pick a mask source whose auth state (and
  // therefore its admin sidebar / content offset) matches what the reloaded page will settle to.
  function loggedInChrome(el) {
    return !!(el && el.querySelector && el.querySelector('.fa-user-circle, .dropdownLogout, [data-test="user-menu"]'));
  }

  // The routed page is actually painted (safe to reveal): no fullscreen loader AND #main-content has
  // real layout height. While the loader shows, root.component.html d-none's #main-content's wrapper,
  // so its own getBoundingClientRect height is 0 even though it is still in the DOM.
  function contentPainted() {
    var app = dsApp();
    if (!app) { return true; }
    if (app.querySelector('.ds-full-screen-loader')) { return false; }
    var mc = app.querySelector('#main-content');
    var h = (mc && mc.getBoundingClientRect) ? mc.getBoundingClientRect().height : 0;
    if (h < MIN_CONTENT_HEIGHT) { return false; }
    // Also require the themed navbar to be present with real height. #main-content reports height even
    // while the imperative themed re-render (header/navbar) is still mid-flight or the async home data
    // hasn't landed -- revealing then flashes an unstyled/half-built page. The themed navbar being laid
    // out is a good "the routed page is really rendered" proxy on the datashare theme. If a route has no
    // such navbar this stays false and the 15s cap reveals anyway.
    var nav = app.querySelector('#main-navbar');
    var nh = (nav && nav.getBoundingClientRect) ? nav.getBoundingClientRect().height : 0;
    return nh > 0;
  }

  function currentUrl() { return location.pathname + location.search; }

  // Remember the current real view so a later loader/racy-reload can be masked with it. Keyed by URL:
  // masking a page with a picture of a DIFFERENT one (or with logged-in chrome after a logout) shows
  // the user a page they are not on any more.
  function rememberFrame() {
    var app = dsApp();
    if (isRealContent(app)) {
      try {
        sessionStorage.setItem(STORE_KEY, JSON.stringify({ url: currentUrl(), html: app.outerHTML }));
      } catch (e) { /* quota / disabled */ }
    }
  }
  function savedFrameNode() {
    var saved = null;
    try { saved = sessionStorage.getItem(STORE_KEY); } catch (e) { /* disabled */ }
    if (!saved) { return null; }
    var frame = null;
    try { frame = JSON.parse(saved); } catch (e) { return null; }
    if (!frame || !frame.html || frame.url !== currentUrl()) { return null; }
    var holder = document.createElement('div');
    holder.innerHTML = frame.html;
    return holder.firstElementChild; // the saved <ds-app> element, _ngcontent attrs intact
  }

  // Install an opaque, inert freeze-frame from a detached <ds-app> node, then watch for reveal.
  function installMask(sourceNode) {
    if (!sourceNode || document.getElementById(OVERLAY_ID)) { return; }
    var overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    // Visual duplicate of content the real app still exposes; hide from a11y tree + make inert so
    // keyboard focus can't land on the dead cloned controls.
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('inert', '');
    overlay.appendChild(sourceNode);
    overlay._dsDeadline = Date.now() + MASK_MAX_MS;
    document.body.appendChild(overlay);
    revealWhenPainted();
  }

  // DOM activity clock: the MutationObserver below stamps this on every childList change, so the
  // reveal can wait for the app to go QUIET (the themed re-render on reload, and the loader dance on
  // login, both churn the DOM) rather than lifting the instant content first appears.
  var lastMutationAt = Date.now();
  var SETTLE_QUIET_MS = 800;

  // Lift the current mask once the routed page is painted AND the DOM has settled (or the 15s cap
  // elapses); 150ms fade. Waiting for both is what keeps the reload's themed-wrapper re-render and
  // the post-login loader from peeking out: content-painted alone fires a frame or two too early.
  function revealWhenPainted() {
    var el = document.getElementById(OVERLAY_ID);
    if (!el || el._dsFading) { return; }
    var settled = contentPainted() && (Date.now() - lastMutationAt) >= SETTLE_QUIET_MS;
    if (!settled && Date.now() < el._dsDeadline) {
      if (typeof window.requestAnimationFrame === 'function') { window.requestAnimationFrame(revealWhenPainted); }
      else { setTimeout(revealWhenPainted, 50); }
      return;
    }
    // The live page is now settled: remember it as the frame to mask the NEXT reload with, so that
    // reload's mask matches this exact rendered state (incl. client-only chrome like the admin sidebar).
    // Only when genuinely settled -- never on a deadline bail-out over a half-built page.
    if (settled) { rememberFrame(); }
    el._dsFading = true;
    el.style.transition = 'opacity 150ms ease-out';
    el.style.opacity = '0';
    setTimeout(function () {
      if (el && el.parentNode) { el.parentNode.removeChild(el); }
      // Play the login entrance only once the mask is gone AND stays gone: login redirects through
      // /reload -> /home with several mask/reveal cycles, so an earlier transient reveal must not
      // consume the one-shot flag before the final, visible reveal. A short grace with no re-mask is
      // the "this reveal stuck" signal.
      setTimeout(maybePlayLoginSidebarEntrance, 250);
    }, 200);
  }

  // Slide the admin sidebar into its already-reserved gutter after a genuine login (flag set by the
  // auth effect). The animation is a transform on the fixed sidebar, so the page content never moves --
  // this is not the gutter shift, and it only ever runs on login (one-shot flag, absent on a reload).
  // Skips (without consuming the flag) unless the page is really settled: no overlay, admin sidebar
  // present, routed content painted. Driven by a body class + CSS keyframes.
  function maybePlayLoginSidebarEntrance() {
    if (document.getElementById(OVERLAY_ID)) { return; }        // re-masked -> this reveal did not stick
    if (!document.getElementById('admin-sidebar')) { return; }  // not the logged-in page yet
    if (!contentPainted()) { return; }
    var flagged = false;
    try {
      flagged = sessionStorage.getItem(LOGIN_ANIM_KEY) === '1';
      if (flagged) { sessionStorage.removeItem(LOGIN_ANIM_KEY); }
    } catch (e) { return; } // storage disabled
    if (!flagged) { return; }
    document.body.classList.add('ds-login-sidebar-anim');
    setTimeout(function () { document.body.classList.remove('ds-login-sidebar-anim'); }, 600);
  }

  // The moment the user interacts, drop the mask: their click already went through to the live app
  // (the overlay is pointer-events: none), so continuing to show a frozen picture of the previous page
  // would hide the very navigation they just triggered -- and their own click churns the DOM, which
  // pushes the quiet-window reveal further away. Clearing the deadline makes revealWhenPainted lift on
  // this frame without remembering a half-built frame.
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (type) {
    window.addEventListener(type, function () {
      var el = document.getElementById(OVERLAY_ID);
      if (el && !el._dsFading) { el._dsDeadline = 0; revealWhenPainted(); }
    }, { capture: true, passive: true });
  });

  try {
    var app = dsApp();
    if (!app || !app.firstElementChild) { return; } // SSR-excluded route -> nothing to mask

    // Watch the DOM for the whole session: stamp the activity clock (drives the reveal's quiet
    // window), keep the page masked whenever the fullscreen auth/theme loader appears unmasked (the
    // ~1s white spinner shown on the current page right after a login submit -- before the /reload
    // hard-redirect -- and again across /reload -> /home), and keep the saved frame fresh (debounced)
    // while idle. Cheap: each mutation runs a couple of querySelectors.
    var rememberTimer = null;
    function onDomChanged() {
      lastMutationAt = Date.now();
      if (document.getElementById(OVERLAY_ID)) { return; } // already masked; reveal watcher lifts it
      var app2 = dsApp();
      if (app2 && app2.querySelector('.ds-full-screen-loader')) {
        installMask(savedFrameNode()); // fullscreen loader is up and nothing masks it -> re-mask
      } else {
        if (rememberTimer) { clearTimeout(rememberTimer); }
        rememberTimer = setTimeout(function () {
          if (!document.getElementById(OVERLAY_ID) && contentPainted()) { rememberFrame(); }
        }, 500);
      }
    }
    if (typeof MutationObserver === 'function') {
      new MutationObserver(onDomChanged).observe(document.documentElement, { childList: true, subtree: true });
    }

    // Install the mask FIRST (before anything slow) so it covers the SSR paint with no gap. Mask with
    // whichever source matches the auth state the page will settle to, so client-only chrome (most
    // visibly the logged-in admin sidebar, which shifts the body ~55px) is already in the mask and
    // nothing moves at reveal. The logged-in header user-menu is the tell:
    //   - login /reload: the fresh SSR renders authenticated (sidebar present) -> clone the live SSR
    //   - logged-in F5 reload: the SSR renders anonymous, but the remembered settled frame is logged-in
    //   - logged-out: neither is logged-in -> the remembered settled frame (or SSR clone on first load)
    // We do NOT rememberFrame() here -- the pre-hydration SSR is the unsettled state we must not save;
    // rememberFrame() runs at reveal (revealWhenPainted), once the live page has actually settled.
    var ssrClone = isRealContent(app) ? app.cloneNode(true) : null;
    var savedNode = savedFrameNode();
    installMask(loggedInChrome(ssrClone) ? ssrClone
      : loggedInChrome(savedNode) ? savedNode
      : (savedNode || ssrClone));
  } catch (e) {
    if (window.console && typeof console.warn === 'function') {
      console.warn('[dspace-ssr-overlay] disabled due to error:', e);
    }
  }
})();
