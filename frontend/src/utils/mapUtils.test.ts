// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  optimizeRoute,
  detectDayCount,
  MARKER_COLORS,
  getGeoCache,
  setGeoCache,
  getCachedGeocode,
  cacheGeocode,
  distanceKm,
  boundingBoxRadiusKm,
  MAX_DISTANCE_KM,
  removeOutliers,
  MapLocation,
} from './mapUtils';

// ── optimizeRoute ────────────────────────────────────────────────────

describe('optimizeRoute', () => {
  it('returns empty array for empty input', () => {
    expect(optimizeRoute([])).toEqual([]);
  });

  it('returns single location as-is', () => {
    const locs: MapLocation[] = [{ name: 'A', lat: 0, lng: 0 }];
    expect(optimizeRoute(locs)).toEqual(locs);
  });

  it('returns two locations as-is', () => {
    const locs: MapLocation[] = [
      { name: 'A', lat: 0, lng: 0 },
      { name: 'B', lat: 1, lng: 1 },
    ];
    expect(optimizeRoute(locs)).toEqual(locs);
  });

  it('always starts with the first location', () => {
    const locs: MapLocation[] = [
      { name: 'Start', lat: 0, lng: 0 },
      { name: 'Far', lat: 10, lng: 10 },
      { name: 'Near', lat: 1, lng: 1 },
    ];
    const result = optimizeRoute(locs);
    expect(result[0].name).toBe('Start');
  });

  it('picks nearest neighbor at each step', () => {
    const locs: MapLocation[] = [
      { name: 'A', lat: 0, lng: 0 },
      { name: 'C', lat: 10, lng: 10 },
      { name: 'B', lat: 1, lng: 1 },
    ];
    const result = optimizeRoute(locs);
    expect(result.map(l => l.name)).toEqual(['A', 'B', 'C']);
  });

  it('does not mutate the input array', () => {
    const locs: MapLocation[] = [
      { name: 'A', lat: 0, lng: 0 },
      { name: 'B', lat: 5, lng: 5 },
      { name: 'C', lat: 1, lng: 1 },
    ];
    const original = locs.map(l => ({ ...l }));
    optimizeRoute(locs);
    expect(locs).toEqual(original);
  });

  it('preserves all locations (no duplicates or losses)', () => {
    const locs: MapLocation[] = [
      { name: 'A', lat: 0, lng: 0 },
      { name: 'B', lat: 3, lng: 4 },
      { name: 'C', lat: 1, lng: 1 },
      { name: 'D', lat: 7, lng: 2 },
      { name: 'E', lat: 2, lng: 5 },
    ];
    const result = optimizeRoute(locs);
    expect(result.length).toBe(5);
    const names = result.map(l => l.name).sort();
    expect(names).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('handles locations at the same coordinates', () => {
    const locs: MapLocation[] = [
      { name: 'A', lat: 1, lng: 1 },
      { name: 'B', lat: 1, lng: 1 },
      { name: 'C', lat: 1, lng: 1 },
    ];
    const result = optimizeRoute(locs);
    expect(result.length).toBe(3);
  });

  it('handles negative coordinates', () => {
    const locs: MapLocation[] = [
      { name: 'A', lat: -33.8, lng: 151.2 },   // Sydney
      { name: 'B', lat: -37.8, lng: 144.9 },   // Melbourne
      { name: 'C', lat: -34.9, lng: 138.6 },   // Adelaide
    ];
    const result = optimizeRoute(locs);
    expect(result.length).toBe(3);
    expect(result[0].name).toBe('A');
  });

  it('produces correct route for a simple linear path', () => {
    // Points in a line: A(0,0), B(1,0), C(2,0), D(3,0) — already optimal
    const locs: MapLocation[] = [
      { name: 'A', lat: 0, lng: 0 },
      { name: 'D', lat: 3, lng: 0 },
      { name: 'B', lat: 1, lng: 0 },
      { name: 'C', lat: 2, lng: 0 },
    ];
    const result = optimizeRoute(locs);
    expect(result.map(l => l.name)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('is idempotent — calling twice gives the same result', () => {
    const locs: MapLocation[] = [
      { name: 'A', lat: 0, lng: 0 },
      { name: 'B', lat: 5, lng: 5 },
      { name: 'C', lat: 1, lng: 1 },
      { name: 'D', lat: 6, lng: 2 },
    ];
    const result1 = optimizeRoute(locs);
    const result2 = optimizeRoute(locs);
    expect(result1).toEqual(result2);
  });
});

// ── detectDayCount ───────────────────────────────────────────────────

describe('detectDayCount', () => {
  it('returns 1 for single-day content (no day headers)', () => {
    const content = `## Morning\nVisit places\n## Evening\nDinner`;
    expect(detectDayCount(content)).toBe(1);
  });

  it('detects 3 days from day headers', () => {
    const content = `
# Day 1 - Monday
## Morning
stuff
# Day 2 - Tuesday
## Morning
stuff
# Day 3 - Wednesday
## Morning
stuff
    `;
    expect(detectDayCount(content)).toBe(3);
  });

  it('detects 7 days', () => {
    const content = Array.from({ length: 7 }, (_, i) =>
      `# Day ${i + 1} - Someday\n## Morning\nstuff`
    ).join('\n');
    expect(detectDayCount(content)).toBe(7);
  });

  it('returns 1 for empty content', () => {
    expect(detectDayCount('')).toBe(1);
  });

  it('ignores ## Day headers (h2 level)', () => {
    const content = '## Day 1\nstuff\n## Day 2\nstuff';
    expect(detectDayCount(content)).toBe(1);
  });

  it('ignores "Day" in body text', () => {
    const content = 'What a beautiful day! Day trips are fun.';
    expect(detectDayCount(content)).toBe(1);
  });
});

// ── MARKER_COLORS ────────────────────────────────────────────────────

describe('MARKER_COLORS', () => {
  it('has 8 colors', () => {
    expect(MARKER_COLORS).toHaveLength(8);
  });

  it('all colors are valid hex strings', () => {
    MARKER_COLORS.forEach(c => {
      expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  it('all colors are unique', () => {
    const unique = new Set(MARKER_COLORS);
    expect(unique.size).toBe(MARKER_COLORS.length);
  });
});

// ── Geocode cache ────────────────────────────────────────────────────

describe('geocode cache', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  it('getGeoCache returns empty object when nothing stored', () => {
    expect(getGeoCache()).toEqual({});
  });

  it('setGeoCache and getGeoCache round-trip', () => {
    const cache = { 'place|||city': { lat: 40.7, lng: -74.0, ts: Date.now() } };
    setGeoCache(cache);
    const result = getGeoCache();
    expect(result['place|||city'].lat).toBe(40.7);
    expect(result['place|||city'].lng).toBe(-74.0);
  });

  it('getCachedGeocode returns null for missing entry', () => {
    expect(getCachedGeocode('Unknown Place', 'Unknown City')).toBeNull();
  });

  it('getCachedGeocode returns coords for cached entry', () => {
    cacheGeocode('Central Park', 'New York', { lat: 40.7829, lng: -73.9654 });
    const result = getCachedGeocode('Central Park', 'New York');
    expect(result).not.toBeNull();
    expect(result!.lat).toBe(40.7829);
    expect(result!.lng).toBe(-73.9654);
  });

  it('getCachedGeocode returns null for expired entry', () => {
    const cache = getGeoCache();
    cache['Old Place|||Old City'] = {
      lat: 0, lng: 0,
      ts: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days ago
    };
    setGeoCache(cache);
    expect(getCachedGeocode('Old Place', 'Old City')).toBeNull();
  });

  it('cacheGeocode evicts old entries when cache exceeds 500', () => {
    const cache: Record<string, { lat: number; lng: number; ts: number }> = {};
    for (let i = 0; i < 501; i++) {
      cache[`place${i}|||city`] = { lat: i, lng: i, ts: i }; // ts=i so oldest first
    }
    setGeoCache(cache);

    // Adding one more triggers eviction
    cacheGeocode('new place', 'city', { lat: 99, lng: 99 });

    const result = getGeoCache();
    const keys = Object.keys(result);
    expect(keys.length).toBeLessThanOrEqual(402); // ~400 kept + 1 new + some tolerance
  });

  it('different places for same city cache independently', () => {
    cacheGeocode('Place A', 'NYC', { lat: 40.7, lng: -74.0 });
    cacheGeocode('Place B', 'NYC', { lat: 40.8, lng: -73.9 });

    const a = getCachedGeocode('Place A', 'NYC');
    const b = getCachedGeocode('Place B', 'NYC');
    expect(a!.lat).toBe(40.7);
    expect(b!.lat).toBe(40.8);
  });

  it('same place in different cities cache independently', () => {
    cacheGeocode('Central Park', 'New York', { lat: 40.78, lng: -73.97 });
    cacheGeocode('Central Park', 'Schenectady', { lat: 42.81, lng: -73.94 });

    const ny = getCachedGeocode('Central Park', 'New York');
    const sc = getCachedGeocode('Central Park', 'Schenectady');
    expect(ny!.lat).toBe(40.78);
    expect(sc!.lat).toBe(42.81);
  });

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('daily_geocache', 'not valid json!!!');
    expect(getGeoCache()).toEqual({});
  });
});

// ── distanceKm ──────────────────────────────────────────────────────

describe('distanceKm', () => {
  it('returns 0 for same point', () => {
    expect(distanceKm(35, 139, 35, 139)).toBe(0);
  });

  it('computes distance between Tokyo and Kyoto (~370 km)', () => {
    const d = distanceKm(35.6762, 139.6503, 35.0116, 135.7681);
    expect(d).toBeGreaterThan(350);
    expect(d).toBeLessThan(400);
  });

  it('computes distance between NYC and London (~5570 km)', () => {
    const d = distanceKm(40.7128, -74.006, 51.5074, -0.1278);
    expect(d).toBeGreaterThan(5500);
    expect(d).toBeLessThan(5700);
  });
});

// ── boundingBoxRadiusKm ─────────────────────────────────────────────

describe('boundingBoxRadiusKm', () => {
  it('returns large radius for Japan bounding box', () => {
    // Japan: [south=20.21, north=45.71, west=122.71, east=154.21]
    const radius = boundingBoxRadiusKm([20.21, 45.71, 122.71, 154.21]);
    expect(radius).toBeGreaterThan(1500); // Japan spans ~3000km+
    expect(radius).toBeLessThan(2500);
  });

  it('returns small radius for city bounding box (Paris)', () => {
    // Paris: roughly [48.81, 48.90, 2.22, 2.47]
    const radius = boundingBoxRadiusKm([48.81, 48.90, 2.22, 2.47]);
    expect(radius).toBeLessThan(20); // Paris is ~10km across
  });

  it('country radius exceeds MAX_DISTANCE_KM', () => {
    const japanRadius = boundingBoxRadiusKm([20.21, 45.71, 122.71, 154.21]);
    expect(japanRadius).toBeGreaterThan(MAX_DISTANCE_KM);
  });

  it('city radius is smaller than MAX_DISTANCE_KM', () => {
    const parisRadius = boundingBoxRadiusKm([48.81, 48.90, 2.22, 2.47]);
    expect(parisRadius).toBeLessThan(MAX_DISTANCE_KM);
  });

  it('effective radius for Japan allows Tokyo-to-Kyoto distance', () => {
    const japanRadius = boundingBoxRadiusKm([20.21, 45.71, 122.71, 154.21]);
    const effectiveRadius = Math.max(japanRadius, MAX_DISTANCE_KM);
    // Tokyo to Kyoto is ~370 km — must be within the effective radius
    const tokyoToKyoto = distanceKm(35.6762, 139.6503, 35.0116, 135.7681);
    expect(tokyoToKyoto).toBeLessThan(effectiveRadius);
  });

  it('effective radius for Japan allows Tokyo-to-Okinawa distance', () => {
    const japanRadius = boundingBoxRadiusKm([20.21, 45.71, 122.71, 154.21]);
    const effectiveRadius = Math.max(japanRadius, MAX_DISTANCE_KM);
    // Japan center to Okinawa is ~1500 km — must be within radius
    const centerToOkinawa = distanceKm(36.57, 139.24, 26.34, 127.77);
    expect(centerToOkinawa).toBeLessThan(effectiveRadius);
  });
});

// ── removeOutliers ────────────────────────────────────────────────────

describe('removeOutliers', () => {
  it('returns all locations when 3 or fewer', () => {
    const locs: MapLocation[] = [
      { name: 'A', lat: 0, lng: 0 },
      { name: 'B', lat: 50, lng: 50 },
    ];
    expect(removeOutliers(locs)).toEqual(locs);
  });

  it('keeps tightly clustered locations', () => {
    const locs: MapLocation[] = [
      { name: 'A', lat: 48.20, lng: 16.37 }, // Vienna
      { name: 'B', lat: 48.21, lng: 16.36 },
      { name: 'C', lat: 48.19, lng: 16.38 },
      { name: 'D', lat: 48.22, lng: 16.35 },
    ];
    expect(removeOutliers(locs)).toHaveLength(4);
  });

  it('removes a single outlier far from the cluster', () => {
    const locs: MapLocation[] = [
      { name: 'Vienna 1', lat: 48.20, lng: 16.37 },
      { name: 'Vienna 2', lat: 48.21, lng: 16.36 },
      { name: 'Vienna 3', lat: 48.19, lng: 16.38 },
      { name: 'Vienna 4', lat: 48.22, lng: 16.35 },
      { name: 'Wrong Hotel', lat: 52.52, lng: 13.40 }, // Berlin — ~500km away
    ];
    const result = removeOutliers(locs);
    expect(result.map(l => l.name)).not.toContain('Wrong Hotel');
    expect(result).toHaveLength(4);
  });

  it('keeps all locations in a multi-city trip spread', () => {
    // Vienna to Salzburg is ~250km — both are legitimate
    const locs: MapLocation[] = [
      { name: 'Vienna 1', lat: 48.20, lng: 16.37 },
      { name: 'Vienna 2', lat: 48.21, lng: 16.36 },
      { name: 'Salzburg 1', lat: 47.80, lng: 13.04 },
      { name: 'Salzburg 2', lat: 47.81, lng: 13.05 },
    ];
    // With 2 cities, the median distance is ~125km, threshold = 4x = 500km
    // Both cities are within 500km of centroid, so all should be kept
    expect(removeOutliers(locs)).toHaveLength(4);
  });

  it('removes outlier even with moderate spread', () => {
    const locs: MapLocation[] = [
      { name: 'A', lat: 48.20, lng: 16.37 },
      { name: 'B', lat: 48.21, lng: 16.36 },
      { name: 'C', lat: 48.19, lng: 16.38 },
      { name: 'D', lat: 48.22, lng: 16.35 },
      { name: 'Outlier', lat: 40.71, lng: -74.01 }, // New York — 7000km away
    ];
    const result = removeOutliers(locs);
    expect(result.map(l => l.name)).not.toContain('Outlier');
  });
});
