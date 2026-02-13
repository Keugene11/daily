import { ToolResult } from '../../types';

interface GasStation {
  name: string;
  address: string;
  regular: number;
  midgrade: number;
  premium: number;
  diesel: number;
  distance: string;
  lastUpdated: string;
}

interface GasPriceData {
  city: string;
  averageRegular: number;
  stations: GasStation[];
  tip: string;
}

const CITY_GAS: Record<string, GasPriceData> = {
  'new york': {
    city: 'New York',
    averageRegular: 3.89,
    stations: [
      { name: 'BP Station', address: '145th & Broadway', regular: 3.79, midgrade: 4.09, premium: 4.39, diesel: 4.19, distance: '0.3 mi', lastUpdated: '2 hrs ago' },
      { name: 'Shell', address: 'FDR Dr & 96th St', regular: 3.85, midgrade: 4.15, premium: 4.49, diesel: 4.25, distance: '0.8 mi', lastUpdated: '4 hrs ago' },
      { name: 'Mobil', address: '10th Ave & 46th St', regular: 3.99, midgrade: 4.29, premium: 4.59, diesel: 4.35, distance: '1.2 mi', lastUpdated: '1 hr ago' }
    ],
    tip: 'Gas is pricey in Manhattan — consider filling up in NJ (typically $0.30-0.50 cheaper) if you\'re crossing the bridge.'
  },
  'los angeles': {
    city: 'Los Angeles',
    averageRegular: 4.59,
    stations: [
      { name: 'Costco Gas', address: 'Burbank Blvd', regular: 4.19, midgrade: 4.49, premium: 4.69, diesel: 4.55, distance: '2.1 mi', lastUpdated: '1 hr ago' },
      { name: 'Arco', address: 'Sunset Blvd & Vine', regular: 4.45, midgrade: 4.75, premium: 4.99, diesel: 4.65, distance: '0.5 mi', lastUpdated: '3 hrs ago' },
      { name: 'Chevron', address: 'Santa Monica & La Brea', regular: 4.69, midgrade: 4.99, premium: 5.29, diesel: 4.89, distance: '0.9 mi', lastUpdated: '2 hrs ago' }
    ],
    tip: 'LA gas prices vary wildly — Costco and Arco are usually cheapest. Avoid stations right off the freeway.'
  },
  'chicago': {
    city: 'Chicago',
    averageRegular: 3.65,
    stations: [
      { name: 'Speedway', address: 'Michigan Ave & Oak St', regular: 3.55, midgrade: 3.85, premium: 4.15, diesel: 3.95, distance: '0.4 mi', lastUpdated: '1 hr ago' },
      { name: 'BP', address: 'Lake Shore Dr & Belmont', regular: 3.59, midgrade: 3.89, premium: 4.19, diesel: 3.99, distance: '1.0 mi', lastUpdated: '3 hrs ago' },
      { name: 'Shell', address: 'Halsted & Division', regular: 3.75, midgrade: 4.05, premium: 4.35, diesel: 4.15, distance: '0.7 mi', lastUpdated: '2 hrs ago' }
    ],
    tip: 'Fill up in the suburbs or Indiana for savings of $0.20-0.40/gal vs. downtown Chicago.'
  }
};

const DEFAULT_GAS: GasPriceData = {
  city: 'Local',
  averageRegular: 3.45,
  stations: [
    { name: 'Shell Station', address: 'Main St & 1st Ave', regular: 3.39, midgrade: 3.69, premium: 3.99, diesel: 3.79, distance: '0.5 mi', lastUpdated: '2 hrs ago' },
    { name: 'Costco Gas', address: 'Commerce Blvd', regular: 3.19, midgrade: 3.49, premium: 3.79, diesel: 3.59, distance: '2.3 mi', lastUpdated: '1 hr ago' },
    { name: 'BP Express', address: 'Highway 101 & Oak', regular: 3.55, midgrade: 3.85, premium: 4.15, diesel: 3.95, distance: '1.1 mi', lastUpdated: '4 hrs ago' }
  ],
  tip: 'Use GasBuddy app for real-time prices. Warehouse clubs (Costco, Sam\'s) are usually cheapest.'
};

function matchCity(city: string): GasPriceData {
  const c = city.toLowerCase().trim();
  for (const [key, data] of Object.entries(CITY_GAS)) {
    if (c.includes(key) || key.includes(c)) return data;
  }
  return { ...DEFAULT_GAS, city };
}

export const gasPriceService = {
  async getGasPrices(city: string): Promise<ToolResult<GasPriceData>> {
    await new Promise(r => setTimeout(r, 150));
    return { success: true, data: matchCity(city) };
  }
};
