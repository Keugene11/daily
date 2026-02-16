import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const svg = readFileSync(join(publicDir, 'icon.svg'));

const sizes = [192, 512, 180];

for (const size of sizes) {
  const name = size === 180 ? `icon-${size}x${size}.png` : `icon-${size}x${size}.png`;
  await sharp(svg).resize(size, size).png().toFile(join(publicDir, name));
  console.log(`Created ${name}`);
}

console.log('Done! Icons saved to frontend/public/');
