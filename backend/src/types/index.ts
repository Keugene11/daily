// Shared types for backend

export interface ToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  note?: string;
}

export interface WeatherData {
  temperature: string;
  feelsLike: string;
  condition: string;
  humidity: string;
  wind: string;
  precipitation: string;
  uvIndex: string;
  visibility: string;
  sunrise: string;
  sunset: string;
  forecast: string;
}

export interface NewsItem {
  title: string;
  description: string;
  url: string;
  source: string;
}

export interface EventItem {
  name: string;
  date: string;
  location: string;
  description: string;
  url?: string;
  isFree?: boolean;
  price?: string;
  daySpecific?: string;
}

export interface StreamEvent {
  type: 'tool_call_start' | 'tool_call_result' | 'content_chunk' | 'thinking_chunk' | 'city_resolved' | 'done' | 'error';
  tool?: string;
  args?: any;
  result?: ToolResult;
  content?: string;
  thinking?: string;
  error?: string;
}

export interface PlanRequest {
  city: string;
  budget?: string;
  currentHour?: number;
  timezone?: string;
  nightlife?: boolean;
}
