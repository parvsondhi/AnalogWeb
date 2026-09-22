# Handwritten

A Chrome extension that turns the writing on any page into handwriting. Menus, buttons, and code stay in their own fonts, so the page is still usable.

It ships four hands, close to a notebook passed around a table:

- **Script** — a flowing pen (Dancing Script)
- **Print** — neat everyday handwriting (Patrick Hand)
- **Marker** — short, heavy, and loud (Permanent Marker)
- **Casual** — a looser notebook hand (Caveat)

Varied mode gives each post or paragraph its own hand. Headings come out in marker. Quotes come out in script. Colored ink is optional: indigo, graphite, marker black, and violet on light pages, and the light versions of those on dark ones.

## Install it in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Choose this folder — the one that contains `manifest.json`.
5. Open any site and click the Handwritten icon.
6. Turn **Handwriting** on.

`Alt+Shift+H` toggles it. The toolbar badge reads **ON** while the current tab is restyled.

Pause a single site from the popup if a page should stay as it is. Internal Chrome pages (`chrome://…`) cannot be restyled. Apps that draw their own text, such as Google Docs or Figma, will not change either.

Local HTML files also need **Allow access to file URLs** in the extension’s details.

## What it changes

On by default:

- Paragraphs, headings, lists, quotes, and other writing
- A different hand for each article, so a feed does not all match
- Handles (`@name`), bare counts (`12`, `1.4K`), and timestamps (`12m`) stay in the interface font
- Navigation, buttons, labels, and form fields stay put
- Code, `pre`, and `kbd` stay monospace

You can turn on colored ink, force one hand for the whole page, include menus and buttons, or let code be handwritten too. The choice is saved on this computer. The extension does not read pages for any other reason, and it does not send them anywhere. The fonts are bundled, so it works offline.

## Preview without installing

From this folder:

```bash
python3 -m http.server 8747
```

Open [http://127.0.0.1:8747/preview/](http://127.0.0.1:8747/preview/). The phone on that page uses the same engine as the extension. Press `H` to toggle handwriting.

`/preview/page.html` is the same writing without those controls, so after you load the extension you can watch an ordinary page change.

## Tests

```bash
npm install
npm test
```

## Fonts

The faces are SIL Open Font License 1.1. See [NOTICE.md](NOTICE.md) and [fonts/OFL.txt](fonts/OFL.txt). The extension code is MIT; the fonts are not.
