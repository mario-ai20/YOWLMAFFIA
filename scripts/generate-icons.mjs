import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const root = process.cwd();
const sourceImage = path.join(root, 'public', 'assets', 'yowl.jpg');
const buildDir = path.join(root, 'build');
const publicDir = path.join(root, 'public');
const icon512 = path.join(publicDir, 'icon-512.png');
const icon192 = path.join(publicDir, 'icon-192.png');
const appleIcon = path.join(publicDir, 'apple-touch-icon.png');
const buildIcon = path.join(buildDir, 'icon.png');

async function ensureDirs() {
  await fs.mkdir(buildDir, { recursive: true });
  await fs.mkdir(publicDir, { recursive: true });
}

async function makePng(size, outputPath) {
  await sharp(sourceImage)
    .resize(size, size, {
      fit: 'cover',
      position: 'centre'
    })
    .png()
    .toFile(outputPath);
}

async function main() {
  await ensureDirs();
  await makePng(512, icon512);
  await makePng(192, icon192);
  await makePng(180, appleIcon);
  const icoBuffer = await pngToIco([icon512, icon192]);
  await fs.writeFile(path.join(buildDir, 'icon.ico'), icoBuffer);
  await fs.copyFile(icon512, buildIcon);
  console.log(`Icons generated at ${buildDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
