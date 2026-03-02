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
  const r = w / 2 - 0.5;

  // Outside the main circle → thin dark border
  if (dist > r) return [16, 16, 32];

  // ── Plate ring ─────────────────────────────────────────────────────────
  // rimWidth is at least 2px so it's visible even at 16×16
  const plateR   = r * 0.80;
  const rimWidth = Math.max(2, r * 0.14);
  const plateRin = plateR - rimWidth;
  if (dist <= plateR && dist >= plateRin) return [245, 235, 210]; // cream rim

  // ── Fork (left of center) ──────────────────────────────────────────────
  const forkCx   = cx - r * 0.30;
  const handleW  = Math.max(1, r * 0.11);  // bold handle, always ≥1px
  const tineW    = Math.max(1, r * 0.07);
  const tineGap  = Math.max(1, r * 0.13);
  const topY     = cy - r * 0.68;
  const tineEndY = cy - r * 0.18;
  const botY     = cy + r * 0.68;

  const onHandle = Math.abs(x - forkCx) <= handleW && y >= tineEndY && y <= botY;
  // At small sizes (< 48px) draw a single bold prong instead of two tiny tines
  const onTines  = w >= 48
    ? (Math.abs(x - (forkCx - tineGap)) <= tineW || Math.abs(x - (forkCx + tineGap)) <= tineW)
      && y >= topY && y < tineEndY
    : Math.abs(x - forkCx) <= handleW && y >= topY && y < tineEndY;

  if (onHandle || onTines) return [215, 215, 228]; // silver

  // ── Knife (right of center) ────────────────────────────────────────────
  const knifeCx = cx + r * 0.30;
  const knifeW  = Math.max(1, r * 0.11);
  if (Math.abs(x - knifeCx) <= knifeW && y >= topY && y <= botY) return [215, 215, 228];

  // ── Blue background ────────────────────────────────────────────────────
  return [40, 80, 160];
}

// ─── ICO writer (Vista+ format — embeds raw PNG bytes at multiple sizes) ─────
// images: Array of { png: Buffer, size: number }
function writeICO(images) {
  const count = images.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  let imageOffset = headerSize + dirEntrySize * count;

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);     // reserved
  header.writeUInt16LE(1, 2);     // type = ICO
  header.writeUInt16LE(count, 4); // number of images

  const entries = [];
  for (const { png, size } of images) {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size; // width  (0 = 256 per ICO spec)
    entry[1] = size >= 256 ? 0 : size; // height (0 = 256 per ICO spec)
    entry[2] = 0;         // color count (0 = no palette)
    entry[3] = 0;         // reserved
    entry.writeUInt16LE(1, 4);                  // planes
    entry.writeUInt16LE(32, 6);                 // bit count
    entry.writeUInt32LE(png.length, 8);         // bytes in resource
    entry.writeUInt32LE(imageOffset, 12);       // offset to image data
    imageOffset += png.length;
    entries.push(entry);
  }

  return Buffer.concat([header, ...entries, ...images.map(i => i.png)]);
}

// ─── Generate ─────────────────────────────────────────────────────────────────
const assetsDir = path.join(__dirname, "..", "assets");
fs.mkdirSync(assetsDir, { recursive: true });

// 256×256 PNG — used directly on Linux/macOS and as base image
const png256 = writePNG(256, 256, drawIcon);
fs.writeFileSync(path.join(assetsDir, "icon.png"), png256);
console.log("✓ Generated assets/icon.png (256×256)");

// Multi-resolution ICO for Windows — crisp at all icon sizes
const icoSizes = [16, 32, 48, 128, 256];
const icoImages = icoSizes.map(size => ({
  size,
  png: writePNG(size, size, drawIcon),
}));
const icoData = writeICO(icoImages);
fs.writeFileSync(path.join(assetsDir, "icon.ico"), icoData);
console.log(`✓ Generated assets/icon.ico  (${icoSizes.join("×, ")}× — multi-resolution)`);
