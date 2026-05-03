#!/usr/bin/env node
/**
 * trim-health-export.mjs
 *
 * Strips an Apple Health export.zip down to just the workout data.
 * The full export is mostly heart rate / step count / sleep records
 * — none of which TrailTracker uses. Trimming locally before upload
 * avoids the browser memory issues that kill large imports.
 *
 * Usage:
 *   npm run trim-export -- ~/Downloads/export.zip
 *   # or
 *   node tools/trim-health-export.mjs ~/Downloads/export.zip
 *
 * Output: <input>-workouts.zip in the same folder, typically 5–10 MB
 *         (down from 100s of MB).
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node tools/trim-health-export.mjs <path-to-export.zip>');
  process.exit(1);
}

const outputPath = inputPath.replace(/\.zip$/i, '') + '-workouts.zip';

console.log(`Reading ${inputPath}…`);
const inputBuffer = await readFile(inputPath);
const inputMB = inputBuffer.length / 1e6;
console.log(`  ${inputMB.toFixed(1)} MB loaded`);

console.log('Opening zip…');
const zip = await JSZip.loadAsync(inputBuffer);

const xmlFile = zip.file(/export\.xml$/i)[0];
if (!xmlFile) {
  console.error('No export.xml found in zip — is this an Apple Health export?');
  process.exit(1);
}

console.log('Reading export.xml…');
const xml = await xmlFile.async('string');
console.log(`  ${(xml.length / 1e6).toFixed(1)} MB of XML`);

console.log('Extracting <Workout> blocks…');
const blocks = [];
let cursor = 0;
while (true) {
  const open = xml.indexOf('<Workout ', cursor);
  if (open === -1) break;
  const tagClose = xml.indexOf('>', open);
  if (tagClose === -1) break;
  if (xml[tagClose - 1] === '/') {
    blocks.push(xml.slice(open, tagClose + 1));
    cursor = tagClose + 1;
  } else {
    const close = xml.indexOf('</Workout>', tagClose);
    if (close === -1) break;
    blocks.push(xml.slice(open, close + '</Workout>'.length));
    cursor = close + '</Workout>'.length;
  }
}
console.log(`  ${blocks.length} workouts found`);

const trimmedXml =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<HealthData locale="en_US">\n' +
  blocks.join('\n') +
  '\n</HealthData>\n';

const out = new JSZip();
out.file('apple_health_export/export.xml', trimmedXml);

const gpxFiles = zip.file(/workout-routes\/.*\.gpx$/i);
console.log(`Copying ${gpxFiles.length} GPS route files…`);
for (let i = 0; i < gpxFiles.length; i++) {
  const f = gpxFiles[i];
  const content = await f.async('uint8array');
  out.file(f.name, content);
  if ((i + 1) % 50 === 0) {
    process.stdout.write(`  ${i + 1}/${gpxFiles.length}\r`);
  }
}
if (gpxFiles.length > 0) console.log(`  ${gpxFiles.length}/${gpxFiles.length}`);

console.log('Building output zip…');
const outBuffer = await out.generateAsync({
  type: 'nodebuffer',
  compression: 'DEFLATE',
  compressionOptions: { level: 6 },
});

await writeFile(outputPath, outBuffer);
const outMB = outBuffer.length / 1e6;
const reduction = ((1 - outBuffer.length / inputBuffer.length) * 100).toFixed(1);

console.log('');
console.log(`✓ Wrote ${path.basename(outputPath)}`);
console.log(`  ${outMB.toFixed(1)} MB  (${reduction}% smaller than input)`);
console.log(`  ${blocks.length} workouts · ${gpxFiles.length} GPS tracks`);
console.log('');
console.log(`Now upload ${path.basename(outputPath)} via the /import page.`);
