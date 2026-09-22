# PokéLens

A static Pokémon card scanner for GitHub Pages. No account, API keys, paid AI, or scan credits. Scans are processed on your device. Includes a real TCGplayer price snapshot from TCGCSV.

## Put it on GitHub

1. Unzip the download and upload **everything inside** it to your repository, including the `.github` folder. `index.html` must be at the repository root.
2. Open **Settings → Pages → Source → GitHub Actions**.
3. Open **Actions → Update prices and publish PokéLens → Run workflow**. Wait for the green check. Your Pages link appears under Settings → Pages.

The app also works with **Deploy from a branch → main → / (root)** using the included snapshot, but automatic publishing of daily price updates requires the GitHub Actions option above.

Use the Pages URL, not the github.com repository URL. Camera access needs HTTPS. No build tools are required on your computer. A public GitHub repository supports the standard free Pages/Actions route; account policies and service limits still apply.

## On your phone

Tap Scan a card, allow the camera, and fill the frame with one upright card. Hold steady; it scans automatically. Tap Scan now to trigger a scan yourself. Scan a photo accepts a saved image. Keep the photo closely cropped to a single card.

The top-right cog contains How to use, Install App, Download App Files, automatic scanning, and optional spoken prices. On browsers that support install prompts, Install App opens the native prompt. On iPhone, it explains Safari's Share → Add to Home Screen flow. Both manifest icons use `purpose: "any maskable"` with artwork inside the safe zone.

## What the scanner can and cannot do

- The snapshot includes all available numbered singles and other identifiable single-card listings in TCGCSV's Pokémon category. No set allowlist or release cutoff is used. The next daily run discovers new sets automatically.
- This version uses **English OCR** plus artwork comparison for candidates with a matching card number or name, not a paid visual AI model. Catalog coverage does not imply that every physical card will scan successfully. Non-English cards are not supported by this OCR model.
- Results are ranked **possible matches**, not a claim of an exact printing. Name, collector number, HP, attack names and readable set codes contribute independently where metadata is available. Three-letter and split names such as Mew are supported. Unreadable details do not veto other evidence.
- Existing artwork comparison reranks up to 120 text-backed candidates. This is a targeted revision, not a newly trained vision model or a whole-catalog image-only search. Completely unreadable text can still prevent results. Set symbols and stamps are not independently classified; visually similar listings remain alternatives.
- The result panel lists each candidate with its own image, set, number and available normal/holo/reverse prices. Scroll and use Show more matches for further alternatives. Tap a card to select its listing, then Back to possible matches to compare again. No manual names or numbers are required.
- In camera mode, a second frame contributes details only if the appearance remains similar. The camera stays on while results are reviewed; automatic processing pauses to avoid replacing results mid-selection. Tap Scan next card to continue.
- Prices are **TCGplayer market, USD**, sourced through TCGCSV. They are not condition-specific, graded values, offers to buy, or guaranteed sale prices. Missing market prices remain unavailable, never $0.
- Catalog/source timestamps are displayed with every result. Prices older than three days are explicitly marked. Offline scans use the last stored catalog. New scans do not make external price requests. Artwork comparison requires an internet connection or previously cached reference images.
- Scans/photos are not uploaded. Recent scan identities remain on this device. Card listing thumbnails load from TCGplayer. Clear removes recent scan history.

## Daily updates

The workflow refreshes after TCGCSV's daily update, at 22:37 UTC. GitHub scheduling can be delayed and public-repository schedules may be disabled after inactivity; run the workflow manually if prices look old. A failed refresh leaves the previous deployment intact.

`python scripts/sync_catalog.py` builds the snapshot with Python's standard library, a custom User-Agent, paced requests, source-timestamp checks, retry handling, and atomic writes. It fetches all groups, joins products and prices by product ID, and refuses obviously incomplete snapshots. `python scripts/package.py` creates the in-app source download and the clean `site-dist` deployment directory. The workflow caches the last successful catalog and does not commit to your repository.

When extracting the app's **Download App Files** ZIP, run the included GitHub workflow to generate a fresh source download link for that deployment. The outer delivery ZIP includes a ready-made copy; the inner source ZIP excludes itself to avoid infinite nesting.

## Files & local checks

- `index.html`, `style.css`, `app.js`: mobile UI, camera, OCR, results, settings.
- `imaging.js`, `matcher.js`, `visual.js`: conservative text/artwork matching and market-price summarization.
- `vendor/`: bundled Tesseract.js 5.1.1, core 5.1.1 and English high-accuracy OCR model; no runtime CDN required.
- `data/catalog.json`: timestamped card and price snapshot.
- `manifest.json`, `sw.js`, `assets/`: installability and offline caching.
- `.github/workflows/pages.yml`: scheduled refresh and GitHub Pages deployment.

Local preview: `python -m http.server 8080`, then open http://localhost:8080. For a phone, use the HTTPS Pages URL. Matcher checks: `npm test`.

When changing app shell files, bump the cache version in `sw.js`. Data uses network-first refresh and preserves the offline snapshot. Version 1.2 was checked using the four supplied screenshot card regions, native Tesseract with the bundled English model, the actual recognition modules and a simulated DOM for result interactions. Those checks are not physical phone-camera or browser-WASM performance measurements. No claim of universal recognition is made.

## Credits

Data: TCGplayer via https://tcgcsv.com/ (usage details: https://tcgcsv.com/docs).
Recognition: https://github.com/naptha/tesseract.js (Apache 2.0), bundled license in `vendor/`.
English trained model: https://github.com/tesseract-ocr/tessdata_best, Tesseract tessdata_best (Apache 2.0).
Independent fan tool, not affiliated with Pokémon, Nintendo, Creatures, GAME FREAK, TCGplayer, or Collectr.

## Version 1.1 update

Larger viewfinder, camera requests up to 3840 × 2160 (device-dependent), and native-resolution frame capture. Uploaded images retain up to 3200 pixels on their long edge. Adds automatic border cropping, focused title/number OCR, the higher-accuracy English model, name-assisted artwork lookup, framing tolerance, and high-quality image resampling. Artwork comparison gives more weight to the illustration so reverse-holo text panels do not dominate the result. Alternative visual windows are small thumbnails to limit mobile memory use.

Regression checks matched both user-supplied screenshot card regions: Lapras ex 022/088 and Dewgong 019/088. These are small image tests, not a guarantee for every physical card or lighting condition. Several visually similar printings can still yield a range.

Condition pricing was intentionally not added. No guessed NM/LP/MP/HP/Damaged discounts are calculated. Collectr is not connected.

To update an existing repository, upload the contents over the old files. The `vendor/best` folder and `imaging.js` are new and required. The existing workflow path stays `.github/workflows/pages.yml`. Wait for the GitHub Actions deployment to finish, then close and reopen the app to load v1.1. Settings shows the version at the bottom. The first load downloads a larger recognition model.

## Version 1.2 update

Reuses the existing UI, OCR model, image comparison and pricing provider. Adds ranked possible matches, per-listing prices, more-results paging, selection/back navigation, short-name handling, independent HP/attack evidence and a second camera frame check. Reference-image failures preserve text-backed candidates. Recent history records user-selected listings, not unconfirmed guesses.

`sync_catalog.py` now includes HP and attack names from TCGCSV when supplied. Existing prices keep their source timestamp. The scheduled workflow builds an enriched snapshot for all returned products; listings without this metadata continue to use other cues.

Upload the ZIP contents over the existing repository files, including `.github/workflows/pages.yml`. Wait for deployment, then reopen the app. Settings should show **PokéLens 1.2**. No condition pricing or Collectr connection was added.
