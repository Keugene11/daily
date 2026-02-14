import { describe, it, expect } from 'vitest';
import { extractPlaces } from './extractPlaces';

// ── Google Maps link extraction ──────────────────────────────────────

describe('extractPlaces — Google Maps links', () => {
  it('extracts place from maps.google.com?q= link', () => {
    const content = 'Visit [Central Park](https://maps.google.com/?q=Central+Park,+New+York)';
    const places = extractPlaces(content, 'New York');
    expect(places).toContain('Central Park');
  });

  it('extracts multiple places from different maps links', () => {
    const content = `
Visit [Central Park](https://maps.google.com/?q=Central+Park,+New+York)
then go to [Times Square](https://maps.google.com/?q=Times+Square,+New+York)
    `;
    const places = extractPlaces(content, 'New York');
    expect(places).toContain('Central Park');
    expect(places).toContain('Times Square');
  });

  it('decodes URL-encoded place names', () => {
    const content = 'Check out [Griffith Observatory](https://maps.google.com/?q=Griffith%20Observatory)';
    const places = extractPlaces(content, 'Los Angeles');
    expect(places).toContain('Griffith Observatory');
  });

  it('strips city suffix from maps query', () => {
    const content = 'Visit [MoMA](https://maps.google.com/?q=MoMA,+New+York)';
    const places = extractPlaces(content, 'New York');
    // Should extract "MoMA" (before the comma)
    expect(places).toContain('MoMA');
  });
});

// ── Markdown link extraction ─────────────────────────────────────────

describe('extractPlaces — markdown links', () => {
  it('extracts place name from markdown link text', () => {
    const content = 'Head to [Joe\'s Pizza](https://maps.google.com/?q=Joe%27s+Pizza)';
    const places = extractPlaces(content, 'New York');
    expect(places).toContain("Joe's Pizza");
  });

  it('skips generic link labels', () => {
    const content = `
[Open in Spotify](https://spotify.com/playlist/123)
[View on Maps](https://maps.google.com)
[Reserve on OpenTable](https://opentable.com)
[Watch on YouTube](https://youtube.com/watch?v=123)
    `;
    const places = extractPlaces(content, 'New York');
    expect(places).toHaveLength(0);
  });

  it('skips Spotify track links', () => {
    const content = '[Autumn in New York - Billie Holiday](https://open.spotify.com/track/123)';
    const places = extractPlaces(content, 'New York');
    expect(places).not.toContain('Autumn in New York - Billie Holiday');
  });

  it('skips Yelp review links', () => {
    const content = '[Best Pizza NYC](https://yelp.com/biz/best-pizza-nyc)';
    const places = extractPlaces(content, 'New York');
    expect(places).not.toContain('Best Pizza NYC');
  });
});

// ── Bold text extraction ─────────────────────────────────────────────

describe('extractPlaces — bold text', () => {
  it('extracts bold venue names', () => {
    const content = 'Grab a slice at **Di Fara Pizza** in Midwood';
    const places = extractPlaces(content, 'New York');
    expect(places).toContain('Di Fara Pizza');
  });

  it('skips bold "Pro Tip" text', () => {
    const content = '**Pro Tip**: Arrive early to beat the line';
    const places = extractPlaces(content, 'New York');
    expect(places).not.toContain('Pro Tip');
  });

  it('skips bold "Deal" text', () => {
    const content = '**Deal**: 50% off after 5pm';
    const places = extractPlaces(content, 'New York');
    expect(places).not.toContain('Deal');
  });

  it('skips bold "Free" text', () => {
    const content = '**Free** admission on Fridays';
    const places = extractPlaces(content, 'New York');
    expect(places).not.toContain('Free');
  });
});

// ── Section filtering ────────────────────────────────────────────────

