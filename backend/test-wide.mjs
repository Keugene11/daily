/**
 * Wide plan generation test — tests 12 diverse cities against the local backend.
 *
 * Usage: node test-wide.mjs
 *
 * Calls streamPlanGeneration directly (bypasses HTTP auth/usage middleware).
 * Validates each plan completes with expected sections, within time limits.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env vars from parent .env.local (where the keys live)
dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '.env') });

// Import compiled backend service
const { streamPlanGeneration } = await import('./dist/services/anthropic.js');

const CITIES = [
  'New York',
  'Tokyo',
  'Paris',
  'São Paulo',
  'Dubai',
  'Sydney',
  'Mexico City',
  'Istanbul',
  'Cape Town',
  'Mumbai',
  'Reykjavik',
  'Marrakech',
];

const TIMEOUT_MS = 60_000; // 60s Vercel limit

// Sections we expect in a complete plan
const REQUIRED_MARKERS = [
  { name: 'Evening', pattern: /evening/i },
  { name: 'Estimated Total', pattern: /estimated\s+total/i },
  { name: 'Hotel/Hostel', pattern: /hotel|hostel|where\s+to\s+stay|accommodation/i },
];

function formatDuration(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

async function testCity(city) {
  const result = {
    city,
    status: 'UNKNOWN',
    duration: 0,
    contentLength: 0,
    sections: {},
    errors: [],
    eventCounts: {},
  };

  const startTime = Date.now();
  let fullContent = '';
  let timedOut = false;

  try {
    const stream = streamPlanGeneration({ city, budget: 'moderate' });

    const timeout = setTimeout(() => {
      timedOut = true;
    }, TIMEOUT_MS);

    for await (const event of stream) {
      if (timedOut) {
        result.errors.push(`TIMEOUT: exceeded ${TIMEOUT_MS / 1000}s`);
        break;
      }

      // Count event types
      result.eventCounts[event.type] = (result.eventCounts[event.type] || 0) + 1;

      if (event.type === 'content_chunk' && event.content) {
        fullContent += event.content;
      }

      if (event.type === 'error') {
        result.errors.push(`Stream error: ${event.error}`);
        break;
      }
    }

    clearTimeout(timeout);
  } catch (err) {
    result.errors.push(`Exception: ${err.message}`);
  }

  result.duration = Date.now() - startTime;
  result.contentLength = fullContent.length;

  // Check required sections
  for (const marker of REQUIRED_MARKERS) {
    result.sections[marker.name] = marker.pattern.test(fullContent);
  }

  const allSectionsPresent = Object.values(result.sections).every(Boolean);
  const withinTime = result.duration < TIMEOUT_MS;
  const noErrors = result.errors.length === 0;

  if (allSectionsPresent && withinTime && noErrors) {
    result.status = 'PASS';
  } else if (result.errors.length > 0) {
    result.status = 'ERROR';
  } else if (!withinTime) {
    result.status = 'TIMEOUT';
  } else {
    result.status = 'INCOMPLETE';
  }

  return result;
}

// ── Main ─────────────────────────────────────────────────────────────────

console.log('='.repeat(80));
console.log('WIDE PLAN GENERATION TEST');
console.log(`Testing ${CITIES.length} cities | Timeout: ${TIMEOUT_MS / 1000}s each`);
console.log(`Started: ${new Date().toLocaleTimeString()}`);
console.log('='.repeat(80));
console.log('');

const results = [];
let passCount = 0;
let failCount = 0;

for (const city of CITIES) {
  process.stdout.write(`[${results.length + 1}/${CITIES.length}] ${city.padEnd(16)} ... `);
  const result = await testCity(city);
  results.push(result);

  const statusIcon = result.status === 'PASS' ? 'OK' : 'FAIL';
  if (result.status === 'PASS') passCount++;
  else failCount++;

  const missingSections = Object.entries(result.sections)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  let detail = `${statusIcon}  ${formatDuration(result.duration).padStart(6)}  ${(result.contentLength + ' chars').padStart(12)}`;
  if (missingSections.length > 0) {
    detail += `  Missing: [${missingSections.join(', ')}]`;
  }
  if (result.errors.length > 0) {
    detail += `  Errors: ${result.errors.join('; ')}`;
  }

  console.log(detail);
}

// ── Summary ──────────────────────────────────────────────────────────────

console.log('');
console.log('='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));

const totalTime = results.reduce((sum, r) => sum + r.duration, 0);
const avgTime = totalTime / results.length;
const maxResult = results.reduce((a, b) => (a.duration > b.duration ? a : b));
const minResult = results.reduce((a, b) => (a.duration < b.duration ? a : b));

console.log(`  Passed:     ${passCount}/${CITIES.length}`);
console.log(`  Failed:     ${failCount}/${CITIES.length}`);
console.log(`  Avg time:   ${formatDuration(avgTime)}`);
console.log(`  Fastest:    ${minResult.city} (${formatDuration(minResult.duration)})`);
console.log(`  Slowest:    ${maxResult.city} (${formatDuration(maxResult.duration)})`);
console.log(`  Total time: ${formatDuration(totalTime)}`);
console.log('');

// Detailed table
console.log('City'.padEnd(18) + 'Status'.padEnd(12) + 'Time'.padEnd(10) + 'Length'.padEnd(12) + 'Evening'.padEnd(10) + 'Est.Total'.padEnd(12) + 'Hotel'.padEnd(8));
console.log('-'.repeat(80));
for (const r of results) {
  const row = [
    r.city.padEnd(18),
    r.status.padEnd(12),
    formatDuration(r.duration).padStart(7).padEnd(10),
    (r.contentLength + '').padStart(7).padEnd(12),
    (r.sections['Evening'] ? 'Yes' : 'NO').padEnd(10),
    (r.sections['Estimated Total'] ? 'Yes' : 'NO').padEnd(12),
    (r.sections['Hotel/Hostel'] ? 'Yes' : 'NO').padEnd(8),
  ];
  console.log(row.join(''));
}
console.log('');

if (failCount > 0) {
  console.log('FAILURES:');
  for (const r of results.filter(r => r.status !== 'PASS')) {
    console.log(`  ${r.city}: ${r.status}`);
    if (r.errors.length) console.log(`    Errors: ${r.errors.join('; ')}`);
    const missing = Object.entries(r.sections).filter(([, v]) => !v).map(([k]) => k);
    if (missing.length) console.log(`    Missing sections: ${missing.join(', ')}`);
  }
}

process.exit(failCount > 0 ? 1 : 0);
