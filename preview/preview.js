const screen = document.getElementById('screen');
const toggle = document.getElementById('toggle');
const ink = document.getElementById('ink');
const code = document.getElementById('code');
const chromeBtn = document.getElementById('chrome');
const dark = document.getElementById('dark');
const statusEl = document.getElementById('live-status');
const modeButtons = Array.from(document.querySelectorAll('.modes button'));

function on(button) {
  return button.getAttribute('aria-checked') === 'true';
}

function selectedMode() {
  const active = modeButtons.find((button) => button.getAttribute('aria-checked') === 'true');
  return active ? active.dataset.mode : 'varied';
}

function collectSettings() {
  return Handink.normalizeSettings({
    enabled: on(toggle),
    mode: selectedMode(),
    ink: on(ink),
    skipCode: on(code),
    includeChrome: on(chromeBtn),
  });
}

function describe(settings) {
  if (!settings.enabled) return 'Handwriting is off. This is the page’s own type.';
  const painted = screen.querySelectorAll('[data-handink]');
  const voices = [];
  painted.forEach((node) => {
    const voice = node.getAttribute('data-handink');
    if (voices.indexOf(voice) === -1) voices.push(voice);
  });
  const navPainted = screen.querySelector('nav a')?.hasAttribute('data-handink');
  const codePainted = screen.querySelector('code')?.hasAttribute('data-handink');
  const bits = ['On.'];
  if (voices.length) bits.push('Hands in view: ' + voices.join(', ') + '.');
  bits.push(navPainted ? 'Menus are included.' : 'Menus stay in the interface font.');
  bits.push(codePainted ? 'Code is handwritten too.' : 'Code stays monospace.');
  return bits.join(' ');
}

function render() {
  screen.classList.toggle('is-dark', on(dark));
  const settings = collectSettings();
  if (!settings.enabled) Handink.clearDocument(document);
  else {
    Handink.applyDocument(document, settings, {
      fontUrl: function (file) { return '/' + file; },
    });
  }
  statusEl.textContent = describe(Handink.normalizeSettings(settings));
}

function bindSwitch(button) {
  button.addEventListener('click', function () {
    const next = !on(button);
    button.setAttribute('aria-checked', next ? 'true' : 'false');
    render();
  });
}

[toggle, ink, code, chromeBtn, dark].forEach(bindSwitch);

modeButtons.forEach((button) => {
  button.addEventListener('click', function () {
    modeButtons.forEach((other) => {
      other.setAttribute('aria-checked', other === button ? 'true' : 'false');
    });
    render();
  });
});

document.addEventListener('keydown', function (event) {
  if (event.key.toLowerCase() !== 'h' || event.metaKey || event.ctrlKey || event.altKey) return;
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;
  toggle.click();
});

render();
