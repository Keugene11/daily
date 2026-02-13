import { ToolResult } from '../../types';

interface PollenData {
  city: string;
  overall: 'Low' | 'Moderate' | 'High' | 'Very High';
  overallIndex: number;
  tree: { level: string; index: number; types: string[] };
  grass: { level: string; index: number };
  weed: { level: string; index: number; types: string[] };
  mold: { level: string; index: number };
  airQuality: { aqi: number; level: string; description: string };
  forecast: string;
  advice: string[];
}

const CITY_POLLEN: Record<string, PollenData> = {
  'new york': {
    city: 'New York',
    overall: 'Moderate', overallIndex: 5,
    tree: { level: 'Moderate', index: 5, types: ['Oak', 'Birch', 'Maple'] },
    grass: { level: 'Low', index: 2 },
    weed: { level: 'Low', index: 2, types: ['Ragweed'] },
    mold: { level: 'Moderate', index: 4 },
    airQuality: { aqi: 62, level: 'Moderate', description: 'Acceptable for most, sensitive groups may notice effects' },
    forecast: 'Pollen levels expected to rise through the afternoon. Peak counts between 10 AM-3 PM.',
    advice: ['Take allergy meds 30 min before going out', 'Central Park and riverside areas will have higher counts', 'Indoor activities best from 10 AM-3 PM if sensitive', 'Shower after extended time outdoors']
  },
  'los angeles': {
    city: 'Los Angeles',
    overall: 'High', overallIndex: 7,
    tree: { level: 'High', index: 7, types: ['Palm', 'Olive', 'Eucalyptus'] },
    grass: { level: 'Moderate', index: 5 },
    weed: { level: 'Moderate', index: 4, types: ['Sagebrush', 'Tumbleweeds'] },
    mold: { level: 'Low', index: 2 },
    airQuality: { aqi: 78, level: 'Moderate', description: 'Sensitive groups should limit prolonged outdoor exertion' },
    forecast: 'Santa Ana winds expected to increase pollen dispersal. Higher counts in the Valley.',
    advice: ['Avoid hiking in the Valley today if sensitive', 'Beach areas have lower pollen due to ocean breeze', 'Keep car windows up while driving', 'Best outdoor time: early morning before winds pick up']
  },
  'london': {
    city: 'London',
    overall: 'Low', overallIndex: 2,
    tree: { level: 'Low', index: 2, types: ['Silver Birch', 'Plane Tree'] },
    grass: { level: 'Low', index: 1 },
    weed: { level: 'Low', index: 1, types: ['Nettle'] },
    mold: { level: 'Moderate', index: 4 },
    airQuality: { aqi: 45, level: 'Good', description: 'Air quality is satisfactory — minimal health risk' },
    forecast: 'Low pollen day — overcast skies keeping counts down. Good day for outdoor activities.',
    advice: ['Great day for parks and outdoor activities', 'Mold spores slightly elevated — damp areas may trigger symptoms', 'No special precautions needed for most people']
  },
  'tokyo': {
    city: 'Tokyo',
    overall: 'High', overallIndex: 8,
    tree: { level: 'Very High', index: 9, types: ['Japanese Cedar (sugi)', 'Cypress (hinoki)'] },
    grass: { level: 'Low', index: 2 },
    weed: { level: 'Low', index: 1, types: [] },
    mold: { level: 'Low', index: 2 },
    airQuality: { aqi: 55, level: 'Moderate', description: 'Acceptable — cedar pollen is the main concern' },
    forecast: 'Peak cedar pollen season (kafunshō). Highest counts midday. Masks strongly recommended.',
    advice: ['Wear a mask outdoors — this is normal in Tokyo during cedar season', 'Convenience stores sell pollen-blocking masks and eye drops', 'Indoor activities recommended 11 AM-3 PM', 'Take antihistamines before going out']
  }
};

const DEFAULT_POLLEN: PollenData = {
  city: 'Local',
  overall: 'Moderate', overallIndex: 4,
  tree: { level: 'Moderate', index: 4, types: ['Oak', 'Pine'] },
  grass: { level: 'Low', index: 2 },
  weed: { level: 'Low', index: 2, types: ['Ragweed'] },
  mold: { level: 'Low', index: 2 },
  airQuality: { aqi: 50, level: 'Good', description: 'Air quality is satisfactory' },
  forecast: 'Moderate pollen expected. Counts typically peak between 10 AM and 3 PM.',
  advice: ['Consider taking allergy medication if you\'re sensitive', 'Morning and evening are best for outdoor activities', 'Keep windows closed during peak hours']
};

function matchCity(city: string): PollenData {
  const c = city.toLowerCase().trim();
  for (const [key, data] of Object.entries(CITY_POLLEN)) {
    if (c.includes(key) || key.includes(c)) return data;
  }
  return { ...DEFAULT_POLLEN, city };
}

export const pollenService = {
  async getPollenCount(city: string): Promise<ToolResult<PollenData>> {
    await new Promise(r => setTimeout(r, 100));
    return { success: true, data: matchCity(city) };
  }
};
