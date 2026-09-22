const test = require('node:test');
const assert = require('node:assert/strict');
const { parseHTML } = require('linkedom');
const Handink = require('../src/engine.js');

const FIXTURE = `<!DOCTYPE html>
<html>
<body>
  <div class="statusbar" data-handink-ignore><span>10:35</span></div>
  <nav>
    <span class="brand">Field notes</span>
    <a href="#notes">Notes</a>
  </nav>
  <article id="note-1">
    <p class="by"><a href="#juniper">@juniper</a> · <span>12m</span></p>
    <p class="body">Obvious arrives last. Someone sanded the rough parts down before you got here.</p>
  </article>
  <article id="note-3">
    <h2>LESS NOISE. MORE MEANING.</h2>
  </article>
  <article id="essay">
    <h1>Leave the chrome alone</h1>
    <p id="long">Handwriting is for the words you came to read. The switches, the menus, and the timestamps can keep their ordinary voice so the page stays usable.</p>
    <blockquote id="quote">Ink is a tone of voice, not a costume for every button.</blockquote>
    <ul><li>Restyle the writing.</li></ul>
    <pre><code id="snippet">.button { margin: 2px; }</code></pre>
    <p class="action"><button type="button">Save a copy</button></p>
    <label for="email">Send the next note</label>
    <input id="email" type="email" />
  </article>
  <div class="feed">
    <div class="card" id="card-a"><div class="body"><span id="span-a">Hello from a div card that should share one voice.</span></div></div>
    <div class="card" id="card-b"><div class="body"><span id="span-b">Another card with wholly different wording for the hash.</span></div></div>
  </div>
  <div id="cluster"><span id="c1">Hello there</span> <span id="c2">from the same line of thought</span></div>
  <p id="outside">A paragraph that lives outside any article and should still be handwritten.</p>
</body>
</html>`;

function page() {
  const { document } = parseHTML(FIXTURE);
  return document;
}

function apply(document, patch) {
  Handink.applyDocument(document, Object.assign({
    enabled: true,
    mode: 'varied',
    ink: true,
    skipCode: true,
    includeChrome: false,
  }, patch), {
    fontUrl: (file) => 'chrome-extension://handwritten/' + file,
  });
  return document;
}

test('skips handles, counts, and tiny scraps', () => {
  assert.equal(Handink.isSkippableSnippet(''), true);
  assert.equal(Handink.isSkippableSnippet('A'), true);
  assert.equal(Handink.isSkippableSnippet('12'), true);
  assert.equal(Handink.isSkippableSnippet('1.4K'), true);
  assert.equal(Handink.isSkippableSnippet('12m'), true);
  assert.equal(Handink.isSkippableSnippet('1h'), true);
  assert.equal(Handink.isSkippableSnippet('@juniper'), true);
  assert.equal(Handink.isSkippableSnippet('Notes'), false);
  assert.equal(Handink.isSkippableSnippet('moved it twice'), false);
});

test('picks a stable voice and keeps long copy out of marker', () => {
  assert.equal(Handink.pickVoice('Anything', 'P', 'script'), 'script');
  assert.equal(Handink.pickVoice('Anything', 'H1', 'print'), 'print');
  assert.equal(Handink.pickVoice('Title', 'H1', 'varied'), 'marker');
  assert.equal(Handink.pickVoice('Title', 'H2', 'varied'), 'marker');
  assert.equal(Handink.pickVoice('A quoted line', 'BLOCKQUOTE', 'varied'), 'script');
  assert.equal(Handink.pickVoice('LESS NOISE. MORE MEANING.', 'ARTICLE', 'varied'), 'marker');
  const long = 'word '.repeat(40);
  assert.notEqual(Handink.pickVoice(long, 'ARTICLE', 'varied'), 'marker');
  assert.equal(Handink.pickVoice('Same sentence here', 'P', 'varied'), Handink.pickVoice('Same sentence here', 'P', 'varied'));
  assert.equal(Handink.normalizeSettings({ pausedHosts: ['News.Example'] }).pausedHosts[0], 'news.example');
  assert.equal(Handink.normalizeSettings({}).ink, true);
  assert.equal(Handink.normalizeSettings({ ink: false }).ink, false);
});

