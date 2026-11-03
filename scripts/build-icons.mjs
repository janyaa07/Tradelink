// Generates the PWA PNG icons in public/icons from the shapes in public/icon.svg (ADR 0016).
// Uses only built-in modules: shapes are rasterised with 4x4 supersampling and written as PNG with zlib.
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const VIEWBOX = 48;
const BACKGROUND = [0x0f, 0x52, 0x39];
const WHITE = [0xff, 0xff, 0xff];
const MINT = [0x3d, 0xe2, 0x9f];
const SAMPLES = 4;

// The two strokes of the mark, in icon.svg's inner coordinates, placed by translate(9 9) scale(.625).
const place = ([x, y]) => [9 + x * 0.625, 9 + y * 0.625];
const LEFT = [[6, 9], [22.5, 9], [22.5, 39], [16.5, 39], [16.5, 15.5], [6, 15.5]].map(place);
const RIGHT = [[25.5, 9], [42, 9], [42, 15.5], [31.5, 15.5], [31.5, 39], [25.5, 39]].map(place);

function insidePolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function insideRoundedSquare(x, y, radius) {
  const cx = Math.min(Math.max(x, radius), VIEWBOX - radius);
  const cy = Math.min(Math.max(y, radius), VIEWBOX - radius);
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

/** The colour and coverage of one sample point, or null when it is transparent. */
function sample(x, y, radius) {
  if (insidePolygon(x, y, LEFT)) return WHITE;
  if (insidePolygon(x, y, RIGHT)) return MINT;
  return insideRoundedSquare(x, y, radius) ? BACKGROUND : null;
}

/** RGBA pixels. A maskable icon is full-bleed: the platform applies its own mask. */
function render(size, maskable) {
  const radius = maskable ? 0 : 12;
  const pixels = Buffer.alloc(size * size * 4);
  const scale = VIEWBOX / size;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, hits = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const colour = sample((px + (sx + 0.5) / SAMPLES) * scale, (py + (sy + 0.5) / SAMPLES) * scale, radius);
          if (!colour) continue;
          r += colour[0];
          g += colour[1];
          b += colour[2];
          hits++;
        }
      }
      const offset = (py * size + px) * 4;
      if (hits > 0) {
        pixels[offset] = Math.round(r / hits);
        pixels[offset + 1] = Math.round(g / hits);
        pixels[offset + 2] = Math.round(b / hits);
      }
      pixels[offset + 3] = Math.round((hits / (SAMPLES * SAMPLES)) * 255);
    }
  }
  return pixels;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    pixels.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([signature, chunk("IHDR", header), chunk("IDAT", deflateSync(rows)), chunk("IEND", Buffer.alloc(0))]);
}

const icons = [
  { file: "icon-192.png", size: 192, maskable: false },
  { file: "icon-512.png", size: 512, maskable: false },
  { file: "maskable-192.png", size: 192, maskable: true },
  { file: "maskable-512.png", size: 512, maskable: true },
  // iOS rounds the corners itself, so the touch icon is full-bleed too.
  { file: "apple-touch-icon.png", size: 180, maskable: true },
];

mkdirSync("public/icons", { recursive: true });
for (const { file, size, maskable } of icons) {
  writeFileSync(`public/icons/${file}`, png(size, render(size, maskable)));
  console.log(`public/icons/${file}`);
}
