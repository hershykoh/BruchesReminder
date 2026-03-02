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

  // ── Plate (circle outline) ──────────────────────────────────────────────
  // Outer plate rim
  const plateR   = r * 0.82;
  const plateRin = r * 0.65; // inner plate area
  const inRim    = dist <= plateR && dist > plateRin;

  // Food on plate: a simple dome (filled semi-ellipse) representing a meal
  const foodRx  = plateRin * 0.80;
  const foodRy  = plateRin * 0.55;
  const foodCy  = cy + plateRin * 0.10; // slightly below center
  const fdfx    = (x - cx) / foodRx;
  const fdfy    = (y - foodCy) / foodRy;
  const inFood  = (fdfx * fdfx + fdfy * fdfy) <= 1 && y <= foodCy; // upper dome

  // Fork — left of center: two tines (thin rects) + handle
  const forkX    = cx - r * 0.42;
  const tineHW   = r * 0.038;
  const tineGap  = r * 0.11;
  const tineTop  = cy - r * 0.72;
  const tineBot  = cy - r * 0.30;
  const handleT  = cy - r * 0.30;
  const handleB  = cy + r * 0.72;
  const handleHW = r * 0.055;
  const inForkTine = (
    (Math.abs(x - (forkX - tineGap)) <= tineHW || Math.abs(x - (forkX + tineGap)) <= tineHW)
    && y >= tineTop && y <= tineBot
  );
  const inForkHandle = Math.abs(x - forkX) <= handleHW && y >= handleT && y <= handleB;
  const inFork = inForkTine || inForkHandle;

  // Knife — right of center: thin blade + wider handle
  const knifeX   = cx + r * 0.42;
  const bladeHW  = r * 0.055;
  const bladeTop = cy - r * 0.72;
  const bladeBot = cy - r * 0.20;
  const kHandleHW = r * 0.095;
  const kHandleT  = cy - r * 0.20;
  const kHandleB  = cy + r * 0.72;
  const inKnife   = (
    (Math.abs(x - knifeX) <= bladeHW  && y >= bladeTop && y <= bladeBot) ||
    (Math.abs(x - knifeX) <= kHandleHW && y >= kHandleT && y <= kHandleB)
  );

  // Colors
  if (inFork || inKnife) return [220, 220, 230]; // silver cutlery
  if (inRim)             return [240, 230, 210]; // cream plate rim
  if (inFood)            return [235, 170,  80]; // warm food colour
  if (dist <= plateRin)  return [255, 248, 235]; // plate surface
  if (dist <= r)         return [ 40,  80, 160]; // cobalt blue background
  return [20, 20, 40];
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
