/**
 * Production plan generation test — calls streamPlanGeneration directly
 * against the compiled backend code with production env vars.
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load env vars from .env.local or .env.test ──
function loadEnv(filepath) {
  try {
    const content = readFileSync(filepath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      // Strip surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
    console.log(`Loaded env from ${filepath}`);
  } catch (e) {
    console.warn(`Could not load ${filepath}: ${e.message}`);
  }
}

// Try .env.test first, then .env.local
const root = resolve(__dirname, '..');
loadEnv(resolve(root, '.env.test'));
loadEnv(resolve(root, '.env.local'));

// ── Import the compiled service ──
const { streamPlanGeneration } = await import('./dist/services/anthropic.js');

// ── Test cities ──
const PASS_1_CITIES = [
  'New York', 'Tokyo', 'Paris', 'São Paulo', 'Dubai',
  'Sydney', 'Mexico City', 'Istanbul', 'Cape Town', 'Mumbai',
  'Reykjavik', 'Marrakech', 'Buenos Aires', 'Amsterdam', 'Lisbon'
];

const PASS_2_CITIES = [
  'Bangkok', 'Rome', 'Seoul', 'Nairobi', 'Barcelona',
  'Havana', 'Vienna', 'Kyoto', 'Bogotá', 'Prague',
  'Cairo', 'Lima', 'Athens', 'Singapore', 'Zurich'
];

// ── Run a single city test ──
async function testCity(city) {
  const result = {
    city,
    timeMs: 0,
    contentLength: 0,
    hasEvening: false,
    hasNightlife: false,
    hasEstimatedTotal: false,
    hasHotel: false,
    hasBookingLink: false,
    truncated: false,
    error: null,
    chunks: 0,
  };

  const start = Date.now();
  let content = '';

  try {
    const stream = streamPlanGeneration({ city, budget: 'any' });
    for await (const event of stream) {
      if (event.type === 'content_chunk') {
        content += event.content;
        result.chunks++;
      }
    }

    result.timeMs = Date.now() - start;
    result.contentLength = content.length;
    result.hasEvening = /##\s*evening/i.test(content);
    result.hasNightlife = /##\s*nightlife/i.test(content);
    result.hasEstimatedTotal = /##\s*estimated\s*total/i.test(content);
    result.hasHotel = /##\s*your\s*hotel/i.test(content);
    result.hasBookingLink = /booking\.com|hostelworld\.com/i.test(content);
    // Detect truncation: content ends mid-sentence (no period/section at end)
    const trimmed = content.trim();
    result.truncated = trimmed.length > 200 && !trimmed.endsWith('-->') && !trimmed.match(/[.!)\]]\s*$/);
  } catch (err) {
    result.timeMs = Date.now() - start;
    result.error = err.message?.slice(0, 80) || String(err);
  }

  return result;
}

// ── Print summary table ──
function printSummary(results, passLabel) {
  console.log(`\n${'='.repeat(130)}`);
  console.log(`  ${passLabel} RESULTS`);
  console.log('='.repeat(130));
  console.log(
    'City'.padEnd(18) +
    'Time(s)'.padStart(8) +
    'Length'.padStart(8) +
    'Evening'.padStart(9) +
    'Night'.padStart(7) +
    'Total'.padStart(7) +
    'Hotel'.padStart(7) +
    'Book'.padStart(6) +
    'Trunc'.padStart(7) +
    '  Error'
  );
  console.log('-'.repeat(130));

  for (const r of results) {
    const y = 'YES', n = 'NO';
    console.log(
      r.city.padEnd(18) +
      (r.timeMs / 1000).toFixed(1).padStart(8) +
      String(r.contentLength).padStart(8) +
      (r.hasEvening ? y : n).padStart(9) +
      (r.hasNightlife ? y : n).padStart(7) +
      (r.hasEstimatedTotal ? y : n).padStart(7) +
      (r.hasHotel ? y : n).padStart(7) +
      (r.hasBookingLink ? y : n).padStart(6) +
      (r.truncated ? 'TRUNC' : 'ok').padStart(7) +
      '  ' + (r.error || '')
    );
  }

  const ok = results.filter(r => !r.error && r.contentLength > 500);
  const failed = results.filter(r => r.error || r.contentLength <= 500);
  const complete = results.filter(r => r.hasEvening && r.hasNightlife && r.hasEstimatedTotal && r.hasHotel && r.hasBookingLink && !r.truncated);
  const avgTime = ok.reduce((a, r) => a + r.timeMs, 0) / (ok.length || 1);
  const avgLen = ok.reduce((a, r) => a + r.contentLength, 0) / (ok.length || 1);

  console.log('-'.repeat(130));
  console.log(`Generated: ${ok.length}/${results.length} | Complete (all sections): ${complete.length}/${results.length} | Avg time: ${(avgTime / 1000).toFixed(1)}s | Avg length: ${Math.round(avgLen)} chars`);

  const missingNightlife = results.filter(r => !r.error && !r.hasNightlife);
  const missingHotel = results.filter(r => !r.error && !r.hasHotel);
  const missingBooking = results.filter(r => !r.error && !r.hasBookingLink);
  const truncatedList = results.filter(r => !r.error && r.truncated);

  if (missingNightlife.length) console.log(`Missing Nightlife: ${missingNightlife.map(r => r.city).join(', ')}`);
  if (missingHotel.length) console.log(`Missing Hotel: ${missingHotel.map(r => r.city).join(', ')}`);
  if (missingBooking.length) console.log(`Missing Booking Link: ${missingBooking.map(r => r.city).join(', ')}`);
  if (truncatedList.length) console.log(`Truncated: ${truncatedList.map(r => r.city).join(', ')}`);
  if (failed.length) console.log(`FAILED: ${failed.map(r => r.city).join(', ')}`);
}

// ── Main ──
async function main() {
  const globalStart = Date.now();
  const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

  console.log(`Starting plan generation tests at ${new Date().toISOString()}`);
  console.log(`Timeout: 10 minutes\n`);

  // Pass 1
  console.log('── PASS 1: 15 cities ──');
  const pass1Results = [];
  for (const city of PASS_1_CITIES) {
    if (Date.now() - globalStart > TIMEOUT_MS) {
      console.log('Time limit reached, stopping.');
      break;
    }
    console.log(`\nTesting: ${city}...`);
    const result = await testCity(city);
    pass1Results.push(result);
    const status = result.error ? `ERROR: ${result.error}` : `OK (${(result.timeMs / 1000).toFixed(1)}s, ${result.contentLength} chars)`;
    console.log(`  -> ${status}`);
  }
  printSummary(pass1Results, 'PASS 1');

  // Pass 2 if time remains
  const elapsed = Date.now() - globalStart;
  if (elapsed < TIMEOUT_MS - 30_000) {
    console.log(`\n\n── PASS 2: More cities (${Math.round((TIMEOUT_MS - elapsed) / 1000)}s remaining) ──`);
    const pass2Results = [];
    for (const city of PASS_2_CITIES) {
      if (Date.now() - globalStart > TIMEOUT_MS) {
        console.log('Time limit reached, stopping.');
        break;
      }
      console.log(`\nTesting: ${city}...`);
      const result = await testCity(city);
      pass2Results.push(result);
      const status = result.error ? `ERROR: ${result.error}` : `OK (${(result.timeMs / 1000).toFixed(1)}s, ${result.contentLength} chars)`;
      console.log(`  -> ${status}`);
    }
    printSummary(pass2Results, 'PASS 2');

    // Combined summary
    printSummary([...pass1Results, ...pass2Results], 'COMBINED');
  }

  const totalMin = ((Date.now() - globalStart) / 60000).toFixed(1);
  console.log(`\nTotal runtime: ${totalMin} minutes`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
