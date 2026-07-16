# Watermark WebM Export

Renders an animated watermark authored in [Claude Design](https://claude.ai/design) and exports it
as a transparent (alpha-channel) WebM video, suitable for overlaying on top of other video footage.

Source design: [動画生成ウォーターマークデザイン](https://claude.ai/design/p/04b66e2b-ee5c-4c85-8ae4-75555693b4af?file=Watermark+3a+Export.dc.html)
(file `Watermark 3a Export.dc.html`), pulled via the Claude Design MCP into `design/watermark.dc.html`
and `design/support.js` (the `dc-runtime` that boots the `<x-dc>` template into a React render).

The watermark is a 6-second, seamlessly looping animation: an icon "bursts" in with orbiting
particles, and a translucent glass-panel label wipes in next to it.

## How it works

A `.dc.html` file isn't a plain static page — it needs `support.js` to boot React/ReactDOM/Babel
(loaded from `unpkg.com` at runtime) and parse the `<x-dc>` template before anything renders, and it
pulls a couple of images/fonts from Google Fonts and S3. So capturing it requires a real browser, not
just a screenshot of the raw HTML.

1. **`capture.js`** — serves `design/` over a local HTTP server (fetch() inside `support.js` needs a
   real origin, not `file://`), loads the page in Puppeteer, waits for images/fonts/React to be ready,
   then **pauses every CSS animation and steps `document.getAnimations()[].currentTime` frame-by-frame**
   through one full 6s loop at the target frame rate. This captures deterministic, jitter-free frames
   instead of racing real wall-clock time against screenshot overhead. Each frame is saved as a
   transparent PNG (`page.screenshot({ omitBackground: true })`) into `frames_raw_<fps>fps/`.
2. **`crop.py`** — scans the alpha channel of every captured frame to find the union bounding box of
   all visible pixels across the whole animation (the icon scales up to 1.3x and particles fly outward
   partway through the loop, so the visible area isn't constant), pads it, rounds it to even dimensions
   (required by the `yuv420`-family pixel format), and writes tightly-cropped frames to
   `frames_<fps>fps/`.
3. **`encode.sh`** — encodes `frames_<fps>fps/*.png` into `output/watermark-<fps>fps.webm` with
   `ffmpeg`, using `libvpx-vp9` + `-pix_fmt yuva420p` + `-auto-alt-ref 0` (VP9's alt-ref frames aren't
   compatible with alpha) to preserve real per-pixel transparency, with a 1-second keyframe interval
   for reliable seeking in players/editors.

The frame rate is controlled by the `FPS` environment variable (default `30`) and threaded through all
three steps, so 30fps and 60fps exports live side by side without clobbering each other.

## Prerequisites

- Node.js (tested with v24)
- `ffmpeg` built with `libvpx-vp9` (check with `ffmpeg -encoders | grep vp9`)
- Python 3 with Pillow (`pip install pillow`) for the cropping step
- Internet access (the design fetches Google Fonts, an S3-hosted icon/logo, and React/Babel from
  unpkg.com at render time)

## Usage

```bash
npm install
npm run build:30fps   # -> output/watermark-30fps.webm
npm run build:60fps   # -> output/watermark-60fps.webm
```

Or step by step, for any frame rate:

```bash
npm install
FPS=60 node capture.js   # -> frames_raw_60fps/*.png (360 frames)
FPS=60 python3 crop.py    # -> frames_60fps/*.png (cropped)
FPS=60 bash encode.sh      # -> output/watermark-60fps.webm
```

Output: `output/watermark-<fps>fps.webm`, alpha-channel VP9, 850x264px, 6s, looping.
30fps is ~400KB, 60fps is ~580KB (both are the same crop; only the frame rate differs — 60fps buys
smoother in-betweens on the icon burst/particle motion, at roughly 1.4x the file size).

### Previewing transparency

`preview.html` plays an exported video on four different background swatches (red, blue, black,
checkerboard) so you can visually confirm the alpha channel is intact. It defaults to the 30fps file;
pass `?src=watermark-60fps.webm` to preview the other one:

```bash
python3 -m http.server 8000   # from this directory
# open http://localhost:8000/preview.html                       (30fps)
# open http://localhost:8000/preview.html?src=watermark-60fps.webm
```

Note: Chromium's headless `<video>.currentTime` *seek* can occasionally show a stale/blank frame for
this codec combination in headless/software-rendered environments — this is a headless-renderer quirk,
not a defect in the file. Normal forward playback (`autoplay`/`loop`, or scrubbing in a real browser
window or video editor) renders correctly, which is how the file was validated here.

## Regenerating after edits

If you edit `design/watermark.dc.html` (e.g. change the animation timing), re-run `npm run build:30fps`
and/or `npm run build:60fps`. If the loop duration changes from 6s, update `LOOP_MS` in `capture.js`
accordingly.
