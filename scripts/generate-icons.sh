#!/bin/sh
# Regenerates the PWA icons in public/ from public/favicon.svg (NEU-1482).
#
# One-off: the PNGs are committed and nothing runs this at build time. It needs
# only Docker, since there is no host Node or image toolchain here. Re-run it
# after changing favicon.svg, and commit the result.
#
#   any       icon-192.png, icon-512.png   rounded tile, transparent corners
#   maskable  icon-maskable-{192,512}.png  full-bleed tile, art inside the 80% safe zone
#   apple     apple-touch-icon.png (180)   full-bleed tile — iOS paints transparency black
#
# Every icon sits on a --color-muted (#1e293b) tile, never bare: the favicon's
# frame and stand are #0f172a, which vanish on the #0f1729 splash background and
# on dark launchers, leaving only the cyan screen.
set -eu
cd "$(dirname "$0")/../public"

docker run --rm -v "$PWD:/work" -w /work -e OWNER="$(id -u):$(id -g)" alpine:3 sh -euc '
  apk add --no-cache rsvg-convert >/dev/null

  # tile <corner radius> <art scale>: the favicon'"'"'s art spans 56x46 units
  # centred on (32,35). Maskable needs its 72.5-unit diagonal inside the
  # 51.2-unit safe circle (scale 0.7); a rounded tile only needs a margin.
  tile() {
    echo "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\">"
    echo "<rect width=\"64\" height=\"64\" rx=\"$1\" fill=\"#1e293b\"/>"
    echo "<g transform=\"translate(32 32) scale($2) translate(-32 -35)\">"
    sed "1d;\$d" favicon.svg
    echo "</g></svg>"
  }
  tile 14 0.85 > /tmp/any.svg
  tile 0 0.7 > /tmp/full.svg

  rsvg-convert -w 192 -h 192 /tmp/any.svg -o icon-192.png
  rsvg-convert -w 512 -h 512 /tmp/any.svg -o icon-512.png
  rsvg-convert -w 192 -h 192 /tmp/full.svg -o icon-maskable-192.png
  rsvg-convert -w 512 -h 512 /tmp/full.svg -o icon-maskable-512.png
  rsvg-convert -w 180 -h 180 /tmp/full.svg -o apple-touch-icon.png
  chown "$OWNER" icon-*.png apple-touch-icon.png
'
