import { ToolResult, Activity } from '../../types';

/**
 * Activity service - tries multiple Bored API endpoints with fallback
 * No API key required
 */
export const activityService = {
  async getActivity(type?: string): Promise<ToolResult<Activity>> {
    // Try the newer Bored API first, then fallback
    const endpoints = [
      'https://bored-api.appbrewery.com/random',
      'https://bored.api.lewagon.com/api/activity',
      'https://www.boredapi.com/api/activity'
    ];

    for (const baseUrl of endpoints) {
      try {
        const result = await this.tryEndpoint(baseUrl, type);
        if (result.success) return result;
      } catch {
        // Try next endpoint
        continue;
      }
    }

    // All endpoints failed - return a hardcoded fun suggestion
    return {
      success: true,
      data: {
        activity: this.getRandomFallbackActivity(),
        type: type || 'recreational',
        participants: 1,
        accessibility: 'Easy'
      }
    };
  },

  async tryEndpoint(baseUrl: string, type?: string): Promise<ToolResult<Activity>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      let url = baseUrl;
      if (type && !baseUrl.includes('appbrewery')) {
        url += `?type=${encodeURIComponent(type)}`;
      }

      const response = await fetch(url, { signal: controller.signal });

      if (!response.ok) {
        return { success: false, error: `API returned ${response.status}` };
      }

      const data: any = await response.json();

      if (data.error) {
        return { success: false, error: data.error };
      }

      return {
        success: true,
        data: {
          activity: data.activity,
          type: data.type || type || 'recreational',
          participants: data.participants || 1,
          accessibility: (data.accessibility ?? 0.5) <= 0.3
            ? 'Easy'
            : (data.accessibility ?? 0.5) <= 0.7
            ? 'Moderate'
            : 'Challenging'
        }
      };
    } catch {
      return { success: false, error: 'Request failed' };
    } finally {
      clearTimeout(timeoutId);
    }
  },

  getRandomFallbackActivity(): string {
    const activities = [
      'Visit a local park and have a picnic',
      'Try cooking a new recipe from a different cuisine',
      'Start a journal or write a short story',
      'Go for a walk and photograph interesting things you see',
      'Visit a local bookstore or library',
      'Try a new coffee shop or restaurant',
      'Learn origami or another craft',
      'Have a movie marathon of films you\'ve been meaning to watch',
      'Explore a neighborhood you\'ve never been to',
      'Visit a local museum or art gallery'
    ];
    return activities[Math.floor(Math.random() * activities.length)];
  }
};
