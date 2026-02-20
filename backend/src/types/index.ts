// Shared types for backend

export interface ToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
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

export interface MeetupItem {
  name: string;
  date: string;
  location: string;
  description: string;
  category: string;
  url?: string;
  isFree?: boolean;
  price?: string;
  topics?: string[];
  daySpecific?: string;
}

export interface Activity {
  activity: string;
  type: string;
  participants: number;
  accessibility: string;
}

export interface StreamEvent {
  type: 'tool_call_start' | 'tool_call_result' | 'content_chunk' | 'thinking_chunk' | 'done' | 'error';
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
  mood?: string;
  currentHour?: number;
  timezone?: string;
  energyLevel?: 'low' | 'medium' | 'high';
  dietary?: string[];
  accessible?: boolean;
  dateNight?: boolean;
  antiRoutine?: boolean;
  pastPlaces?: string[];
  recurring?: boolean;
  rightNow?: boolean;
  days?: number;
}
