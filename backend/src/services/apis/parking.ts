import { ToolResult } from '../../types';

interface ParkingOption {
  name: string;
  type: 'garage' | 'lot' | 'street' | 'valet';
  address: string;
  rate: string;
  availability: 'Available' | 'Limited' | 'Full';
  distance: string;
  hours: string;
  tip?: string;
}

interface ParkingData {
  city: string;
  area: string;
  options: ParkingOption[];
  generalTip: string;
}

const CITY_PARKING: Record<string, (area: string) => ParkingData> = {
  'new york': (area: string) => ({
    city: 'New York',
    area: area || 'Midtown',
    options: [
      { name: 'Icon Parking', type: 'garage', address: '300 W 44th St', rate: '$28/2hr, $45 max', availability: 'Available', distance: '0.2 mi', hours: '24/7', tip: 'Use SpotHero app for $10-15 off' },
      { name: 'LAZ Parking', type: 'garage', address: '250 W 43rd St', rate: '$22/2hr, $38 max', availability: 'Limited', distance: '0.3 mi', hours: '6 AM-12 AM' },
      { name: 'Street Metered', type: 'street', address: '9th-12th Ave side streets', rate: '$4/hr (2hr max)', availability: 'Limited', distance: 'Varies', hours: 'Mon-Sat 8 AM-7 PM', tip: 'Free on Sundays and after 7 PM' },
      { name: 'NJ Transit Park & Ride', type: 'lot', address: 'Secaucus Junction', rate: '$6/day + $5.50 NJT fare', availability: 'Available', distance: 'Train to Penn', hours: '24/7', tip: 'Park in NJ and train in — saves $30+' }
    ],
    generalTip: 'Manhattan parking averages $30-50/day. Consider parking in NJ or outer boroughs and taking transit. SpotHero and ParkWhiz apps offer discounts up to 50%.'
  }),
  'los angeles': (area: string) => ({
    city: 'Los Angeles',
    area: area || 'Hollywood',
    options: [
      { name: 'Hollywood & Highland Garage', type: 'garage', address: '6801 Hollywood Blvd', rate: '$4/2hr with validation, $18 max', availability: 'Available', distance: '0.1 mi', hours: '6 AM-2 AM' },
      { name: 'Street Metered', type: 'street', address: 'Side streets off Hollywood Blvd', rate: '$2/hr', availability: 'Limited', distance: 'Varies', hours: 'Mon-Sat 8 AM-8 PM', tip: 'Free evenings and Sundays' },
      { name: 'Parking Spot Valet', type: 'valet', address: 'Various restaurants', rate: '$8-15', availability: 'Available', distance: 'At venue', hours: 'Dinner hours' },
      { name: 'Metro Park & Ride', type: 'lot', address: 'Universal/Studio City station', rate: 'Free + $1.75 Metro fare', availability: 'Available', distance: 'Red Line to Hollywood', hours: '24/7', tip: 'Free parking at many Metro stations' }
    ],
    generalTip: 'LA is a driving city but parking varies wildly. Shopping centers offer free validated parking. Many Metro stations have free park-and-ride lots.'
  }),
  'chicago': (area: string) => ({
    city: 'Chicago',
    area: area || 'Loop',
    options: [
      { name: 'Millennium Park Garage', type: 'garage', address: '5 S Columbus Dr', rate: '$18/3hr, $38 max', availability: 'Available', distance: '0.1 mi', hours: '24/7' },
      { name: 'SpotHero Garage', type: 'garage', address: 'Various Loop locations', rate: '$12-20/day (pre-book)', availability: 'Available', distance: 'Varies', hours: 'Varies', tip: 'Pre-book on SpotHero for best rates' },
      { name: 'Street Metered', type: 'street', address: 'Michigan Ave side streets', rate: '$6.50/hr', availability: 'Limited', distance: 'Varies', hours: '8 AM-9 PM', tip: 'Use ParkChicago app to pay/extend' },
      { name: 'CTA Park & Ride', type: 'lot', address: 'Various L stations', rate: 'Free-$5 + $2.50 CTA fare', availability: 'Available', distance: 'L to Loop', hours: '24/7', tip: 'Midway and O\'Hare Blue Line have big free lots' }
    ],
    generalTip: 'Loop parking is expensive ($30-50/day). The L system is excellent — park at an outer station and train in. Winter: avoid outdoor lots (snow/ice).'
  }),
  'san francisco': (area: string) => ({
    city: 'San Francisco',
    area: area || 'Downtown',
    options: [
      { name: 'Sutter Stockton Garage', type: 'garage', address: '330 Sutter St', rate: '$6/hr, $36 max', availability: 'Available', distance: '0.2 mi', hours: '24/7' },
      { name: 'Union Square Garage', type: 'garage', address: '333 Post St', rate: '$7/hr, $42 max', availability: 'Limited', distance: '0.1 mi', hours: '24/7' },
      { name: 'Street Metered', type: 'street', address: 'Side streets', rate: '$3-7/hr (area varies)', availability: 'Limited', distance: 'Varies', hours: 'Mon-Sat 9 AM-6 PM', tip: 'Watch for street cleaning signs — instant tow' },
      { name: 'BART Park & Ride', type: 'lot', address: 'Daly City or Millbrae station', rate: '$3/day + $5 BART fare', availability: 'Available', distance: 'BART to downtown', hours: '24/7', tip: 'BART is fast — 15 min from Daly City to Powell St' }
    ],
    generalTip: 'SF hills mean watch where you park (curb wheels!). Many tourists get towed for street cleaning violations. BART park-and-ride is the move.'
  })
};

const defaultParking = (city: string, area: string): ParkingData => ({
  city,
  area: area || 'Downtown',
  options: [
    { name: 'City Garage', type: 'garage', address: 'Downtown area', rate: '$3-5/hr, $15-25 max', availability: 'Available', distance: '0.3 mi', hours: '24/7' },
    { name: 'Street Metered', type: 'street', address: 'Main streets', rate: '$1-3/hr', availability: 'Limited', distance: 'Varies', hours: 'Business hours' },
    { name: 'Mall Parking', type: 'lot', address: 'Nearby shopping center', rate: 'Free with validation', availability: 'Available', distance: '0.5 mi', hours: 'Store hours' }
  ],
  generalTip: 'Check local parking apps for real-time availability and pre-booking discounts.'
});

function matchCity(city: string, area: string): ParkingData {
  const c = city.toLowerCase().trim();
  for (const [key, fn] of Object.entries(CITY_PARKING)) {
    if (c.includes(key) || key.includes(c)) return fn(area);
  }
  return defaultParking(city, area);
}

export const parkingService = {
  async getParking(city: string, area: string): Promise<ToolResult<ParkingData>> {
    await new Promise(r => setTimeout(r, 150));
    return { success: true, data: matchCity(city, area) };
  }
};
