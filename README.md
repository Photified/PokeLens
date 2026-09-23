# PokéLens 2.0

An installable Pokémon card scanner for GitHub Pages. Free on-device scans, no API key and no scan quota. Real TCGplayer market prices come from the bundled TCGCSV snapshot and the daily update workflow.

## Upload to GitHub

1. Extract `PokeLens-GitHub.zip`.
2. Upload **everything inside** to the repository root, including `.github/workflows/pages.yml`. `index.html` belongs at the top level. Do not upload the ZIP itself.
3. In **Settings → Pages**, select **GitHub Actions**.
4. Open **Actions → Update prices and publish PokéLens → Run workflow**. Wait for the green check, then open the Pages link.
5. Close and reopen an existing installed copy. The settings cog should show **PokéLens 2.0**.

Every individual source file is below GitHub's 25 MB browser-upload limit. The downloadable ZIP is larger because it contains the complete offline recognition files. GitHub shows `.github/workflows` as one combined folder when that is its only subfolder.

The workflow creates the app's **Download App Files** ZIP when it publishes. Use the Actions deployment method above so that this download and daily price updates are included.

**First deployment:** the ZIP includes 19,346 prebuilt image references. GitHub Actions downloads and indexes the remaining available references before publishing. Wait for that first workflow to finish; do not use branch-based Pages deployment for this package. Subsequent runs reuse the finished index.

## Use

Tap **Scan a card** and allow the camera. Hold one upright card in the large frame. Scanning runs automatically. Possible matches show images, set names, collector numbers and available Normal, Holofoil, Reverse Holofoil or edition prices. Tap the printing you own. **Scan next card** resumes scanning.

The top-right cog includes How to use, **Install App**, **Download App Files**, automatic scanning and optional spoken prices. Manifest icons retain `purpose: "any maskable"`. Safari uses its Add to Home Screen flow when a native install prompt is unavailable.

The first scan downloads the recognition assets. Subsequent scans reuse cached files. A photo is processed locally; it is not uploaded to a recognition service. Camera access requires HTTPS or localhost.

## What changed

The previous OCR-gated image shortlist was removed. The new pipeline:

1. Finds card-shaped boundaries and flattens perspective, retaining detailed pixels for text recognition. It also checks alternative framing when sleeves or reflections confuse the boundary detector.
2. Uses **DINOv2-small** image embeddings to search every available indexed reference independently of OCR.
3. Reads the title region separately from the move descriptions and collector-number region. Attack text cannot masquerade as a title. English OCR contributes title, moves, number and HP where readable.
4. Combines visual and text evidence. A missing stylized `ex` logo does not automatically favor an older regular card. Strong text can recover a difficult foil; clear image evidence can recover unreadable text.
5. Checks another live frame and merges evidence only when its image features remain consistent. Results pause automatic scanning while you choose a printing.
6. Limits alternatives to supported card identities and plausible printings. A low-confidence unrelated guess is not forced into the result list.

No condition-price estimates or Collectr integration were added. Missing market prices stay unavailable rather than being fabricated.

## Coverage and limits

The included TCGCSV snapshot contains 29,908 listings from 220 sets. The image index records exact coverage and unavailable references in `data/vision-v2/index.json`. Some provider images are unavailable; those listings remain accessible through sufficiently strong text evidence. New listings are discovered by the daily workflow, with no set allowlist.

Catalog coverage is not a guarantee of recognizing every physical card. Foil, stamps, reprints, languages, damaged printing, severe glare and low-resolution capture can remain ambiguous. The app displays **Possible matches**, and the user chooses the printing. It does not authenticate cards or grade condition.

Prices are TCGplayer market references in USD, supplied by TCGCSV. They are not NM/LP/MP/HP/Damaged valuations or guaranteed sale prices. Each result displays the source date. The bundled snapshot keeps its real timestamp; building a new scanner does not make older prices fresh.

See `VALIDATION.md` for measured recognition results and remaining test limitations. No claim of universal accuracy or measured live-phone speed is made.

## Updating

The GitHub workflow refreshes catalog data and prices daily at 22:37 UTC, indexes newly available reference images, runs the recognition-rule tests, and publishes atomically. A failed build preserves the previous Pages deployment. GitHub can delay or disable scheduled runs; use **Run workflow** when needed.

`sync_catalog.py` refreshes metadata and prices. `sync_vision.py` downloads only missing public reference images, then runs `build_index.py` inside `offline_runtime.py`. The native encoder has OS-level networking denied before it loads, preventing optional runtime telemetry. Existing embeddings are reused. The Linux build requires libseccomp, included on the Ubuntu GitHub Actions runner.

Model/index SHA-256 checks prevent mismatched deployments from silently producing incorrect similarity scores. The browser uses the WASM backend with one thread, so GitHub Pages does not need cross-origin-isolation headers. A worker keeps neural inference off the UI thread.

## Development

Static preview: `python -m http.server 8080`. Recognition-rule checks: `npm test`. Build the deployment and source download with `python scripts/package.py` after the catalog and image index are complete. The package step refuses an incomplete or mismatched image index.

Core files: `scanner.js`, `imaging.js`, `recognition.js`, `vision-engine.js`, `vision-worker.js`, `visual.js`. The existing UI, install flow and real-price rendering are reused in `app.js`, `index.html` and `style.css`.

## Credits

- Card metadata and market prices: [TCGCSV](https://tcgcsv.com/) and [TCGplayer](https://www.tcgplayer.com/).
- DINOv2-small: [Meta Research](https://huggingface.co/facebook/dinov2-small), Apache 2.0; [Xenova ONNX conversion](https://huggingface.co/Xenova/dinov2-small).
- ONNX Runtime Web 1.22.0, MIT; OpenCV.js 4.11.0, Apache 2.0.
- Tesseract.js/core 5.1.1 and tessdata_best English, Apache 2.0.

Bundled license notices are in `vendor/` and `vendor/vision/`. Independent fan project, not affiliated with Pokémon, Nintendo, Creatures, GAME FREAK, TCGplayer or Collectr.