describe('extractPlaces — section filtering', () => {
  it('excludes places from Soundtrack section', () => {
    const content = `
## Morning
Visit [Central Park](https://maps.google.com/?q=Central+Park)

## Soundtrack
[Empire State of Mind - Jay-Z](https://open.spotify.com/track/123)
[New York, New York - Frank Sinatra](https://open.spotify.com/track/456)
    `;
    const places = extractPlaces(content, 'New York');
    expect(places).toContain('Central Park');
    expect(places).not.toContain('Empire State of Mind - Jay-Z');
    expect(places).not.toContain('New York, New York - Frank Sinatra');
  });

  it('includes places from Where to Stay section', () => {
    const content = `
## Morning
Visit [Central Park](https://maps.google.com/?q=Central+Park)

## Where to Stay
[The Jane Hotel](https://maps.google.com/?q=The+Jane+Hotel,+New+York)
    `;
    const places = extractPlaces(content, 'New York');
    expect(places).toContain('Central Park');
    expect(places).toContain('The Jane Hotel');
  });
});

// ── Name filtering ───────────────────────────────────────────────────

describe('extractPlaces — name filtering', () => {
  it('filters out the city name itself', () => {
    const content = 'Welcome to **New York**, the city that never sleeps!';
    const places = extractPlaces(content, 'New York');
    expect(places).not.toContain('New York');
  });

  it('filters section headings', () => {
    const content = `
**Morning** activities:
**Afternoon** plans:
**Evening** fun:
Visit [Real Place](https://maps.google.com/?q=Real+Place)
    `;
    const places = extractPlaces(content, 'New York');
    expect(places).not.toContain('Morning');
    expect(places).not.toContain('Afternoon');
    expect(places).not.toContain('Evening');
    expect(places).toContain('Real Place');
  });

  it('filters entries starting with digits (time strings)', () => {
    const content = '**8:00 AM** is the best time to visit [Central Park](https://maps.google.com/?q=Central+Park)';
    const places = extractPlaces(content, 'New York');
    expect(places).not.toContain('8:00 AM');
    expect(places).toContain('Central Park');
  });

  it('filters temperature mentions', () => {
    const content = '**72°F** and sunny today! Visit [Bryant Park](https://maps.google.com/?q=Bryant+Park)';
    const places = extractPlaces(content, 'New York');
    expect(places).not.toContain('72°F');
    expect(places).toContain('Bryant Park');
  });

  it('filters very short names (2 chars or less)', () => {
    const content = '**NY** is great. Visit [MoMA](https://maps.google.com/?q=MoMA)';
    const places = extractPlaces(content, 'New York');
    expect(places).not.toContain('NY');
  });

  it('filters very long names (60+ chars)', () => {
    const longName = 'A'.repeat(61);
    const content = `**${longName}** is a place. Visit [Central Park](https://maps.google.com/?q=Central+Park)`;
    const places = extractPlaces(content, 'New York');
    expect(places).not.toContain(longName);
    expect(places).toContain('Central Park');
  });

  it('filters song titles with dashes', () => {
    const content = '**Empire State of Mind - Jay-Z** playing in the background';
    const places = extractPlaces(content, 'New York');
    expect(places).not.toContain('Empire State of Mind - Jay-Z');
  });
});

// ── Deduplication ────────────────────────────────────────────────────

describe('extractPlaces — deduplication', () => {
  it('removes duplicate place names', () => {
    const content = `
Visit [Central Park](https://maps.google.com/?q=Central+Park) in the morning.
Come back to [Central Park](https://maps.google.com/?q=Central+Park) in the afternoon.
    `;
    const places = extractPlaces(content, 'New York');
    const centralParkCount = places.filter(p => p === 'Central Park').length;
    expect(centralParkCount).toBe(1);
  });
});

// ── Limit and accommodation priority ─────────────────────────────────

describe('extractPlaces — limits and accommodation priority', () => {
  it('respects maxResults parameter', () => {
    const content = Array.from({ length: 20 }, (_, i) =>
      `[Place ${String.fromCharCode(65 + i)}](https://maps.google.com/?q=Place+${String.fromCharCode(65 + i)})`
    ).join('\n');
    const places = extractPlaces(content, 'New York', 5);
    expect(places.length).toBeLessThanOrEqual(9); // 5 + up to 4 stay reserve
  });

  it('reserves slots for accommodations', () => {
    const itinerary = Array.from({ length: 15 }, (_, i) =>
      `[Restaurant ${String.fromCharCode(65 + i)}](https://maps.google.com/?q=Restaurant+${String.fromCharCode(65 + i)})`
    ).join('\n');
    const staySection = `
## Where to Stay
[Hotel Alpha](https://maps.google.com/?q=Hotel+Alpha)
[Hotel Beta](https://maps.google.com/?q=Hotel+Beta)
    `;
    const content = itinerary + '\n' + staySection;
    const places = extractPlaces(content, 'New York', 10);
    expect(places).toContain('Hotel Alpha');
    expect(places).toContain('Hotel Beta');
  });
});

