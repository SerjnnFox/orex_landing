# Orex landing

Static landing page for orex.world: plain HTML, CSS and JS, no build step.

- `index.html` — the page (texts are kept from the current orex.world landing)
- `assets/css/styles.css` — styles
- `assets/js/landing.js` — UTM forwarding to platform links, menu, reveal-on-scroll, gold dust
- `assets/js/sand.js` — the golden-sand effect: images assemble from sand when they scroll into view and crumble when they leave

Run locally (the sand effect reads image pixels, so open it over HTTP, not `file://`):

```bash
python3 -m http.server 8080
```
