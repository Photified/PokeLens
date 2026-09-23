# Recognition validation

Rebuild: PokéLens 2.0, DINOv2-small image search plus spatially separated English OCR.

## Supplied failure cases

The test inputs are the card/viewfinder regions from the five user-supplied screenshots. No card name or expected ID is passed into the recognition engine. Expected IDs are used only after recognition to check the output.

| Input | Expected listing | Outcome |
|---|---|---|
| moltres-frame | Team Rocket's Moltres ex 031/182 | Included in possible matches |
| mew-old | Mew 040, Trainer's Challenge Set | Included in possible matches |
| mew-ex | Mew ex 158/128 | Included in possible matches |
| dewgong-frame | Dewgong 019/088 | Included in possible matches |
| lapras-frame | Lapras ex 022/088 | Included in possible matches |

The correct Dewgong listing can appear alongside its Prize Pack printing. The Moltres result includes its stamped printing as an alternative. The scanner does not claim to distinguish every foil or stamp from these screenshots.

## Additional checks

- Blank and random-noise inputs return no priced match.
- Fifteen additional catalog reference images were placed on textured backgrounds with perspective distortion, JPEG compression and uneven lighting. All fifteen expected listings appeared in their result lists in the development run. These are synthetic regression fixtures, not fifteen new physical-camera photographs.
- Seven recognition-rule tests cover unrelated attack text, an unreadable ex logo, image-only recovery, ambiguous/weak-image rejection, text recovery when an unrelated image scores highly, real printing prices, and separation of different frames.

## Execution and limits

Recognition checks run the production crop, preprocessing, retrieval and ranking code with the bundled ONNX Runtime Web WASM engine, OpenCV.js WASM and Tesseract.js/core 5.1.1. A Node canvas adapter supplies image pixels and worker input. The OCR core was checked byte-for-byte against the bundled browser core. Native OCR was not substituted for these checks.

The test browser's security policy blocks local HTTP and local-file previews. Consequently, these results do **not** establish browser UI, live phone-camera speed, autofocus behavior or mobile memory performance. No physical phone was available for testing. Camera framing and two-frame handling have code/rule checks, not a measured live-camera benchmark.

The five screenshots are regression cases already used during development, not an independent accuracy benchmark. No claim of universal card recognition is made.

## Delivery status

The supplied-photo WASM regression run searched 12,578 indexed references. The synthetic run used the larger index available when that run started. The final full-catalog rerun was stopped at the user’s request to end further testing and deliver. The source ZIP contains 19,346 prebuilt references; the GitHub workflow completes remaining available references before publishing. Browser and physical-camera testing remain unverified.
