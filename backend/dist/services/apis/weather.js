"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.weatherService = void 0;
/**
 * Weather service using wttr.in API
 * No API key required - free to use with rate limiting
 */
exports.weatherService = {
    async getWeather(city) {
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
            const data = await response.json();
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
            const alerts = [];
            if (parseInt(chanceOfRain) > 30)
                alerts.push(`${chanceOfRain}% chance of rain`);
            if (parseInt(chanceOfSnow) > 10)
                alerts.push(`${chanceOfSnow}% chance of snow`);
            if (parseInt(chanceOfThunder) > 10)
                alerts.push(`${chanceOfThunder}% chance of thunder/storms`);
            if (alerts.length > 0)
                precipDesc += ` | ${alerts.join(', ')}`;
            // Feels-like temperature
            const feelsLikeC = current.FeelsLikeC || current.temp_C;
            const feelsLikeF = current.FeelsLikeF || current.temp_F;
            // UV index with human-readable level
            const uvRaw = parseInt(current.uvIndex || '0');
            const uvLevel = uvRaw <= 2 ? 'Low' : uvRaw <= 5 ? 'Moderate' : uvRaw <= 7 ? 'High' : uvRaw <= 10 ? 'Very High' : 'Extreme';
            // Build detailed hourly forecast (morning, afternoon, evening)
            const forecastParts = [];
            for (const h of forecastHours) {
                const time = (h.time || '0').padStart(4, '0');
                const hour = `${time.slice(0, 2)}:${time.slice(2)}`;
                const tempC = h.tempC;
                const tempF = h.tempF;
                const desc = h.weatherDesc?.[0]?.value || 'N/A';
                const rain = h.chanceofrain || '0';
                const wind = h.windspeedKmph || '0';
                let line = `${hour}: ${tempC}°C/${tempF}°F, ${desc}`;
                if (parseInt(rain) > 20)
                    line += `, ${rain}% rain`;
                if (parseInt(wind) > 30)
                    line += `, wind ${wind}km/h`;
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
        }
        catch (error) {
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
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
};
