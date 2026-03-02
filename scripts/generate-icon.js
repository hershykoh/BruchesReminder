/**
 * Generates icon assets for all platforms:
 *   assets/icon.png  — 256×256 PNG  (Linux tray + base image)
 *   assets/icon.ico  — ICO container wrapping the PNG  (Windows)
 *
 * On macOS, electron-builder converts icon.png → icon.icns automatically
 * using the system `sips` + `iconutil` tools.
 *
 * Run: node scripts/generate-icon.js
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function writePNG(width, height, pixelFn) {
  // PNG header
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  function chunk(type, data) {
    const typeBuf = Buffer.from(type, "ascii");
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const crcBuf = Buffer.alloc(4);
    const crcData = Buffer.concat([typeBuf, data]);
    let crc = 0xffffffff;
    for (const b of crcData) {
      crc ^= b;
      for (let i = 0; i < 8; i++)
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    crc = (~crc) >>> 0;
    crcBuf.writeUInt32BE(crc, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 2;  // color type: RGB
  ihdrData[10] = 0; ihdrData[11] = 0; ihdrData[12] = 0;
  const ihdr = chunk("IHDR", ihdrData);

  // Raw image data (scanlines with filter byte)
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0; // filter none
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixelFn(x, y, width, height);
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });
  const idat = chunk("IDAT", compressed);
  const iend = chunk("IEND", Buffer.alloc(0));

  return Buffer.concat([header, ihdr, idat, iend]);
}

function drawIcon(x, y, w, h) {
  const cx = w / 2, cy = h / 2;
  const dx = x - cx, dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const r = w / 2 - 1;

  // Background circle — deep navy
  if (dist > r) return [30, 30, 50]; // transparent-ish border

  // Star of David (two overlapping triangles)
  const tr = r * 0.55; // triangle circumradius
  function inTriangle(px, py, angle) {
    const pts = [0, 120, 240].map((a) => {
      const rad = ((a + angle) * Math.PI) / 180;
      return [cx + tr * Math.sin(rad), cy - tr * Math.cos(rad)];
    });
    function sign(ax, ay, bx, by, qx, qy) {
      return (ax - qx) * (by - ay) - (bx - ax) * (qy - ay);
    }
    const d1 = sign(pts[0][0], pts[0][1], pts[1][0], pts[1][1], px, py);
    const d2 = sign(pts[1][0], pts[1][1], pts[2][0], pts[2][1], px, py);
    const d3 = sign(pts[2][0], pts[2][1], pts[0][0], pts[0][1], px, py);
    const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
    const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(hasNeg && hasPos);
  }

  const inStar = inTriangle(x, y, 0) || inTriangle(x, y, 180);

  if (inStar) return [251, 191, 36]; // golden star
  if (dist <= r) return [30, 58, 138]; // navy circle
  return [20, 20, 40];
}

// ─── ICO writer (Vista+ format — embeds the raw PNG bytes) ───────────────────
function writeICO(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  let imageOffset = headerSize + dirEntrySize * count;

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);     // reserved
  header.writeUInt16LE(1, 2);     // type = ICO
  header.writeUInt16LE(count, 4); // number of images

  const entries = [];
  for (const png of pngBuffers) {
    const entry = Buffer.alloc(16);
    entry[0] = 0;         // width  (0 = 256)
    entry[1] = 0;         // height (0 = 256)
    entry[2] = 0;         // color count
    entry[3] = 0;         // reserved
    entry.writeUInt16LE(1, 4);                  // planes
    entry.writeUInt16LE(32, 6);                 // bit count
    entry.writeUInt32LE(png.length, 8);         // bytes in resource
    entry.writeUInt32LE(imageOffset, 12);       // offset
    imageOffset += png.length;
    entries.push(entry);
  }

  return Buffer.concat([header, ...entries, ...pngBuffers]);
}

// ─── Generate ─────────────────────────────────────────────────────────────────
const assetsDir = path.join(__dirname, "..", "assets");
fs.mkdirSync(assetsDir, { recursive: true });

// 256×256 PNG — used directly on Linux, wrapped in ICO for Windows
const png256 = writePNG(256, 256, drawIcon);
fs.writeFileSync(path.join(assetsDir, "icon.png"), png256);
console.log("✓ Generated assets/icon.png (256×256)");

// Windows ICO — wraps the 256×256 PNG (Vista+ supports embedded PNGs in ICO)
const icoData = writeICO([png256]);
fs.writeFileSync(path.join(assetsDir, "icon.ico"), icoData);
console.log("✓ Generated assets/icon.ico  (Windows)");
