import React from 'react';

interface WeatherData {
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

interface Props {
  data: WeatherData;
  city: string;
}

export const WeatherCard: React.FC<Props> = ({ data, city }) => {
  return (
    <div className="border border-on-surface/10 rounded-xl p-5 mb-8 animate-fadeIn">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs uppercase tracking-[0.15em] text-on-surface/40 mb-1">Current weather</p>
          <p className="text-lg font-semibold text-on-surface/90">{city}</p>
        </div>
        <p className="text-3xl font-light text-on-surface/80">{data.temperature}</p>
      </div>

      <p className="text-sm text-on-surface/60 mb-4">
        {data.condition} &middot; Feels like {data.feelsLike}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-on-surface/50">
        <div className="flex items-center gap-1.5">
          <svg className="h-3.5 w-3.5 text-on-surface/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          <span>{data.wind}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg className="h-3.5 w-3.5 text-on-surface/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
          </svg>
          <span>{data.precipitation}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg className="h-3.5 w-3.5 text-on-surface/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
          </svg>
          <span>UV {data.uvIndex}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg className="h-3.5 w-3.5 text-on-surface/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>{data.humidity} humidity</span>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-3 text-xs text-on-surface/35">
        <span>Sunrise {data.sunrise}</span>
        <span>Sunset {data.sunset}</span>
      </div>
    </div>
  );
};
