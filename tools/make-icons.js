/**
 * Generates correctly-sized PWA icons from img/logo.png (200x200, transparent).
 * - icon-192.png / icon-512.png  : opaque, purpose "any"
 * - icon-maskable-512.png        : padded to the 80% safe zone, purpose "maskable"
 * - apple-touch-icon.png         : 180x180 opaque (iOS ignores transparency)
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const ROOT = path.join(__dirname, '..');
const src = PNG.sync.read(fs.readFileSync(path.join(ROOT, 'img', 'logo.png')));
const BG = [0xFF, 0xF8, 0xF0, 0xFF];   // #FFF8F0, matches manifest background_color

function sampleBilinear(x, y) {
  const sx = Math.min(Math.max(x, 0), src.width - 1);
  const sy = Math.min(Math.max(y, 0), src.height - 1);
  const x0 = Math.floor(sx), y0 = Math.floor(sy);
  const x1 = Math.min(x0 + 1, src.width - 1), y1 = Math.min(y0 + 1, src.height - 1);
  const fx = sx - x0, fy = sy - y0;
  const idx = (px, py) => (py * src.width + px) << 2;
  const out = [0, 0, 0, 0];
  for (let c = 0; c < 4; c++) {
    const top = src.data[idx(x0, y0) + c] * (1 - fx) + src.data[idx(x1, y0) + c] * fx;
    const bot = src.data[idx(x0, y1) + c] * (1 - fx) + src.data[idx(x1, y1) + c] * fx;
    out[c] = top * (1 - fy) + bot * fy;
  }
  return out;
}

/**
 * @param {number} size    output canvas edge
 * @param {number} fill    logo occupies this fraction of the canvas (safe zone)
 */
function makeIcon(size, fill) {
  const out = new PNG({ width: size, height: size });
  const art = size * fill;
  const off = (size - art) / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const o = (y * size + x) << 2;
      let r = BG[0], g = BG[1], b = BG[2];

      // inside the logo box? resample with bilinear filtering
      if (x >= off && x < off + art && y >= off && y < off + art) {
        const sx = ((x - off) / art) * src.width;
        const sy = ((y - off) / art) * src.height;
        const p = sampleBilinear(sx - 0.5, sy - 0.5);
        const a = p[3] / 255;                       // alpha-composite over BG
        r = p[0] * a + BG[0] * (1 - a);
        g = p[1] * a + BG[1] * (1 - a);
        b = p[2] * a + BG[2] * (1 - a);
      }

      out.data[o] = Math.round(r);
      out.data[o + 1] = Math.round(g);
      out.data[o + 2] = Math.round(b);
      out.data[o + 3] = 255;                        // always fully opaque
    }
  }
  return out;
}

const jobs = [
  ['icon-192.png', 192, 0.92],
  ['icon-512.png', 512, 0.92],
  ['icon-maskable-512.png', 512, 0.66],   // 80% safe zone -> 66% keeps art clear of the mask
  ['apple-touch-icon.png', 180, 0.92]
];

for (const [name, size, fill] of jobs) {
  const png = makeIcon(size, fill);
  const buf = PNG.sync.write(png, { deflateLevel: 9 });
  fs.writeFileSync(path.join(ROOT, 'img', name), buf);
  console.log('wrote img/' + name + '  ' + size + 'x' + size + '  ' + buf.length + ' bytes');
}