// ── Edge cases ───────────────────────────────────────────────────────

describe('extractPlaces — edge cases', () => {
  it('handles empty content', () => {
    const places = extractPlaces('', 'New York');
    expect(places).toEqual([]);
  });

  it('handles content with no venues', () => {
    const places = extractPlaces('Just a nice day in the city.', 'New York');
    expect(places).toEqual([]);
  });

  it('handles content with only Soundtrack section', () => {
    const content = `## Soundtrack
[Song](https://spotify.com/track/123)`;
    const places = extractPlaces(content, 'New York');
    expect(places).toEqual([]);
  });

  it('handles special characters in place names', () => {
    const content = "[Café de Flore](https://maps.google.com/?q=Caf%C3%A9+de+Flore)";
    const places = extractPlaces(content, 'Paris');
    expect(places.length).toBeGreaterThan(0);
  });

  it('handles city name case-insensitively', () => {
    const content = '**new york** is amazing. Visit [MoMA](https://maps.google.com/?q=MoMA)';
    const places = extractPlaces(content, 'New York');
    expect(places).not.toContain('new york');
  });

  it('handles multi-day plan content', () => {
    const content = `
# Day 1 - Monday
## Morning
Visit [Place A](https://maps.google.com/?q=Place+A)
# Day 2 - Tuesday
## Morning
Visit [Place B](https://maps.google.com/?q=Place+B)
    `;
    const places = extractPlaces(content, 'New York', 20);
    expect(places).toContain('Place A');
    expect(places).toContain('Place B');
  });
});

// ── Real-world content patterns ──────────────────────────────────────

describe('extractPlaces — real-world patterns', () => {
  it('extracts from typical itinerary', () => {
    const content = `## Morning (8am - 12pm)
Start your day at [Russ & Daughters](https://maps.google.com/?q=Russ+%26+Daughters,+New+York) for the best bagels in the city.

## Afternoon (12pm - 6pm)
Head to the [Metropolitan Museum of Art](https://maps.google.com/?q=Metropolitan+Museum+of+Art,+New+York) — it's pay-what-you-wish today!

## Evening (6pm - 11pm)
Dinner at [Peter Luger Steak House](https://maps.google.com/?q=Peter+Luger+Steak+House,+New+York) in Williamsburg.

## Where to Stay
[The NoMad Hotel](https://maps.google.com/?q=The+NoMad+Hotel,+New+York) — boutique luxury in Flatiron ($350/night)

## Soundtrack
[Empire State of Mind - Jay-Z & Alicia Keys](https://open.spotify.com/track/2igwFfvr1OAGX9SKDCPBwO)
[New York State of Mind - Billy Joel](https://open.spotify.com/track/1Dq3EyQ1OLJ9NJyIrNNoZu)
    `;
    const places = extractPlaces(content, 'New York');
    expect(places).toContain('Russ & Daughters');
    expect(places).toContain('Metropolitan Museum of Art');
    expect(places).toContain('Peter Luger Steak House');
    expect(places).toContain('The NoMad Hotel');
    // Should NOT contain Spotify tracks
    expect(places).not.toContain('Empire State of Mind - Jay-Z & Alicia Keys');
    expect(places).not.toContain('New York State of Mind - Billy Joel');
  });

  it('handles maps links with plus signs for spaces', () => {
    const content = '[Brooklyn+Bridge+Park](https://maps.google.com/?q=Brooklyn+Bridge+Park)';
    const places = extractPlaces(content, 'New York');
    expect(places).toContain('Brooklyn Bridge Park');
  });
});
