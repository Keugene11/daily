// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { getSectionPlaces } from './ItineraryDisplay';
import type { PlaceMediaData } from '../hooks/useMediaEnrichment';

describe('getSectionPlaces — basic place matching', () => {
  it('returns places mentioned in section text', () => {
    const text = 'Visit Half Dome in the morning, then Glacier Point';
    const allPlaces = ['Half Dome', 'Glacier Point', 'El Capitan'];
    const shownSet = new Set<string>();
    const result = getSectionPlaces(text, allPlaces, shownSet);
    expect(result).toEqual(['Half Dome', 'Glacier Point']);
  });

  it('skips places not in the text', () => {
    const text = 'Visit Half Dome in the morning';
    const allPlaces = ['Half Dome', 'El Capitan'];
    const shownSet = new Set<string>();
    const result = getSectionPlaces(text, allPlaces, shownSet);
    expect(result).toEqual(['Half Dome']);
  });

  it('skips already-shown places', () => {
    const text = 'Visit Half Dome and Glacier Point';
    const allPlaces = ['Half Dome', 'Glacier Point'];
    const shownSet = new Set(['Half Dome']);
    const result = getSectionPlaces(text, allPlaces, shownSet);
    expect(result).toEqual(['Glacier Point']);
  });

  it('is case-insensitive for text matching', () => {
    const text = 'visit half dome in the MORNING';
    const allPlaces = ['Half Dome'];
    const shownSet = new Set<string>();
    const result = getSectionPlaces(text, allPlaces, shownSet);
    expect(result).toEqual(['Half Dome']);
  });

  it('marks returned places as shown', () => {
    const text = 'Visit Half Dome';
    const allPlaces = ['Half Dome'];
    const shownSet = new Set<string>();
    getSectionPlaces(text, allPlaces, shownSet);
    expect(shownSet.has('Half Dome')).toBe(true);
  });
});

describe('getSectionPlaces — videoId deduplication', () => {
  it('skips place with duplicate videoId', () => {
    const allPlaces = ['Half Dome', 'Glacier Point'];
    const mediaData = new Map<string, PlaceMediaData>([
      ['Half Dome', { videoId: 'abc123', imageUrl: 'img1.jpg' }],
      ['Glacier Point', { videoId: 'abc123', imageUrl: 'img2.jpg' }],
    ]);
    const shownSet = new Set<string>();
    const shownVideoIds = new Set<string>();

    // Section 1: Half Dome gets the video
    const section1 = 'Visit Half Dome for sunrise';
    const result1 = getSectionPlaces(section1, allPlaces, shownSet, mediaData, shownVideoIds);
    expect(result1).toEqual(['Half Dome']);

    // Section 2: Glacier Point has same videoId — should be skipped
    const section2 = 'Head to Glacier Point for sunset';
    const result2 = getSectionPlaces(section2, allPlaces, shownSet, mediaData, shownVideoIds);
    expect(result2).toEqual([]);
  });

  it('allows places with different videoIds', () => {
    const allPlaces = ['Half Dome', 'El Capitan'];
    const mediaData = new Map<string, PlaceMediaData>([
      ['Half Dome', { videoId: 'abc123' }],
      ['El Capitan', { videoId: 'def456' }],
    ]);
    const shownSet = new Set<string>();
    const shownVideoIds = new Set<string>();

    const text = 'Visit Half Dome and El Capitan';
    const result = getSectionPlaces(text, allPlaces, shownSet, mediaData, shownVideoIds);
    expect(result).toEqual(['Half Dome', 'El Capitan']);
  });

  it('allows place without videoId even if another has duplicate', () => {
    const allPlaces = ['Half Dome', 'Glacier Point', 'Yosemite Lodge'];
    const mediaData = new Map<string, PlaceMediaData>([
      ['Half Dome', { videoId: 'abc123' }],
      ['Glacier Point', { videoId: 'abc123' }],
      ['Yosemite Lodge', { imageUrl: 'lodge.jpg' }], // no videoId
    ]);
    const shownSet = new Set<string>();
    const shownVideoIds = new Set<string>();

    const text = 'Visit Half Dome, Glacier Point, and Yosemite Lodge';
    const result = getSectionPlaces(text, allPlaces, shownSet, mediaData, shownVideoIds);
    // Half Dome: included (first with videoId abc123)
    // Glacier Point: skipped (duplicate videoId)
    // Yosemite Lodge: included (no videoId, just image)
    expect(result).toEqual(['Half Dome', 'Yosemite Lodge']);
  });

  it('marks skipped-duplicate places as shown (prevents later appearance)', () => {
    const allPlaces = ['Half Dome', 'Glacier Point'];
    const mediaData = new Map<string, PlaceMediaData>([
      ['Half Dome', { videoId: 'abc123' }],
      ['Glacier Point', { videoId: 'abc123' }],
    ]);
    const shownSet = new Set<string>();
    const shownVideoIds = new Set<string>();

    const text = 'Visit Half Dome and Glacier Point';
    getSectionPlaces(text, allPlaces, shownSet, mediaData, shownVideoIds);
    // Glacier Point should be in shownSet even though it was skipped
    expect(shownSet.has('Glacier Point')).toBe(true);
  });

  it('deduplicates same videoId across three sections', () => {
    const allPlaces = ['Place A', 'Place B', 'Place C'];
    const mediaData = new Map<string, PlaceMediaData>([
      ['Place A', { videoId: 'same_vid' }],
      ['Place B', { videoId: 'same_vid' }],
      ['Place C', { videoId: 'same_vid' }],
    ]);
    const shownSet = new Set<string>();
    const shownVideoIds = new Set<string>();

    const r1 = getSectionPlaces('Visit Place A', allPlaces, shownSet, mediaData, shownVideoIds);
    const r2 = getSectionPlaces('Visit Place B', allPlaces, shownSet, mediaData, shownVideoIds);
    const r3 = getSectionPlaces('Visit Place C', allPlaces, shownSet, mediaData, shownVideoIds);

    expect(r1).toEqual(['Place A']);
    expect(r2).toEqual([]);
    expect(r3).toEqual([]);
  });

  it('works without mediaData (backwards compatible)', () => {
    const text = 'Visit Half Dome';
    const allPlaces = ['Half Dome'];
    const shownSet = new Set<string>();
    // No mediaData or shownVideoIds passed
    const result = getSectionPlaces(text, allPlaces, shownSet);
    expect(result).toEqual(['Half Dome']);
  });
});