test('restyles writing and leaves chrome, code, and metadata alone', () => {
  const document = apply(page(), {});
  const body = document.querySelector('#note-1 .body');
  const article = document.getElementById('note-1');
  const expected = Handink.pickVoice(
    article.textContent.replace(/\s+/g, ' ').trim().slice(0, 240),
    'ARTICLE',
    'varied'
  );

  assert.equal(body.getAttribute('data-handink'), expected);
  assert.match(body.style.getPropertyValue('font-family'), /Hand /);
  assert.match(body.getAttribute('style') || '', /font-family:[^;]*!important/i);
  assert.equal(document.querySelector('h2').getAttribute('data-handink'), 'marker');
  assert.equal(document.querySelector('h1').getAttribute('data-handink'), 'marker');
  assert.equal(document.getElementById('quote').getAttribute('data-handink'), 'script');
  assert.notEqual(document.getElementById('long').getAttribute('data-handink'), 'marker');

  assert.equal(document.querySelector('nav a').hasAttribute('data-handink'), false);
  assert.equal(document.querySelector('.brand').hasAttribute('data-handink'), false);
  assert.equal(document.querySelector('.statusbar span').hasAttribute('data-handink'), false);
  assert.equal(document.querySelector('a[href="#juniper"]').hasAttribute('data-handink'), false);
  assert.equal(document.querySelector('#note-1 .by span').hasAttribute('data-handink'), false);
  assert.equal(document.querySelector('button').hasAttribute('data-handink'), false);
  assert.equal(document.querySelector('label').hasAttribute('data-handink'), false);
  assert.equal(document.getElementById('email').hasAttribute('data-handink'), false);
  assert.equal(document.getElementById('snippet').hasAttribute('data-handink'), false);
  assert.equal(document.getElementById('snippet').hasAttribute('data-handink-code'), true);

  assert.equal(document.getElementById('span-a').hasAttribute('data-handink'), true);
  assert.equal(document.getElementById('span-b').hasAttribute('data-handink'), true);
  assert.equal(
    document.getElementById('c1').getAttribute('data-handink'),
    document.getElementById('c2').getAttribute('data-handink')
  );
  assert.equal(document.getElementById('outside').hasAttribute('data-handink'), true);
  assert.match(document.getElementById('handink-style').textContent, /dancing-script-latin-600-normal\.woff2/);
  assert.match(document.getElementById('handink-style').textContent, /font-weight:100 900/);

  if (document.readyState !== 'loading') {
    assert.match(body.style.getPropertyValue('color'), /#|rgb/i);
  }
});

test('a single hand, included chrome, and clearing all restore the page', () => {
  const document = apply(page(), { mode: 'print', ink: false });
  const body = document.querySelector('#note-1 .body');
  assert.equal(body.getAttribute('data-handink'), 'print');
  assert.equal(document.querySelector('h1').getAttribute('data-handink'), 'print');
  assert.equal(body.hasAttribute('data-handink-color'), false);

  apply(document, { includeChrome: true, skipCode: false, mode: 'varied' });
  assert.equal(document.querySelector('nav a').hasAttribute('data-handink'), true);
  assert.equal(document.querySelector('button').hasAttribute('data-handink'), true);
  assert.equal(document.getElementById('email').getAttribute('data-handink'), 'print');
  assert.equal(document.getElementById('snippet').hasAttribute('data-handink'), true);
  assert.equal(document.querySelector('.statusbar span').hasAttribute('data-handink'), false);

  Handink.clearDocument(document);
  assert.equal(document.querySelectorAll('[data-handink]').length, 0);
  assert.equal(document.querySelectorAll('[data-handink-code]').length, 0);
  assert.equal(document.getElementById('handink-style'), null);
  assert.equal(document.documentElement.classList.contains('handink-on'), false);
  assert.equal(body.style.getPropertyValue('font-family'), '');
});
