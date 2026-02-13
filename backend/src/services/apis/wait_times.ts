import { ToolResult } from '../../types';

interface WaitEstimate {
  venue: string;
  type: 'restaurant' | 'attraction' | 'bar' | 'museum' | 'shop';
  currentWait: string;
  bestTime: string;
  tip: string;
}

interface WaitTimeData {
  city: string;
  estimates: WaitEstimate[];
  generalTip: string;
}

const CITY_WAITS: Record<string, WaitTimeData> = {
  'new york': {
    city: 'New York',
    estimates: [
      { venue: 'Statue of Liberty / Ellis Island', type: 'attraction', currentWait: '45-90 min (security + ferry)', bestTime: 'First ferry at 8:30 AM', tip: 'Book crown tickets 3+ months ahead. Pedestal tickets available day-of if you arrive early.' },
      { venue: 'Empire State Building', type: 'attraction', currentWait: '30-60 min', bestTime: '8 AM opening or after 10 PM', tip: 'Express pass ($65) skips the line. Sunset hour is the longest wait.' },
      { venue: 'Popular brunch spots', type: 'restaurant', currentWait: '30-90 min (weekends)', bestTime: 'Before 10 AM or after 2 PM', tip: 'Use Resy or Yelp Waitlist to get in line remotely.' },
      { venue: 'The Met Museum', type: 'museum', currentWait: '10-20 min', bestTime: 'Weekday mornings', tip: 'Enter from the less-crowded 81st St entrance.' },
      { venue: 'Joe\'s Pizza / popular spots', type: 'restaurant', currentWait: '15-30 min', bestTime: 'Late afternoon (3-5 PM)', tip: 'Cash speeds things up. Slice joints are faster than sit-down.' }
    ],
    generalTip: 'NYC runs on reservations — book restaurants 2+ weeks ahead on Resy/OpenTable. Attractions are least crowded on Tuesday-Thursday mornings.'
  },
  'los angeles': {
    city: 'Los Angeles',
    estimates: [
      { venue: 'Universal Studios Hollywood', type: 'attraction', currentWait: '30-120 min per ride', bestTime: 'First hour after opening (weekdays)', tip: 'Express Pass ($100+) is worth it — cuts waits by 80%.' },
      { venue: 'Getty Center', type: 'museum', currentWait: '5-15 min (tram up)', bestTime: 'Weekday mornings', tip: 'Free entry but parking reservation needed ($20). Less crowded before noon.' },
      { venue: 'In-N-Out Burger', type: 'restaurant', currentWait: '15-30 min (drive-thru)', bestTime: 'Before 11:30 AM or after 2 PM', tip: 'Walk-in counter is usually faster than drive-thru.' },
      { venue: 'Popular brunch spots', type: 'restaurant', currentWait: '45-90 min (weekends)', bestTime: 'Before 9 AM or after 1:30 PM', tip: 'Use Yelp Waitlist — many LA spots support remote check-in.' },
      { venue: 'Griffith Observatory', type: 'attraction', currentWait: '10-30 min (parking)', bestTime: 'Arrive by noon or after 8 PM', tip: 'Take the DASH bus from Vermont/Sunset Metro station to skip parking entirely.' }
    ],
    generalTip: 'LA waits are mostly about parking and driving. Arrive early to beat crowds. Theme parks: go weekday + buy Express.'
  },
  'tokyo': {
    city: 'Tokyo',
    estimates: [
      { venue: 'TeamLab Borderless', type: 'attraction', currentWait: '30-90 min', bestTime: 'Weekday, first entry slot', tip: 'Book online — walk-ups sell out. Go on a weekday to avoid 2hr+ waits.' },
      { venue: 'Tsukiji/Toyosu Fish Market', type: 'restaurant', currentWait: '60-180 min (popular sushi)', bestTime: 'Arrive by 5:30 AM', tip: 'Skip the famous spots — restaurants a block away are just as good with no wait.' },
      { venue: 'Popular ramen shops', type: 'restaurant', currentWait: '30-90 min', bestTime: 'Right at opening (11 AM) or 2-4 PM', tip: 'Japanese queuing is orderly. Some shops have ticket vending machines — faster.' },
      { venue: 'Tokyo Skytree', type: 'attraction', currentWait: '20-45 min', bestTime: 'Weekday evenings', tip: 'Buy fast-track tickets online. Sunset views are best but busiest.' },
      { venue: 'Shibuya Sky', type: 'attraction', currentWait: '15-30 min', bestTime: 'Book online for specific time slot', tip: 'Sunset slot books out days ahead. Night view is equally stunning and easier to book.' }
    ],
    generalTip: 'Japan respects queues — never cut. Many restaurants use ticket machines. Google Maps shows real-time busy-ness for most venues.'
  },
  'london': {
    city: 'London',
    estimates: [
      { venue: 'Tower of London', type: 'attraction', currentWait: '30-60 min', bestTime: 'Opening time (10 AM) or after 3 PM', tip: 'Crown Jewels queue is longest — go there first. Book online to skip ticket queue.' },
      { venue: 'British Museum', type: 'museum', currentWait: '10-30 min (security)', bestTime: 'Weekday mornings before 11 AM', tip: 'Free entry but bag check creates a bottleneck. Travel light.' },
      { venue: 'Borough Market', type: 'restaurant', currentWait: '5-20 min per stall', bestTime: 'Before 11 AM on weekdays', tip: 'Saturday is insane (50k visitors). Thursday/Friday lunch is the sweet spot.' },
      { venue: 'London Eye', type: 'attraction', currentWait: '30-60 min', bestTime: 'Early morning or evening', tip: 'Fast Track ticket (£10 extra) skips the standard queue entirely.' },
      { venue: 'Popular pubs', type: 'bar', currentWait: '15-30 min for table (evenings)', bestTime: 'Arrive before 5:30 PM', tip: 'Most London pubs don\'t take reservations. Standing at the bar is part of the culture.' }
    ],
    generalTip: 'London attractions: book everything online in advance. Free museums still have security queues. Restaurants: book via OpenTable UK.'
  }
};

const DEFAULT_WAITS: WaitTimeData = {
  city: 'Local',
  estimates: [
    { venue: 'Popular restaurants', type: 'restaurant', currentWait: '20-45 min', bestTime: 'Before noon or after 2 PM', tip: 'Call ahead or use waitlist apps to save time.' },
    { venue: 'Main attractions', type: 'attraction', currentWait: '15-30 min', bestTime: 'Early morning on weekdays', tip: 'Buy tickets online when possible to skip the queue.' },
    { venue: 'Museums', type: 'museum', currentWait: '5-15 min', bestTime: 'Weekday mornings', tip: 'Check for free admission days — they\'re busier but free.' }
  ],
  generalTip: 'Book reservations and buy tickets online when possible. Weekday mornings are always the least crowded time.'
};

function matchCity(city: string): WaitTimeData {
  const c = city.toLowerCase().trim();
  for (const [key, data] of Object.entries(CITY_WAITS)) {
    if (c.includes(key) || key.includes(c)) return data;
  }
  return { ...DEFAULT_WAITS, city };
}

export const waitTimeService = {
  async getWaitTimes(city: string, venue?: string): Promise<ToolResult<WaitTimeData>> {
    await new Promise(r => setTimeout(r, 150));
    const data = matchCity(city);
    if (venue) {
      const filtered = data.estimates.filter(e =>
        e.venue.toLowerCase().includes(venue.toLowerCase()) ||
        e.type === venue.toLowerCase()
      );
      if (filtered.length > 0) {
        return { success: true, data: { ...data, estimates: filtered } };
      }
    }
    return { success: true, data };
  }
};
