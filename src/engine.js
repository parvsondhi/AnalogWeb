/* Handwritten — restyles readable text and leaves page chrome alone. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.Handink = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const VOICES = ['script', 'print', 'marker', 'casual'];
  const LONG_VOICES = ['script', 'print', 'casual'];
  const MODES = new Set(['varied', 'script', 'print', 'marker', 'casual']);

  const STACK = {
    script: '"Hand Script", "Hand Casual", "Hand Print", cursive',
    casual: '"Hand Casual", "Hand Print", "Hand Script", cursive',
    print: '"Hand Print", "Hand Casual", "Hand Script", cursive',
    marker: '"Hand Marker", "Hand Print", "Hand Casual", cursive',
  };

  const INK = {
    light: {
      script: '#24306e',
      print: '#3c3832',
      marker: '#1c1c1c',
      casual: '#62307f',
    },
    dark: {
      script: '#c9d2ff',
      print: '#efe6d6',
      marker: '#f7f4ee',
      casual: '#ebcffc',
    },
  };

  const LATIN =
    'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
  const LATIN_EXT =
    'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';
  const VIETNAMESE =
    'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB';
  const CYRILLIC = 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116';
  const CYRILLIC_EXT = 'U+0460-052F,U+1C80-1C8A,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F';

  // size-adjust keeps each face near the page's intended size.
  const FACES = [
    ['Hand Script', 'fonts/dancing-script-latin-600-normal.woff2', LATIN, '122%'],
    ['Hand Script', 'fonts/dancing-script-latin-ext-600-normal.woff2', LATIN_EXT, '122%'],
    ['Hand Script', 'fonts/dancing-script-vietnamese-600-normal.woff2', VIETNAMESE, '122%'],
    ['Hand Casual', 'fonts/caveat-latin-600-normal.woff2', LATIN, '100%'],
    ['Hand Casual', 'fonts/caveat-latin-ext-600-normal.woff2', LATIN_EXT, '100%'],
    ['Hand Casual', 'fonts/caveat-cyrillic-600-normal.woff2', CYRILLIC, '100%'],
    ['Hand Casual', 'fonts/caveat-cyrillic-ext-600-normal.woff2', CYRILLIC_EXT, '100%'],
    ['Hand Print', 'fonts/patrick-hand-latin-400-normal.woff2', LATIN, '112%'],
    ['Hand Print', 'fonts/patrick-hand-latin-ext-400-normal.woff2', LATIN_EXT, '112%'],
    ['Hand Print', 'fonts/patrick-hand-vietnamese-400-normal.woff2', VIETNAMESE, '112%'],
    ['Hand Marker', 'fonts/permanent-marker-latin-400-normal.woff2', LATIN, '100%'],
  ];

  const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'PATH', 'CANVAS', 'IMG', 'VIDEO',
    'AUDIO', 'PICTURE', 'SOURCE', 'TRACK', 'BR', 'HR', 'WBR', 'META', 'LINK',
    'HEAD', 'IFRAME', 'OBJECT', 'EMBED', 'MAP', 'AREA', 'TEMPLATE',
  ]);

  const HIDDEN_INPUT = new Set([
    'hidden', 'checkbox', 'radio', 'file', 'color', 'range', 'image',
  ]);

  const INLINE_TAGS = new Set([
    'SPAN', 'A', 'EM', 'STRONG', 'B', 'I', 'MARK', 'SMALL', 'TIME', 'BR',
    'WBR', 'SUB', 'SUP', 'CITE', 'Q', 'ABBR', 'CODE', 'KBD', 'SAMP', 'FONT',
  ]);

  const CHROME_SELECTOR = [
    'nav',
    '[role="navigation"]',
    '[role="menu"]',
    '[role="menubar"]',
    '[role="tablist"]',
    '[role="toolbar"]',
    '[role="switch"]',
    '[role="tab"]',
  ].join(', ');

  const states = new WeakMap();

  function defaultSettings() {
    return {
      enabled: false,
      mode: 'varied',
      ink: true,
      skipCode: true,
      includeChrome: false,
      pausedHosts: [],
    };
  }

  function normalizeMode(mode) {
    const value = String(mode || '').toLowerCase();
    return MODES.has(value) ? value : 'varied';
  }

  function normalizeSettings(input) {
    const base = defaultSettings();
    const source = input && typeof input === 'object' ? input : {};
    const paused = Array.isArray(source.pausedHosts) ? source.pausedHosts : base.pausedHosts;
    return {
      enabled: Boolean(source.enabled),
      mode: normalizeMode(source.mode || base.mode),
      ink: source.ink !== undefined ? Boolean(source.ink) : base.ink,
      skipCode: source.skipCode !== undefined ? Boolean(source.skipCode) : base.skipCode,
      includeChrome: Boolean(source.includeChrome),
      pausedHosts: paused.map((host) => String(host || '').toLowerCase()).filter(Boolean),
    };
  }

  function hashText(value) {
    const sample = String(value || '');
    let hash = 2166136261;
    for (let i = 0; i < sample.length; i += 1) {
      hash ^= sample.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function pickVoice(text, tag, mode) {
    const normalized = normalizeMode(mode);
    if (normalized !== 'varied') return normalized;

    const sample = String(text || '').replace(/\s+/g, ' ').trim();
    const kind = String(tag || '').toUpperCase();

    if (kind === 'H1' || kind === 'H2') return 'marker';
    if (kind === 'H3' || kind === 'H4') return 'script';
    if (kind === 'BLOCKQUOTE') return 'script';

    const letters = sample.replace(/[^A-Za-z]+/g, '');
    if (letters.length >= 4 && letters.length <= 64 && letters === letters.toUpperCase()) {
      return 'marker';
    }

    const bucket = hashText(sample.slice(0, 180) || kind || 'text');
    if (sample.length > 110) return LONG_VOICES[bucket % LONG_VOICES.length];
    return VOICES[bucket % VOICES.length];
  }

  function isSkippableSnippet(text) {
    const value = String(text || '').replace(/\s+/g, ' ').trim();
    if (value.length < 2) return true;
    if (/^[\d.,]+$/.test(value)) return true;
    if (value.length <= 6 && /^[\d.,]+\s*[kKmMbB]$/.test(value)) return true;
    if (/^\d+\s*[smhdwSMHDW]$/.test(value)) return true;
    if (value.startsWith('@') && value.length <= 40 && !/\s/.test(value)) return true;
    return false;
  }

  function cssUrl(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function buildFontFaceCSS(resolve) {
    const chunks = [];
    for (let i = 0; i < FACES.length; i += 1) {
      const family = FACES[i][0];
      const file = FACES[i][1];
      const range = FACES[i][2];
      const adjust = FACES[i][3];
      const url = cssUrl(resolve(file));
      chunks.push(
        '@font-face{font-family:"' + family + '";src:url("' + url + '") format("woff2");' +
        'font-weight:100 900;font-style:normal;font-display:swap;unicode-range:' + range +
        ';size-adjust:' + adjust + ';}',
        '@font-face{font-family:"' + family + '";src:url("' + url + '") format("woff2");' +
        'font-weight:100 900;font-style:italic;font-display:swap;unicode-range:' + range +
        ';size-adjust:' + adjust + ';}'
      );
    }
    return chunks.join('\n');
  }

  function buildPageCSS() {
    const rules = [];
    VOICES.forEach((voice) => {
      rules.push(
        'html.handink-on [data-handink="' + voice + '"]{font-family:' + STACK[voice] +
        ' !important;font-synthesis:none !important;}'
      );
    });
    return rules.join('\n');
  }

  function buildCSS(resolve) {
    const fontUrl = typeof resolve === 'function' ? resolve : function (file) { return file; };
    return buildFontFaceCSS(fontUrl) + '\n' + buildPageCSS();
  }

  function className(el) {
    if (!el) return '';
    const value = el.className;
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value.baseVal === 'string') return value.baseVal;
    return '';
  }

  function isIconElement(el) {
    const tag = el.tagName;
    if (tag === 'SVG' || tag === 'CANVAS' || tag === 'IMG' || tag === 'VIDEO' || tag === 'PICTURE') {
      return true;
    }
    const cls = className(el);
    if (/(?:^|\s)(?:fa[srlbtd]?|fab|fas|far|fal|material-icons|material-symbols(?:-[a-z]+)?)(?:\s|$)/.test(cls)) {
      return true;
    }
    if (/glyphicon|dashicons|fontawesome|material-symbols|icomoon/.test(cls)) return true;
    if (el.getAttribute && (el.getAttribute('data-icon') || el.getAttribute('data-feather'))) return true;
    if (tag === 'I') return (el.textContent || '').trim().length <= 1;
    if (el.getAttribute && el.getAttribute('role') === 'img' && (el.textContent || '').trim().length <= 2) {
      return true;
    }
    return false;
  }

  function directText(el) {
    let out = '';
    const nodes = el.childNodes || [];
    for (let i = 0; i < nodes.length; i += 1) {
      if (nodes[i].nodeType === 3) out += nodes[i].textContent || '';
    }
    return out.replace(/\s+/g, ' ').trim();
  }

  function hasDirectText(el) {
    const nodes = el.childNodes || [];
    for (let i = 0; i < nodes.length; i += 1) {
      if (nodes[i].nodeType === 3 && (nodes[i].textContent || '').trim()) return true;
    }
    return false;
  }

  function isControl(el) {
    const tag = el.tagName;
    if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'LABEL') {
      return true;
    }
    const role = el.getAttribute && el.getAttribute('role');
    return role === 'button' || role === 'tab';
  }

  function shouldPaint(el, settings) {
    if (!el || el.nodeType !== 1) return false;
    if (el.closest && el.closest('[data-handink-ignore]')) return false;
    const tag = el.tagName;
    if (!tag || SKIP_TAGS.has(tag) || tag === 'HTML' || tag === 'BODY') return false;
    if (el.hasAttribute && el.hasAttribute('hidden')) return false;
    if (el.closest && el.closest('svg, canvas, video, picture')) return false;
    if (isIconElement(el)) return false;
    if (settings.skipCode !== false && el.closest && el.closest('pre, code, kbd, samp')) return false;

    const inButton = el.closest && el.closest('button, [role="button"]');
    const inNav = !settings.includeChrome && el.closest && el.closest(CHROME_SELECTOR);

    if (!settings.includeChrome) {
      if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'OPTION' || tag === 'LABEL') {
        return false;
      }
      if (inButton || inNav) return false;
      const role = el.getAttribute && el.getAttribute('role');
      if (role === 'button' || role === 'tab' || role === 'switch') return false;
    } else if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || (el.getAttribute && el.getAttribute('role') === 'button')) {
      if (tag === 'INPUT') {
        const type = (el.getAttribute('type') || 'text').toLowerCase();
        if (HIDDEN_INPUT.has(type) || type === 'submit' || type === 'button' || type === 'reset') {
          return tag === 'INPUT' ? false : true;
        }
      }
      if (inButton && tag !== 'BUTTON' && (!el.getAttribute || el.getAttribute('role') !== 'button')) {
        return false;
      }
      return true;
    } else if (inButton && tag !== 'BUTTON') {
      return false;
    }

    if (!hasDirectText(el)) return false;
    const text = directText(el);
    if (isSkippableSnippet(text)) return false;
    if (el.getAttribute && el.getAttribute('aria-hidden') === 'true' && text.length <= 2) return false;
    return true;
  }

  function isInlineCluster(el) {
    const kids = el.children;
    if (!kids || kids.length === 0) return true;
    for (let i = 0; i < kids.length; i += 1) {
      if (!INLINE_TAGS.has(kids[i].tagName)) return false;
    }
    return true;
  }

  function voiceRoot(el) {
    if (el.closest) {
      const heading = el.closest('h1, h2, h3, h4, h5, h6, blockquote');
      if (heading) return heading;
      const article = el.closest('article, [role="article"]');
      if (article) return article;
      const list = el.closest('ul, ol');
      if (list) return list;
      const table = el.closest('table');
      if (table) return table;
      const block = el.closest('p, figcaption, dd, dt');
      if (block) return block;
    }

    let node = el;
    for (let depth = 0; depth < 8 && node.parentElement; depth += 1) {
      const parent = node.parentElement;
      const tag = parent.tagName;
      if (
        tag === 'BODY' || tag === 'HTML' || tag === 'MAIN' || tag === 'NAV' ||
        tag === 'HEADER' || tag === 'FOOTER' || tag === 'SECTION' || tag === 'ARTICLE'
      ) {
        break;
      }
      if (parent.hasAttribute && parent.hasAttribute('data-handink-ignore')) break;
      if (parent.matches && parent.matches('ul, ol, table, p, h1, h2, h3, h4, h5, h6, blockquote')) break;
      if (parent.children.length > 1 && !isInlineCluster(parent)) break;
      node = parent;
    }
    return node;
  }

  function sampleFor(root, state) {
    const cached = state.sampleCache.get(root);
    if (cached != null) return cached;
    const text = (root.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 240);
    state.sampleCache.set(root, text);
    return text;
  }

  function viewOf(doc) {
    return doc.defaultView || doc.ownerDocument?.defaultView || null;
  }

  function computedStyle(el) {
    const view = el.ownerDocument && viewOf(el.ownerDocument);
    if (view && view.getComputedStyle) return view.getComputedStyle(el);
    return { fontFamily: '', color: 'rgb(0, 0, 0)', backgroundColor: 'rgba(0, 0, 0, 0)' };
  }

  function parseColor(value) {
    const match = String(value || '').match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/);
    if (!match) return null;
    return {
      r: Number(match[1]),
      g: Number(match[2]),
      b: Number(match[3]),
      a: match[4] == null ? 1 : Number(match[4]),
    };
  }

  function luminance(color) {
    const channels = [color.r, color.g, color.b].map((channel) => {
      const value = channel / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  }

  function isNeutralColor(el) {
    const parsed = parseColor(computedStyle(el).color);
    if (!parsed) return true;
    const max = Math.max(parsed.r, parsed.g, parsed.b);
    const min = Math.min(parsed.r, parsed.g, parsed.b);
    return max - min < 28;
  }

  function shadeFor(el) {
    let node = el;
    while (node) {
      const parsed = parseColor(computedStyle(node).backgroundColor);
      if (parsed && parsed.a >= 0.55) return luminance(parsed) < 0.42 ? 'dark' : 'light';
      node = node.parentElement;
    }
    return 'light';
  }

  function shouldTint(el) {
    if (el.closest && el.closest('a, button, input, textarea, select, pre, code, kbd, samp, label')) {
      return false;
    }
    return true;
  }

  function stylePriority(style, prop) {
    if (!style || typeof style.getPropertyPriority !== 'function') return '';
    try {
      return style.getPropertyPriority(prop) || '';
    } catch (err) {
      return '';
    }
  }

  function styleValue(style, prop) {
    if (!style || typeof style.getPropertyValue !== 'function') return '';
    try {
      return style.getPropertyValue(prop) || '';
    } catch (err) {
      return '';
    }
  }

  // Chrome honors setProperty(..., 'important'). Some non-browser DOMs drop the priority.
  function setImportant(el, prop, value) {
    try {
      el.style.setProperty(prop, value, 'important');
    } catch (err) {
      el.style.setProperty(prop, value);
    }
    if (stylePriority(el.style, prop) === 'important') return;
    const raw = el.getAttribute('style') || '';
    const escaped = prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(escaped + '\\s*:[^;]*!important', 'i').test(raw)) return;
    const stripped = raw
      .replace(new RegExp('(?:^|;)\\s*' + escaped + '\\s*:[^;]*', 'ig'), '')
      .replace(/^\s*;\s*|\s*;\s*$/g, '')
      .trim();
    const next = (stripped ? stripped.replace(/;\s*$/, '') + '; ' : '') + prop + ': ' + value + ' !important;';
    el.setAttribute('style', next);
  }

  function lockProp(el, prop, value, flag) {
    if (!el.hasAttribute(flag)) {
      el.setAttribute(flag, JSON.stringify([styleValue(el.style, prop), stylePriority(el.style, prop)]));
    }
    setImportant(el, prop, value);
  }

  function unlockProp(el, prop, flag) {
    if (!el.hasAttribute(flag)) return;
    let saved = ['', ''];
    try {
      const parsed = JSON.parse(el.getAttribute(flag));
      if (Array.isArray(parsed)) saved = parsed;
    } catch (err) {
      saved = ['', ''];
    }
    el.removeAttribute(flag);
    if (saved[0]) el.style.setProperty(prop, saved[0], saved[1] || '');
    else el.style.removeProperty(prop);
  }

  function restorePaint(el) {
    unlockProp(el, 'font-family', 'data-handink-font');
    unlockProp(el, 'color', 'data-handink-color');
    el.removeAttribute('data-handink');
    el.removeAttribute('data-handink-neutral');
  }

  function rememberCode(el) {
    if (el.hasAttribute('data-handink-code')) return;
    const font = computedStyle(el).fontFamily || '';
    el.setAttribute('data-handink-code', JSON.stringify([
      styleValue(el.style, 'font-family'),
      stylePriority(el.style, 'font-family'),
      font,
    ]));
  }

  function applyCodeLock(el) {
    let saved = ['', '', ''];
    try {
      const parsed = JSON.parse(el.getAttribute('data-handink-code'));
      if (Array.isArray(parsed)) saved = parsed;
    } catch (err) {
      saved = ['', '', ''];
    }
    if (saved[2]) setImportant(el, 'font-family', saved[2]);
  }

  function releaseCode(root) {
    if (!root.querySelectorAll) return;
    root.querySelectorAll('[data-handink-code]').forEach((el) => {
      let saved = ['', '', ''];
      try {
        const parsed = JSON.parse(el.getAttribute('data-handink-code'));
        if (Array.isArray(parsed)) saved = parsed;
      } catch (err) {
        saved = ['', '', ''];
      }
      el.removeAttribute('data-handink-code');
      if (saved[0]) el.style.setProperty('font-family', saved[0], saved[1] || '');
      else el.style.removeProperty('font-family');
    });
  }

  function preserveCode(root, settings) {
    if (!root.querySelectorAll) return;
    if (settings.skipCode === false) {
      releaseCode(root);
      return;
    }
    root.querySelectorAll('pre, code, kbd, samp').forEach((el) => {
      if (el.closest && el.closest('[data-handink-ignore]')) return;
      rememberCode(el);
      applyCodeLock(el);
    });
  }

  function applyInk(el, state) {
    if (!shouldTint(el)) {
      unlockProp(el, 'color', 'data-handink-color');
      return;
    }
    if (!el.hasAttribute('data-handink-neutral')) {
      el.setAttribute('data-handink-neutral', isNeutralColor(el) ? '1' : '0');
    }
    if (el.getAttribute('data-handink-neutral') === '0') {
      unlockProp(el, 'color', 'data-handink-color');
      return;
    }
    const voice = el.getAttribute('data-handink') || 'print';
    const palette = shadeFor(el) === 'dark' ? INK.dark : INK.light;
    lockProp(el, 'color', palette[voice] || palette.print, 'data-handink-color');
  }

  function paintElement(el, state) {
    const settings = state.settings;
    if (!shouldPaint(el, settings)) {
      if (el.hasAttribute && el.hasAttribute('data-handink')) restorePaint(el);
      return;
    }

    const root = voiceRoot(el);
    let voice = state.voiceCache.get(root);
    if (!voice) {
      let kind = root.tagName || '';
      if (root.matches && root.matches('article, [role="article"]')) kind = 'ARTICLE';
      voice = pickVoice(sampleFor(root, state), kind, settings.mode);
      state.voiceCache.set(root, voice);
    }
    if (normalizeMode(settings.mode) === 'varied' && isControl(el)) voice = 'print';

    el.setAttribute('data-handink', voice);
    lockProp(el, 'font-family', STACK[voice] || STACK.print, 'data-handink-font');

    if (settings.ink && state.doc.readyState !== 'loading') applyInk(el, state);
    else unlockProp(el, 'color', 'data-handink-color');
  }

  function ensureStyle(root, css) {
    if (!root.querySelector) return;
    const doc = root.nodeType === 9 ? root : root.ownerDocument;
    if (!doc || !doc.createElement) return;
    let style = root.querySelector('#handink-style');
    if (!style) {
      style = doc.createElement('style');
      style.id = 'handink-style';
      const parent = root.nodeType === 9 ? doc.documentElement : root;
      if (parent && parent.appendChild) parent.appendChild(style);
    }
    if (style.textContent !== css) style.textContent = css;
    if (style.parentNode && style.parentNode.lastElementChild !== style) {
      style.parentNode.appendChild(style);
    }
  }

  function stateFor(doc) {
    let state = states.get(doc);
    if (!state) {
      state = {
        doc: doc,
        settings: defaultSettings(),
        voiceCache: new WeakMap(),
        sampleCache: new WeakMap(),
        shadows: new Set(),
        observers: [],
        watched: new WeakSet(),
        paintToken: 0,
        applied: false,
        css: '',
        warned: false,
      };
      states.set(doc, state);
    }
    return state;
  }

  function safe(state, fn) {
    try {
      fn();
    } catch (err) {
      if (!state.warned) {
        state.warned = true;
        const view = viewOf(state.doc);
        if (view && view.console) view.console.warn('Handwritten skipped one element.', err);
      }
    }
  }

  function collect(root, into, state) {
    if (!root || !root.querySelectorAll) return;
    const start = root.nodeType === 9 ? root.documentElement : root;
    if (!start) return;
    if (start.nodeType === 1) into.push(start);
    const all = start.querySelectorAll('*');
    for (let i = 0; i < all.length; i += 1) {
      const el = all[i];
      into.push(el);
      if (el.shadowRoot) {
        state.shadows.add(el.shadowRoot);
        ensureStyle(el.shadowRoot, state.css);
        watch(el.shadowRoot, state);
        preserveCode(el.shadowRoot, state.settings);
        collect(el.shadowRoot, into, state);
      }
    }
  }

  function paintNodes(nodes, state, token) {
    let index = 0;
    const step = function () {
      if (state.paintToken !== token || !state.applied) return;
      const end = Math.min(nodes.length, index + 500);
      for (; index < end; index += 1) {
        const node = nodes[index];
        if (!node || node.isConnected === false) continue;
        safe(state, function () { paintElement(node, state); });
      }
      if (index < nodes.length) {
        const view = viewOf(state.doc);
        const raf = view && view.requestAnimationFrame
          ? view.requestAnimationFrame.bind(view)
          : function (fn) { fn(); };
        raf(step);
      }
    };
    step();
  }

  function repaint(doc, state) {
    state.paintToken += 1;
    const token = state.paintToken;
    state.voiceCache = new WeakMap();
    state.sampleCache = new WeakMap();
    preserveCode(doc, state.settings);
    const nodes = [];
    collect(doc, nodes, state);
    paintNodes(nodes, state, token);
  }

  function watch(root, state) {
    if (!root || state.watched.has(root)) return;
    const doc = root.nodeType === 9 ? root : root.ownerDocument;
    const Observer = viewOf(doc || state.doc) && viewOf(doc || state.doc).MutationObserver;
    if (!Observer) return;
    const target = root.nodeType === 9 ? root.documentElement : root;
    if (!target) return;
    state.watched.add(root);
    const observer = new Observer(function (records) {
      if (!state.applied) return;
      const added = [];
      for (let i = 0; i < records.length; i += 1) {
        const nodes = records[i].addedNodes;
        for (let j = 0; j < nodes.length; j += 1) added.push(nodes[j]);
      }
      if (!added.length) return;
      const batch = [];
      for (let i = 0; i < added.length; i += 1) {
        const node = added[i];
        if (node.nodeType === 3) {
          if (node.parentElement) batch.push(node.parentElement);
        } else if (node.nodeType === 1 || node.nodeType === 11) {
          preserveCode(node, state.settings);
          collect(node, batch, state);
        }
      }
      paintNodes(batch, state, state.paintToken);
    });
    observer.observe(target, { childList: true, subtree: true });
    state.observers.push(observer);
  }

  function applyDocument(doc, settings, options) {
    if (!doc || !doc.documentElement) return;
    const state = stateFor(doc);
    state.settings = normalizeSettings(settings);
    state.applied = true;
    state.css = buildCSS(options && options.fontUrl);
    ensureStyle(doc, state.css);
    doc.documentElement.classList.add('handink-on');
    doc.documentElement.classList.toggle('handink-ink', state.settings.ink);
    doc.documentElement.setAttribute('data-handink-ready', '');
    if (doc.body) {
      doc.documentElement.classList.toggle('handink-dark', shadeFor(doc.body) === 'dark');
    }
    repaint(doc, state);
    watch(doc, state);
    if (doc.readyState === 'loading' && !state.readyHook) {
      state.readyHook = true;
      doc.addEventListener('DOMContentLoaded', function () {
        if (state.applied) repaint(doc, state);
      }, { once: true });
    }
  }

  function strip(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('[data-handink], [data-handink-font], [data-handink-color]').forEach(restorePaint);
    releaseCode(root);
  }

  function clearDocument(doc) {
    if (!doc || !doc.documentElement) return;
    const state = stateFor(doc);
    state.applied = false;
    state.paintToken += 1;
    state.observers.forEach((observer) => observer.disconnect());
    state.observers = [];
    state.watched = new WeakSet();
    strip(doc);
    const style = doc.getElementById ? doc.getElementById('handink-style') : null;
    if (style) style.remove();
    state.shadows.forEach((shadow) => {
      strip(shadow);
      const shadowStyle = shadow.querySelector && shadow.querySelector('#handink-style');
      if (shadowStyle) shadowStyle.remove();
    });
    state.shadows = new Set();
    doc.documentElement.classList.remove('handink-on', 'handink-ink', 'handink-dark');
    doc.documentElement.removeAttribute('data-handink-ready');
  }

  return {
    VOICES: VOICES,
    STACK: STACK,
    INK: INK,
    defaultSettings: defaultSettings,
    normalizeSettings: normalizeSettings,
    normalizeMode: normalizeMode,
    hashText: hashText,
    pickVoice: pickVoice,
    isSkippableSnippet: isSkippableSnippet,
    shouldPaint: shouldPaint,
    voiceRoot: voiceRoot,
    buildCSS: buildCSS,
    applyDocument: applyDocument,
    clearDocument: clearDocument,
  };
});
