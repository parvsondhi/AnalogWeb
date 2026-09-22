/* Runs in every frame. The page's own scripts cannot see this file. */
(function () {
  if (!document.documentElement || document.documentElement.tagName !== 'HTML') return;

  if (globalThis.__handinkBound) {
    if (typeof globalThis.__handinkSync === 'function') globalThis.__handinkSync();
    return;
  }
  globalThis.__handinkBound = true;

  function fontUrl(file) {
    return chrome.runtime.getURL(file);
  }

  function report(on) {
    if (window !== window.top) return;
    try {
      chrome.runtime.sendMessage({ type: 'HANDINK_BADGE', on: on });
    } catch (err) {
      /* The extension was reloaded. */
    }
  }

  async function sync() {
    let stored;
    try {
      stored = await chrome.storage.local.get(Handink.defaultSettings());
    } catch (err) {
      return;
    }
    const settings = Handink.normalizeSettings(stored);
    const host = (location.hostname || '').toLowerCase();
    const paused = host && settings.pausedHosts.indexOf(host) !== -1;
    const active = settings.enabled && !paused;
    if (active) Handink.applyDocument(document, settings, { fontUrl: fontUrl });
    else Handink.clearDocument(document);
    report(active);
  }

  globalThis.__handinkSync = sync;

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === 'local') sync();
  });

  chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
    if (!message || message.type !== 'HANDINK_SYNC') return undefined;
    sync().then(function () { sendResponse({ ok: true }); }, function () { sendResponse({ ok: false }); });
    return true;
  });

  sync();
})();
