import { ToolResult } from '../../types';

interface TransitInfo {
  walkingTime: string;
  transitTime: string;
  drivingTime: string;
  tip: string;
}

export const transitService = {
  async getTransitEstimates(city: string, from: string, to: string): Promise<ToolResult<TransitInfo>> {
    await new Promise(resolve => setTimeout(resolve, 250));

    // Generate realistic-looking transit times based on city size
    const largeCities = ['new york', 'london', 'tokyo', 'paris', 'chicago', 'los angeles', 'san francisco'];
    const isLarge = largeCities.some(c => city.toLowerCase().includes(c));

    const walkMin = isLarge ? Math.floor(Math.random() * 20) + 15 : Math.floor(Math.random() * 15) + 5;
    const transitMin = isLarge ? Math.floor(Math.random() * 15) + 10 : Math.floor(Math.random() * 20) + 15;
    const driveMin = Math.floor(Math.random() * 15) + 5;

    const tips = [
      'Public transit is the fastest option during rush hour',
      'Consider walking — the route passes through a scenic area',
      'Ride-sharing is readily available in this area',
      'There\'s a bike-share station nearby for a fun alternative',
      'The subway/metro is the most reliable option here',
    ];

    return {
      success: true,
      data: {
        walkingTime: `${walkMin} min walk`,
        transitTime: `${transitMin} min by transit`,
        drivingTime: `${driveMin} min by car`,
        tip: tips[Math.floor(Math.random() * tips.length)]
      }
    };
  }
};
