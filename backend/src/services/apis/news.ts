import { ToolResult, NewsItem } from '../../types';

/**
 * News service using NewsAPI
 * Requires API key from https://newsapi.org/
 */
export const newsService = {
  async getNews(city?: string): Promise<ToolResult<NewsItem[]>> {
    const apiKey = process.env.NEWS_API_KEY;

    if (!apiKey || apiKey === 'your_newsapi_key_here') {
      return {
        success: false,
        error: 'NewsAPI key not configured. Get one at https://newsapi.org/'
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      // Use top headlines with optional country filter
      // NewsAPI free tier only supports 'us' country for top-headlines
      const country = 'us'; // Could be enhanced to map cities to countries
      const url = `https://newsapi.org/v2/top-headlines?country=${country}&pageSize=5&apiKey=${apiKey}`;

      const response = await fetch(url, { signal: controller.signal });

      if (!response.ok) {
        if (response.status === 401) {
          return {
            success: false,
            error: 'Invalid NewsAPI key. Check your .env configuration'
          };
        }
        if (response.status === 429) {
          return {
            success: false,
            error: 'NewsAPI rate limit exceeded (100 requests/day on free tier)'
          };
        }
        return {
          success: false,
          error: `NewsAPI returned ${response.status}: ${response.statusText}`
        };
      }

      const data: any = await response.json();

      if (data.status === 'error') {
        return {
          success: false,
          error: data.message || 'NewsAPI error'
        };
      }

      if (!data.articles || data.articles.length === 0) {
        return {
          success: false,
          error: 'No news articles found'
        };
      }

      const articles: NewsItem[] = data.articles
        .slice(0, 5)
        .map((article: any) => ({
          title: article.title,
          description: article.description || 'No description available',
          url: article.url,
          source: article.source?.name || 'Unknown source'
        }));

      return {
        success: true,
        data: articles
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: 'News request timed out (5s limit)'
        };
      }
      return {
        success: false,
        error: `Failed to fetch news: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
};
