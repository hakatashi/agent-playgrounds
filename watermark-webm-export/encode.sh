#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

FPS="${FPS:-30}"
OUT="output/watermark-${FPS}fps.webm"

mkdir -p output

# libvpx-vp9 with yuva420p preserves the alpha channel; auto-alt-ref must be
# disabled because VP9's alt-ref frames are not compatible with alpha.
ffmpeg -y \
  -framerate "$FPS" \
  -i "frames_${FPS}fps/frame_%04d.png" \
  -c:v libvpx-vp9 \
  -pix_fmt yuva420p \
  -auto-alt-ref 0 \
  -b:v 0 \
  -crf 24 \
  -row-mt 1 \
  -g "$FPS" \
  -keyint_min "$FPS" \
  "$OUT"

echo "wrote $OUT"
