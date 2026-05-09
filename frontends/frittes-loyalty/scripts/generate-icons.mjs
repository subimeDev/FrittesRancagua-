import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const iconsDir = path.join(root, "public", "icons");

const logoSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" rx="200" fill="#FFD23F"/>
  <path d="M300 280h90v320h-90zM420 240h90v360h-90zM540 220h90v380h-90zM660 260h90v340h-90z" fill="#FFD23F" stroke="#1A1815" stroke-width="20"/>
  <path d="M250 580h520l-90 280c-120 40-240 40-360 0z" fill="none" stroke="#1A1815" stroke-width="28" stroke-linejoin="round"/>
</svg>
`;

await fs.mkdir(iconsDir, { recursive: true });

async function makeIcon(fileName, size, maskable = false) {
  const base = sharp(Buffer.from(logoSvg));
  const padded = maskable
    ? base.resize(Math.round(size * 0.8), Math.round(size * 0.8)).extend({
        top: Math.round(size * 0.1),
        bottom: Math.round(size * 0.1),
        left: Math.round(size * 0.1),
        right: Math.round(size * 0.1),
        background: "#FFD23F",
      })
    : base.resize(size, size);
  await padded.png().toFile(path.join(iconsDir, fileName));
}

await makeIcon("icon-192.png", 192);
await makeIcon("icon-512.png", 512);
await makeIcon("icon-maskable-192.png", 192, true);
await makeIcon("icon-maskable-512.png", 512, true);
await makeIcon("apple-touch-icon.png", 180);
await sharp(Buffer.from(logoSvg)).resize(64, 64).toFile(path.join(root, "public", "favicon.ico"));

console.log("Icons generated");
