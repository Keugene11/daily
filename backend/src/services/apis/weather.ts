import { ToolResult, WeatherData } from '../../types';

// WMO weather code → human-readable description
const WMO_CODES: Record<number, string> = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Depositing rime fog',
  51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
  61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
  71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
  77: 'Snow grains', 80: 'Slight rain showers', 81: 'Moderate rain showers',
  82: 'Violent rain showers', 85: 'Slight snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail',
};

/**
 * Fallback weather via Open-Meteo (free, no API key, very reliable)
 * Geocodes city name first, then fetches weather.
 */
async function fetchOpenMeteo(city: string): Promise<ToolResult<WeatherData>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    // Geocode city → lat/lon
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en`;
    const geoResp = await fetch(geoUrl, { signal: controller.signal });
    if (!geoResp.ok) throw new Error('Geocoding failed');
    const geoData: any = await geoResp.json();
    const place = geoData.results?.[0];
    if (!place) throw new Error('City not found');

    const { latitude, longitude, timezone } = place;

    // Fetch current weather + today's forecast
    const wxUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,visibility` +
      `&hourly=temperature_2m,weather_code,precipitation_probability,wind_speed_10m` +
      `&daily=sunrise,sunset` +
      `&temperature_unit=celsius&wind_speed_unit=kmh&timezone=${encodeURIComponent(timezone || 'auto')}&forecast_days=1`;

    const wxResp = await fetch(wxUrl, { signal: controller.signal });
    if (!wxResp.ok) throw new Error('Weather API failed');
    const wx: any = await wxResp.json();

    const cur = wx.current;
    if (!cur) throw new Error('No current weather');

    const tempC = Math.round(cur.temperature_2m);
    const tempF = Math.round(tempC * 9 / 5 + 32);
    const feelsC = Math.round(cur.apparent_temperature);
    const feelsF = Math.round(feelsC * 9 / 5 + 32);
    const condition = WMO_CODES[cur.weather_code] || 'Unknown';
    const windKmh = Math.round(cur.wind_speed_10m);
    const windMph = Math.round(windKmh * 0.621);
    const gustKmh = cur.wind_gusts_10m ? Math.round(cur.wind_gusts_10m) : null;
    const uvRaw = Math.round(cur.uv_index || 0);
    const uvLevel = uvRaw <= 2 ? 'Low' : uvRaw <= 5 ? 'Moderate' : uvRaw <= 7 ? 'High' : uvRaw <= 10 ? 'Very High' : 'Extreme';
    const precipMm = cur.precipitation || 0;
    const visKm = cur.visibility ? Math.round(cur.visibility / 1000) : null;

    // Wind description
    let windDesc = `${windKmh} km/h (${windMph} mph)`;
    if (gustKmh && gustKmh > windKmh) windDesc += `, gusts up to ${gustKmh} km/h`;

    // Precipitation description from hourly probabilities
    let precipDesc = precipMm > 0 ? `${precipMm} mm currently falling` : 'None currently';
    const hourlyRain = wx.hourly?.precipitation_probability || [];
    const maxRainChance = Math.max(...hourlyRain.map((v: number) => v || 0));
    if (maxRainChance > 30) precipDesc += ` | ${maxRainChance}% chance of rain today`;

    // Hourly forecast
    const forecastParts: string[] = [];
    const hourlyTemps = wx.hourly?.temperature_2m || [];
    const hourlyCodes = wx.hourly?.weather_code || [];
    const hourlyWind = wx.hourly?.wind_speed_10m || [];
    for (let i = 0; i < hourlyTemps.length; i += 3) {
      const hour = String(i).padStart(2, '0') + ':00';
      const hTempC = Math.round(hourlyTemps[i]);
      const hTempF = Math.round(hTempC * 9 / 5 + 32);
      const hDesc = WMO_CODES[hourlyCodes[i]] || 'N/A';
      const hRain = hourlyRain[i] || 0;
      const hWind = Math.round(hourlyWind[i] || 0);
      let line = `${hour}: ${hTempC}°C/${hTempF}°F, ${hDesc}`;
      if (hRain > 20) line += `, ${hRain}% rain`;
      if (hWind > 30) line += `, wind ${hWind}km/h`;
      forecastParts.push(line);
    }

    const sunrise = wx.daily?.sunrise?.[0]?.split('T')[1] || 'N/A';
    const sunset = wx.daily?.sunset?.[0]?.split('T')[1] || 'N/A';

    return {
      success: true,
      data: {
        temperature: `${tempC}°C / ${tempF}°F`,
        feelsLike: `${feelsC}°C / ${feelsF}°F`,
        condition,
        humidity: `${cur.relative_humidity_2m}%`,
        wind: windDesc,
        precipitation: precipDesc,
        uvIndex: `${uvRaw} (${uvLevel})`,
        visibility: visKm != null ? `${visKm} km` : 'N/A',
        sunrise,
        sunset,
        forecast: forecastParts.length > 0 ? forecastParts.join(' | ') : 'No forecast available',
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Open-Meteo fallback failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Weather service — tries wttr.in first, falls back to Open-Meteo
 */
export const weatherService = {
  async getWeather(city: string): Promise<ToolResult<WeatherData>> {
    // Try wttr.in first (fast when it works)
    const wttrResult = await fetchWttrIn(city);
    if (wttrResult.success) return wttrResult;

    console.log(`[Weather] wttr.in failed for "${city}", trying Open-Meteo fallback...`);
    return fetchOpenMeteo(city);
  }
};

async function fetchWttrIn(city: string): Promise<ToolResult<WeatherData>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`;
      const response = await fetch(url, { signal: controller.signal });

      if (!response.ok) {
        return {
          success: false,
          error: `Weather API returned ${response.status}: ${response.statusText}`
        };
      }

      const data: any = await response.json();
      const current = data.current_condition?.[0];

      if (!current) {
        return {
          success: false,
          error: 'No weather data available for this city'
        };
      }

      const weather = data.weather?.[0];
      const astronomy = weather?.astronomy?.[0];
      const forecastHours = weather?.hourly || [];

      // Build detailed wind description
      const windKmph = current.windspeedKmph || '0';
      const windMph = current.windspeedMiles || '0';
      const windDir = current.winddir16Point || '';
      const gustKmph = current.WindGustKmph;
      let windDesc = `${windKmph} km/h (${windMph} mph) ${windDir}`;
      if (gustKmph && parseInt(gustKmph) > parseInt(windKmph)) {
        windDesc += `, gusts up to ${gustKmph} km/h`;
      }

      // Build precipitation info
      const precipMm = parseFloat(current.precipMM || '0');
      const chanceOfRain = forecastHours[0]?.chanceofrain || '0';
      const chanceOfSnow = forecastHours[0]?.chanceofsnow || '0';
      const chanceOfThunder = forecastHours[0]?.chanceofthunder || '0';
      let precipDesc = precipMm > 0
        ? `${precipMm} mm currently falling`
        : 'None currently';
      const alerts: string[] = [];
      if (parseInt(chanceOfRain) > 30) alerts.push(`${chanceOfRain}% chance of rain`);
      if (parseInt(chanceOfSnow) > 10) alerts.push(`${chanceOfSnow}% chance of snow`);
      if (parseInt(chanceOfThunder) > 10) alerts.push(`${chanceOfThunder}% chance of thunder/storms`);
      if (alerts.length > 0) precipDesc += ` | ${alerts.join(', ')}`;

      // Feels-like temperature
      const feelsLikeC = current.FeelsLikeC || current.temp_C;
      const feelsLikeF = current.FeelsLikeF || current.temp_F;

      // UV index with human-readable level
      const uvRaw = parseInt(current.uvIndex || '0');
      const uvLevel = uvRaw <= 2 ? 'Low' : uvRaw <= 5 ? 'Moderate' : uvRaw <= 7 ? 'High' : uvRaw <= 10 ? 'Very High' : 'Extreme';

      // Build detailed hourly forecast (morning, afternoon, evening)
      const forecastParts: string[] = [];
      for (const h of forecastHours) {
        const time = (h.time || '0').padStart(4, '0');
        const hour = `${time.slice(0, 2)}:${time.slice(2)}`;
        const tempC = h.tempC;
        const tempF = h.tempF;
        const desc = h.weatherDesc?.[0]?.value || 'N/A';
        const rain = h.chanceofrain || '0';
        const wind = h.windspeedKmph || '0';
        let line = `${hour}: ${tempC}°C/${tempF}°F, ${desc}`;
        if (parseInt(rain) > 20) line += `, ${rain}% rain`;
        if (parseInt(wind) > 30) line += `, wind ${wind}km/h`;
        forecastParts.push(line);
      }

      return {
        success: true,
        data: {
          temperature: `${current.temp_C}°C / ${current.temp_F}°F`,
          feelsLike: `${feelsLikeC}°C / ${feelsLikeF}°F`,
          condition: current.weatherDesc?.[0]?.value || 'Unknown',
          humidity: `${current.humidity}%`,
          wind: windDesc,
          precipitation: precipDesc,
          uvIndex: `${uvRaw} (${uvLevel})`,
          visibility: `${current.visibility || 'N/A'} km`,
          sunrise: astronomy?.sunrise || 'N/A',
          sunset: astronomy?.sunset || 'N/A',
          forecast: forecastParts.length > 0
            ? forecastParts.join(' | ')
            : 'No forecast available'
        }
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: 'Weather request timed out'
        };
      }
      return {
        success: false,
        error: `Failed to fetch weather: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    } finally {
      clearTimeout(timeoutId);
    }
}
