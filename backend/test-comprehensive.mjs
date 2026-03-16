import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

// ── Load env vars from ../.env.test ──
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.test');
const envContent = readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
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
  if (!process.env[key]) {
    process.env[key] = val;
  }
}

// ── Import streamPlanGeneration (CJS module) ──
const require = createRequire(import.meta.url);
const { streamPlanGeneration } = require('./dist/services/anthropic.js');

// ── Test config ──
const cities = ['London', 'Bangkok', 'Miami', 'Seoul', 'Barcelona'];
const results = [];

async function testCity(city) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${city}`);
  console.log('='.repeat(60));

  const request = {
    city,
    days: 1,
    budget: 'any',
  };

  const startTime = Date.now();
  let fullContent = '';
  let errorOccurred = null;
  let chunkCount = 0;
  let toolCalls = [];
  let thinkingChunks = [];

  try {
    for await (const event of streamPlanGeneration(request)) {
      if (event.type === 'content_chunk') {
        fullContent += event.content;
        chunkCount++;
      } else if (event.type === 'error') {
        errorOccurred = event.error;
        console.error(`  ERROR: ${event.error}`);
      } else if (event.type === 'tool_call_start') {
        toolCalls.push(event.tool);
      } else if (event.type === 'thinking_chunk') {
        thinkingChunks.push(event.thinking);
      } else if (event.type === 'city_resolved') {
        console.log(`  City resolved to: ${event.content}`);
      }
    }
  } catch (err) {
    errorOccurred = err.message;
    console.error(`  EXCEPTION: ${err.message}`);
  }

  const elapsedMs = Date.now() - startTime;
  const elapsedSec = (elapsedMs / 1000).toFixed(1);

  // ── Checks ──
  const hasEvening = /evening/i.test(fullContent);
  const hasEstimatedTotal = /estimated total/i.test(fullContent);
  const hasHotel = /hotel|hostel|accommodation|your hotel/i.test(fullContent);
  const hasProTips = /pro tips/i.test(fullContent);

  // Check for mid-sentence truncation
  const trimmedContent = fullContent.trimEnd();
  const lastChar = trimmedContent.slice(-1);
  const validEndings = ['.', ')', ']', '!', '?', '*', '-', ':', '\n', '`'];
  const endedMidSentence = trimmedContent.length > 0 && !validEndings.includes(lastChar);

  // Count sections (## headers)
  const sectionHeaders = (fullContent.match(/^## .+/gm) || []);

  const result = {
    city,
    elapsed: `${elapsedSec}s`,
    elapsedMs,
    contentLength: fullContent.length,
    chunks: chunkCount,
    tools: toolCalls.join(', '),
    sections: sectionHeaders.length,
    sectionNames: sectionHeaders.map(h => h.replace('## ', '')),
    hasEvening,
    hasEstimatedTotal,
    hasHotel,
    hasProTips,
    endedMidSentence,
    lastChars: trimmedContent.slice(-50),
    error: errorOccurred,
  };

  results.push(result);

  console.log(`  Time: ${elapsedSec}s | Content: ${fullContent.length} chars | Chunks: ${chunkCount}`);
  console.log(`  Tools: ${toolCalls.join(', ')}`);
  console.log(`  Sections (${sectionHeaders.length}): ${sectionHeaders.map(h => h.replace('## ', '')).join(' | ')}`);
  console.log(`  Evening: ${hasEvening} | Est. Total: ${hasEstimatedTotal} | Hotel: ${hasHotel} | Pro Tips: ${hasProTips}`);
  console.log(`  Mid-sentence truncation: ${endedMidSentence} (last char: "${lastChar}")`);
  if (errorOccurred) console.log(`  ERROR: ${errorOccurred}`);

  return result;
}

// ── Run tests sequentially ──
console.log('Starting comprehensive plan generation tests...');
console.log(`Cities: ${cities.join(', ')}`);

for (const city of cities) {
  await testCity(city);
}

// ── Summary Table ──
console.log(`\n\n${'='.repeat(80)}`);
console.log('SUMMARY');
console.log('='.repeat(80));
console.log(
  'City'.padEnd(15) +
  'Time'.padEnd(10) +
  'Chars'.padEnd(10) +
  'Sections'.padEnd(10) +
  'Evening'.padEnd(10) +
  'Total'.padEnd(10) +
  'Hotel'.padEnd(10) +
  'Tips'.padEnd(10) +
  'Truncated'.padEnd(12) +
  'Error'
);
console.log('-'.repeat(107));

for (const r of results) {
  console.log(
    r.city.padEnd(15) +
    r.elapsed.padEnd(10) +
    String(r.contentLength).padEnd(10) +
    String(r.sections).padEnd(10) +
    String(r.hasEvening).padEnd(10) +
    String(r.hasEstimatedTotal).padEnd(10) +
    String(r.hasHotel).padEnd(10) +
    String(r.hasProTips).padEnd(10) +
    String(r.endedMidSentence).padEnd(12) +
    (r.error || 'none')
  );
}

console.log('-'.repeat(107));

// ── Flag issues ──
const issues = [];
for (const r of results) {
  if (r.error) issues.push(`${r.city}: Error — ${r.error}`);
  if (r.endedMidSentence) issues.push(`${r.city}: Ended mid-sentence (last chars: "...${r.lastChars}")`);
  if (!r.hasEvening) issues.push(`${r.city}: Missing Evening section`);
  if (!r.hasEstimatedTotal) issues.push(`${r.city}: Missing Estimated Total`);
  if (!r.hasHotel) issues.push(`${r.city}: Missing Hotel section`);
  if (!r.hasProTips) issues.push(`${r.city}: Missing Pro Tips`);
  if (r.elapsedMs > 55000) issues.push(`${r.city}: Near timeout (${r.elapsed})`);
}

if (issues.length > 0) {
  console.log(`\nISSUES FOUND (${issues.length}):`);
  for (const issue of issues) {
    console.log(`  - ${issue}`);
  }
} else {
  console.log('\nNo issues found! All plans generated successfully.');
}
