import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnv(fp) {
  try {
    for (const line of readFileSync(fp, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      let v = t.slice(eq + 1).trim();
      if ((v[0] === '"' && v.at(-1) === '"') || (v[0] === "'" && v.at(-1) === "'")) v = v.slice(1, -1);
      process.env[t.slice(0, eq).trim()] = v;
    }
  } catch {}
}
loadEnv(resolve(root, '.env.test'));
loadEnv(resolve(root, '.env.local'));

const { streamPlanGeneration } = await import('./dist/services/anthropic.js');

const cities = ['New York', 'Tokyo', 'London', 'Bangkok', 'Berlin'];

for (const city of cities) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing: ${city}`);
  console.log('='.repeat(80));

  let content = '';
  const start = Date.now();

  const stream = streamPlanGeneration({ city, budget: 'any' });
  for await (const event of stream) {
    if (event.type === 'content_chunk') content += event.content;
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  // Extract hotel section
  const hotelMatch = content.match(/##\s*Your Hotel[\s\S]*?(?=\n##\s|<!-- CALENDAR|$)/i);
  console.log('\n--- HOTEL SECTION ---');
  console.log(hotelMatch ? hotelMatch[0].trim().slice(0, 500) : 'NOT FOUND');

  // Find all URLs in the hotel section
  if (hotelMatch) {
    const urls = hotelMatch[0].match(/\(https?:\/\/[^)]+\)/g) || [];
    console.log('\n--- URLS IN HOTEL ---');
    urls.forEach(u => console.log('  ' + u));
    const hasBooking = urls.some(u => /booking\.com|hostelworld\.com/i.test(u));
    const hasMaps = urls.some(u => /google\.com\/maps|maps\.google/i.test(u));
    console.log(`  Booking link: ${hasBooking ? 'YES' : 'NO'}`);
    console.log(`  Maps link: ${hasMaps ? 'YES' : 'NO'}`);
  }

  // Check sections present
  console.log('\n--- SECTIONS ---');
  console.log(`  Evening:    ${/##\s*evening/i.test(content) ? 'YES' : 'NO'}`);
  console.log(`  Nightlife:  ${/##\s*nightlife/i.test(content) ? 'YES' : 'NO'}`);
  console.log(`  Est Total:  ${/##\s*estimated\s*total/i.test(content) ? 'YES' : 'NO'}`);
  console.log(`  Your Hotel: ${/##\s*your\s*hotel/i.test(content) ? 'YES' : 'NO'}`);
  console.log(`  Calendar:   ${/CALENDAR_EVENTS/i.test(content) ? 'YES' : 'NO'}`);
  console.log(`  Length: ${content.length} chars | Time: ${elapsed}s`);

  // Check if truncated
  const trimmed = content.trim();
  const endsClean = trimmed.endsWith('-->') || /[.!)\]]\s*$/.test(trimmed);
  if (!endsClean) {
    console.log(`  *** TRUNCATED — ends with: ${JSON.stringify(trimmed.slice(-80))}`);
  }
}
