# BUILD LOG — Vice Heat Cover Studio (gta6-cover-art-01, v1)

App: "VICE HEAT — Cover Studio". Offline web app that turns your own photos
into a GTA-style cover poster. Entry built in the recording session; the
recording started before this session, so the transcript is complete.

## Concept (mirror #1, beat it with 3 things)

Base grammar mirrored from #1 Golden Mile "SUNDOWN RACKET" (concept only —
own title, own text, own photos, own code): 7-panel grid, hero close-up,
role tags, striped chrome title, neon script tagline, 5-star quote, gold
seal, billing block, barcode.

Three things that beat #1, all visible in the screenshots:

1. **WANTED-LEVEL COMPOSITION** — the wanted stars are functional, not
   decoration. 1 star = 3 panels, 2 = 4, 3 = 5, 4 = 6, 5 = 7; more stars
   also run the grade hotter (tint alpha +0.035/star) and scale the title
   bigger (x1.00–x1.20), and swap the tagline (SMALL TIME, BIG DREAMS →
   MOST WANTED). In #1 the stars do nothing.
2. **Micro-story per panel** (adopted from #5 Neon Harbor's pattern, own
   words): every panel carries PLACE · TIME · BOAST under its role tag,
   e.g. "OCEAN BOULEVARD · 6:47 PM · DRIVES INTO THE SUNSET".
3. **Hero POP-OUT** (adopted from #4 Billboard Bay): the hero is drawn last,
   enlarged past its cell with a white border and drop shadow, overlapping
   its neighbours — not a static close-up. The title lives in its own band
   below the panels, so it never covers a face. Role tags are written for
   the photo in the panel (THE GETAWAY / THE OLD SALT / THE LOOKOUT /
   THE TIDE CALLER / THE NIGHT OWL / THE REEL DEAL / THE HIGH LIFE) —
   never the generic THE DRIVER / FIXER / BOSS repeated across the top 6.

## Files (all fresh, written with the write tool)

- `app/index.html` — editor shell: topbar, preview canvas, export sizes,
  wanted stars, photo/title/caption/grade/panel controls.
- `app/style.css` — dark editor UI, gold accents, @font-face for the two
  OFL fonts, cover-only mode hiding the chrome for screenshots.
- `app/app.js` — state + one canvas poster renderer used for preview AND
  export (same drawing), face-aware crop (skin-tone cluster, upper 2/3 of
  the frame), 6 grades (VICE SUNSET, NEON NIGHTS, GOLDEN HOUR, PALM NOIR,
  HEATWAVE PINK, PALM DAYLIGHT — the last is the light cream palette only
  #6 in the top 6 uses), drag-to-pan, scroll-to-zoom, PNG export at
  1080×1080 / 1080×1350 / 1920×1080, `?shot=` boot params for
  deterministic screenshots.
- `app/fonts/` — Anton + Yellowtail woff2 with OFL license texts.
- `app/samples/` — kit sample photos boulevard.jpg + pier.jpg (kit assets,
  free to use; no real person photographed by us, no GTA artwork).
- `vendor/makefun-app.ts` — kit copy, unchanged.
- `main.ts` — fresh, own wording: copies app/ + screenshots/ to
  $MAKEFUN_OUTPUT_DIR and writes dossier.json via buildDossier.
- `screenshots/` — 4 shots (see below).

## Fixes found by looking at the screenshots

- Tagline clipped by the wanted chip → tagline moved up, chip shrunk to
  the bottom of the title band.
- Face crop picked the pier photo's arms instead of his face → face search
  restricted to the upper 2/3 of the frame with an upper bias.
- Portrait (1080×1350) quote ran under the VOL. 1 badge and the billing
  line ran under the seal → both now shrink-to-fit their available width.
- A first draft accidentally reused top-1's quote and source — replaced
  with own text: "THE COAST HAS NEVER LOOKED THIS GOOD" — THE VICE HERALD.

## Verification (all PASS, 20 Nov ~18:45–18:55 WIB)

- `node --check app/app.js` — syntax OK.
- No network references in app/ code: grep for http(s)://, fetch,
  XMLHttpRequest, import-from-http finds only the URLs inside the OFL
  license text files (license attribution text, not loaded resources).
- Headless Chromium renders, 4 screenshots taken via `?shot=`:
  - `01-cover-1920x1080.jpg` 1280×720, 164,476 bytes — exported cover,
    first by name (the cover).
  - `02-editor-loaded.jpg` 1280×800, 165,839 bytes — app in browser with
    both sample photos loaded.
  - `03-cover-square.jpg` 1024×1024, 196,090 bytes — exported cover,
    square.
  - `04-cover-portrait.jpg` 1024×1280, 224,000 bytes — exported cover,
    portrait.
  - All ≤256 KiB, long side ≤1280, short side ≥480. All four viewed and
    checked: no overlap, no clipped text, faces centred in every panel.
- `MAKEFUN_OUTPUT_DIR=/tmp/out1 node main.ts` — output holds app/ +
  screenshots/ + dossier.json (schema makefun/dossier/v1, cover 0,
  4 images, text 41,687 chars). Run twice → byte-identical
  (diff -r clean). Node prints only a module-type warning (the starter
  ships no package.json either, so this is the starter's own behaviour).
- Export sizes offered in the UI: 1080×1080, 1080×1350, 1920×1080.
  The same renderer draws preview and export, so what you see is what
  you get.

## Not done (belongs to Kimo main)

- No submit, no quota use, no README/About, no claim. Repo is ready for
  Kimo main's 4-point check + README/About + submit when Tommy says so.
