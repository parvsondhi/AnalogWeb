const HINTS = {
  varied: 'Each post gets its own hand.',
  script: 'A flowing pen across the whole page.',
  print: 'Neat everyday handwriting.',
  marker: 'Short, heavy, and loud.',
  casual: 'A looser notebook hand.',
};

const sheet = document.getElementById('sheet');
const statusEl = document.getElementById('status');
const voiceHint = document.getElementById('voice-hint');
const pauseRow = document.getElementById('pause-row');
const hostEl = document.getElementById('host');
const pageNote = document.getElementById('page-note');
const shortcutEl = document.getElementById('shortcut');

const enabledBtn = document.getElementById('enabled');
const inkBtn = document.getElementById('ink');
const skipBtn = document.getElementById('skipCode');
const chromeBtn = document.getElementById('includeChrome');
const pauseBtn = document.getElementById('pause');
const voiceButtons = Array.from(document.querySelectorAll('.voices button'));

let tabHost = '';
let tabScriptable = true;

function setSwitch(button, on) {
  button.setAttribute('aria-checked', on ? 'true' : 'false');
}

function switchOn(button) {
  return button.getAttribute('aria-checked') === 'true';
}

function selectedMode() {
  const active = voiceButtons.find((button) => button.getAttribute('aria-checked') === 'true');
  return active ? active.dataset.mode : 'varied';
}

function settingsFromForm() {
  return Handink.normalizeSettings({
    enabled: switchOn(enabledBtn),
    mode: selectedMode(),
    ink: switchOn(inkBtn),
    skipCode: switchOn(skipBtn),
    includeChrome: switchOn(chromeBtn),
    pausedHosts: [],
  });
}

function paintSheet() {
  const mode = selectedMode();
  sheet.dataset.mode = mode;
  sheet.classList.toggle('ink-off', !switchOn(inkBtn));
  voiceHint.textContent = HINTS[mode] || HINTS.varied;
  voiceButtons.forEach((button) => {
    button.setAttribute('aria-checked', button.dataset.mode === mode ? 'true' : 'false');
  });
}

function paintStatus(settings) {
  enabledBtn.setAttribute('aria-label', settings.enabled ? 'Turn handwriting off' : 'Turn handwriting on');
  const pausedHere = tabHost && settings.pausedHosts.includes(tabHost);
  if (!settings.enabled) {
    statusEl.textContent = 'Off. Pages stay as they are.';
    return;
  }
  if (pausedHere) {
    statusEl.textContent = 'Paused here. Other sites still change.';
    return;
  }
  statusEl.textContent = tabScriptable || !tabHost
    ? 'On for every site you visit.'
    : 'On. Open a normal website to see it.';
}

async function currentTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

function hostFromUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return parsed.hostname.toLowerCase();
  } catch (err) {
    return '';
  }
}

function canScript(url) {
  return /^https?:/i.test(url || '') || /^file:/i.test(url || '');
}

async function load() {
  const stored = await chrome.storage.local.get(Handink.defaultSettings());
  const settings = Handink.normalizeSettings(stored);
  const tab = await currentTab();
  tabHost = tab && tab.url ? hostFromUrl(tab.url) : '';
  tabScriptable = tab && tab.url ? canScript(tab.url) : true;

  setSwitch(enabledBtn, settings.enabled);
  setSwitch(inkBtn, settings.ink);
  setSwitch(skipBtn, settings.skipCode);
  setSwitch(chromeBtn, settings.includeChrome);
  setSwitch(pauseBtn, Boolean(tabHost && settings.pausedHosts.includes(tabHost)));
  voiceButtons.forEach((button) => {
    button.setAttribute('aria-checked', button.dataset.mode === settings.mode ? 'true' : 'false');
  });
  paintSheet();
  paintStatus(settings);

  if (tabHost) {
    pauseRow.hidden = false;
    hostEl.textContent = tabHost;
    pauseBtn.setAttribute('aria-label', 'Pause on ' + tabHost);
  } else {
    pauseRow.hidden = true;
  }

  if (tab && tab.url && !tabScriptable) {
    pageNote.hidden = false;
    pageNote.textContent = 'Chrome won’t let extensions restyle this page. Open a normal website, then flip the switch.';
  } else if (tab && tab.url && /^file:/i.test(tab.url)) {
    pageNote.hidden = false;
    pageNote.textContent = 'Local files also need “Allow access to file URLs” in this extension’s details.';
  } else {
    pageNote.hidden = true;
  }

  document.body.hidden = false;
}

async function save(patch) {
  const stored = await chrome.storage.local.get(Handink.defaultSettings());
  const next = Handink.normalizeSettings(Object.assign({}, stored, patch));
  await chrome.storage.local.set(next);
  paintStatus(next);
  return next;
}

enabledBtn.addEventListener('click', async function () {
  const enabled = !switchOn(enabledBtn);
  setSwitch(enabledBtn, enabled);
  await save({ enabled: enabled });
});

inkBtn.addEventListener('click', async function () {
  const ink = !switchOn(inkBtn);
  setSwitch(inkBtn, ink);
  paintSheet();
  await save({ ink: ink });
});

skipBtn.addEventListener('click', async function () {
  const skipCode = !switchOn(skipBtn);
  setSwitch(skipBtn, skipCode);
  await save({ skipCode: skipCode });
});

chromeBtn.addEventListener('click', async function () {
  const includeChrome = !switchOn(chromeBtn);
  setSwitch(chromeBtn, includeChrome);
  await save({ includeChrome: includeChrome });
});

pauseBtn.addEventListener('click', async function () {
  if (!tabHost) return;
  const stored = await chrome.storage.local.get(Handink.defaultSettings());
  const settings = Handink.normalizeSettings(stored);
  const paused = new Set(settings.pausedHosts);
  const nextOn = !switchOn(pauseBtn);
  if (nextOn) paused.add(tabHost);
  else paused.delete(tabHost);
  setSwitch(pauseBtn, nextOn);
  await save({ pausedHosts: Array.from(paused) });
});

voiceButtons.forEach((button) => {
  button.addEventListener('click', async function () {
    voiceButtons.forEach((other) => {
      other.setAttribute('aria-checked', other === button ? 'true' : 'false');
    });
    paintSheet();
    await save({ mode: button.dataset.mode });
  });
});

const faces = document.createElement('style');
faces.textContent = Handink.buildCSS((file) => chrome.runtime.getURL(file));
document.head.appendChild(faces);

chrome.commands.getAll().then((commands) => {
  const toggle = (commands || []).find((command) => command.name === 'toggle');
  if (toggle && toggle.shortcut) shortcutEl.textContent = toggle.shortcut + ' toggles it.';
}).catch(() => {});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') load();
});

load().catch(() => {
  statusEl.textContent = 'Couldn’t read the saved setting.';
  document.body.hidden = false;
});
