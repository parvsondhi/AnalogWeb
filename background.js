const DEFAULTS = {
  enabled: false,
  mode: 'varied',
  ink: true,
  skipCode: true,
  includeChrome: false,
  pausedHosts: [],
};

chrome.runtime.onInstalled.addListener(async function () {
  const current = await chrome.storage.local.get(null);
  await chrome.storage.local.set(Object.assign({}, DEFAULTS, current));
});

chrome.commands.onCommand.addListener(async function (command) {
  if (command !== 'toggle') return;
  const current = await chrome.storage.local.get(DEFAULTS);
  await chrome.storage.local.set({ enabled: !current.enabled });
});

chrome.storage.onChanged.addListener(async function (changes, area) {
  if (area !== 'local') return;
  if (!changes.enabled && !changes.mode && !changes.ink && !changes.skipCode && !changes.includeChrome && !changes.pausedHosts) {
    return;
  }
  const { enabled } = await chrome.storage.local.get({ enabled: false });
  if (enabled) ensureInjected();
});

chrome.runtime.onMessage.addListener(function (message, sender) {
  if (!message || message.type !== 'HANDINK_BADGE' || !sender.tab || !sender.tab.id) return undefined;
  const tabId = sender.tab.id;
  chrome.action.setBadgeBackgroundColor({ color: '#24306e', tabId: tabId });
  chrome.action.setBadgeText({ text: message.on ? 'ON' : '', tabId: tabId });
  return undefined;
});

async function ensureInjected() {
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({});
  } catch (err) {
    return;
  }
  await Promise.all(tabs.map(async function (tab) {
    if (!tab.id || !tab.url || !/^(https?:|file:)/i.test(tab.url)) return;
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'HANDINK_SYNC' });
    } catch (err) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          files: ['src/engine.js', 'src/content.js'],
        });
      } catch (injectErr) {
        /* Internal pages and the Chrome Web Store refuse extensions. */
      }
    }
  }));
}
