// Draws the app icon (blue rounded square with a white dumbbell) and writes all
// raster variants with sharp. The blue is the theme seed color.
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const BLUE = '#0B57D0';
const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));

// Dumbbell drawn in a 1024 box, centered, scaled by `s` around the center.
function dumbbell(s) {
  return `
  <g transform="translate(512 512) scale(${s}) translate(-512 -512)" fill="#FFFFFF">
    <rect x="300" y="468" width="424" height="88" rx="44"/>
    <rect x="232" y="352" width="96" height="320" rx="36"/>
    <rect x="696" y="352" width="96" height="320" rx="36"/>
    <rect x="148" y="412" width="76" height="200" rx="30"/>
    <rect x="800" y="412" width="76" height="200" rx="30"/>
  </g>`;
}

function svg({ background, radius, scale }) {
  const bg =
    background === 'none'
      ? ''
      : `<rect width="1024" height="1024" rx="${radius}" fill="${background}"/>`;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${bg}${dumbbell(scale)}</svg>`,
  );
}

async function write(file, source, size) {
  await sharp(source).resize(size, size).png().toFile(root(file));
  console.log(`Wrote ${file} (${size}x${size})`);
}

mkdirSync(root('assets'), { recursive: true });
mkdirSync(root('public/icons'), { recursive: true });

// Full-bleed square with rounded corners: app icon, favicon.
const rounded = svg({ background: BLUE, radius: 224, scale: 1 });
// Opaque full-bleed square: iOS and the maskable icon round or mask it themselves.
const square = svg({ background: BLUE, radius: 0, scale: 1 });
// Maskable: content must stay inside the central 80% safe zone.
const maskable = svg({ background: BLUE, radius: 0, scale: 0.78 });
// Android adaptive foreground: content inside the central 66%, transparent background.
const adaptive = svg({ background: 'none', radius: 0, scale: 0.62 });

await write('assets/icon.png', rounded, 1024);
await write('assets/adaptive-icon.png', adaptive, 1024);
await write('assets/splash-icon.png', rounded, 512);
await write('assets/favicon.png', rounded, 48);
await write('public/icons/apple-touch-icon.png', square, 180);
await write('public/icons/icon-192.png', rounded, 192);
await write('public/icons/icon-512.png', rounded, 512);
await write('public/icons/icon-maskable-512.png', maskable, 512);
