/**
 * Smoke test: run key services against popular tourist cities
 * Usage: npx tsx src/test-cities.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import { spotifyService } from './services/apis/spotify';
import { restaurantService } from './services/apis/restaurants';
import { eventsService } from './services/apis/events';
import { freeStuffService } from './services/apis/free_stuff';
import { accommodationService } from './services/apis/accommodations';
import { happyHourService } from './services/apis/happy_hours';
import { dealsService } from './services/apis/deals';

const CITIES = [
  'Miami', 'New York', 'Los Angeles', 'Chicago', 'London', 'Paris',
  'Tokyo', 'Barcelona', 'San Francisco', 'Austin', 'Nashville',
  'Seoul', 'Berlin', 'Amsterdam', 'Rome', 'Sydney',
  // Aliases
  'NYC', 'LA', 'SF', 'NOLA',
  // Less common cities (should still work with defaults)
  'Reykjavik', 'Marrakech', 'Cape Town', 'Lisbon',
];

interface TestResult {
  city: string;
  service: string;
  ok: boolean;
  issue?: string;
}

const results: TestResult[] = [];

function check(city: string, service: string, ok: boolean, issue?: string) {
  results.push({ city, service, ok, issue });
  if (!ok) console.log(`  FAIL  ${service}: ${issue}`);
}

async function testCity(city: string) {
  console.log(`\n--- ${city} ---`);

  // Spotify
  try {
    const playlist = await spotifyService.getPlaylist(city);
    const tracks = playlist.data?.tracks || [];
    check(city, 'spotify', playlist.success, !playlist.success ? 'failed' : undefined);
    check(city, 'spotify:trackCount', tracks.length >= 3, `only ${tracks.length} tracks`);
    for (const t of tracks) {
      if (!t.spotifyUrl || !t.spotifyUrl.startsWith('https://open.spotify.com/')) {
        check(city, 'spotify:url', false, `bad URL for "${t.title}": ${t.spotifyUrl}`);
      }
      if ((t as any).youtubeUrl) {
        check(city, 'spotify:noYoutube', false, `youtubeUrl still present on "${t.title}"`);
      }
      if (!t.title || !t.artist) {
        check(city, 'spotify:fields', false, `missing title/artist`);
      }
    }
    if (tracks.length >= 3) check(city, 'spotify:url', true);
    if (!playlist.data?.playlistUrl) {
      check(city, 'spotify:playlistUrl', false, 'missing playlistUrl');
    } else {
      check(city, 'spotify:playlistUrl', true);
    }
  } catch (e: any) {
    check(city, 'spotify', false, e.message);
  }

  // Restaurants
  try {
    const res = await restaurantService.getRestaurants(city);
    const restaurants = res.data || [];
    check(city, 'restaurants', res.success && restaurants.length > 0, `got ${restaurants.length} restaurants`);
    for (const r of restaurants.slice(0, 3)) {
      if (!r.name || r.name.includes('Local Favorite') || r.name.includes('Popular')) {
        check(city, 'restaurants:quality', false, `generic name: "${r.name}"`);
      }
    }
  } catch (e: any) {
    check(city, 'restaurants', false, e.message);
  }

  // Events
  try {
    const res = await eventsService.getEvents(city);
    check(city, 'events', res.success, !res.success ? 'failed' : undefined);
  } catch (e: any) {
    check(city, 'events', false, e.message);
  }

  // Free stuff
  try {
    const res = await freeStuffService.getFreeStuff(city);
    const activities = res.data?.activities || [];
    check(city, 'freeStuff', res.success && activities.length > 0, `got ${activities.length} activities`);
  } catch (e: any) {
    check(city, 'freeStuff', false, e.message);
  }

  // Accommodations
  try {
    const res = await accommodationService.getAccommodations(city);
    const accomms = res.data || [];
    check(city, 'accommodations', res.success && accomms.length > 0, `got ${accomms.length} accommodations`);
    for (const a of accomms.slice(0, 3)) {
      if (!(a as any).url && !(a as any).link) {
        check(city, 'accommodations:links', false, `no url for "${a.name}"`);
      }
    }
  } catch (e: any) {
    check(city, 'accommodations', false, e.message);
  }

  // Happy hours
  try {
    const res = await happyHourService.getHappyHours(city);
    check(city, 'happyHours', res.success, !res.success ? 'failed' : undefined);
  } catch (e: any) {
    check(city, 'happyHours', false, e.message);
  }

  // Deals
  try {
    const res = await dealsService.getDeals(city);
    check(city, 'deals', res.success, !res.success ? 'failed' : undefined);
  } catch (e: any) {
    check(city, 'deals', false, e.message);
  }
}

async function main() {
  console.log(`Testing ${CITIES.length} cities across 7 services...\n`);

  for (const city of CITIES) {
    await testCity(city);
  }

  // Summary
  const fails = results.filter(r => !r.ok);
  console.log('\n' + '='.repeat(60));
  console.log(`RESULTS: ${results.length - fails.length}/${results.length} passed`);

  if (fails.length > 0) {
    console.log(`\nFAILURES (${fails.length}):`);
    for (const f of fails) {
      console.log(`  ${f.city} | ${f.service} | ${f.issue}`);
    }
  } else {
    console.log('\nAll tests passed!');
  }
  console.log('='.repeat(60));
}

main().catch(console.error);
