"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sunriseSunsetService = void 0;
const CITY_SUN = {
    'new york': {
        city: 'New York',
        sunrise: '6:52 AM', sunset: '5:24 PM',
        goldenHourMorning: '6:52-7:32 AM', goldenHourEvening: '4:44-5:24 PM',
        blueHourMorning: '6:22-6:52 AM', blueHourEvening: '5:24-5:54 PM',
        dayLength: '10h 32m', solarNoon: '12:08 PM', twilightEnd: '5:54 PM',
        photoSpots: ['Brooklyn Bridge at sunrise', 'Top of the Rock at golden hour', 'DUMBO for Manhattan skyline at sunset', 'Central Park Bow Bridge at blue hour'],
        tips: ['Book a sunset dinner reservation for 4:30 PM to catch the colors', 'The Vessel at Hudson Yards faces west — perfect for sunset', 'Sunrise from Brooklyn Bridge Park is magical and uncrowded']
    },
    'los angeles': {
        city: 'Los Angeles',
        sunrise: '6:38 AM', sunset: '5:35 PM',
        goldenHourMorning: '6:38-7:18 AM', goldenHourEvening: '4:55-5:35 PM',
        blueHourMorning: '6:08-6:38 AM', blueHourEvening: '5:35-6:05 PM',
        dayLength: '10h 57m', solarNoon: '12:06 PM', twilightEnd: '6:05 PM',
        photoSpots: ['Griffith Observatory at golden hour', 'Santa Monica Pier at sunset', 'El Matador Beach at blue hour', 'Downtown rooftops facing west'],
        tips: ['Golden hour at Griffith is iconic — arrive early for parking', 'Malibu beaches face south/west — perfect sunset orientation', 'Venice canals are beautiful at golden hour without crowds']
    },
    'paris': {
        city: 'Paris',
        sunrise: '8:18 AM', sunset: '5:52 PM',
        goldenHourMorning: '8:18-8:58 AM', goldenHourEvening: '5:12-5:52 PM',
        blueHourMorning: '7:48-8:18 AM', blueHourEvening: '5:52-6:22 PM',
        dayLength: '9h 34m', solarNoon: '1:05 PM', twilightEnd: '6:22 PM',
        photoSpots: ['Trocadéro for Eiffel Tower at sunrise', 'Pont Alexandre III at golden hour', 'Sacré-Cœur steps at sunset', 'Seine river banks at blue hour'],
        tips: ['Eiffel Tower sparkles for 5 min every hour on the hour after dark', 'Book a Seine dinner cruise departing at 5 PM for sunset views', 'Montmartre faces south — golden hour lights up the whole hillside']
    },
    'tokyo': {
        city: 'Tokyo',
        sunrise: '6:32 AM', sunset: '5:18 PM',
        goldenHourMorning: '6:32-7:12 AM', goldenHourEvening: '4:38-5:18 PM',
        blueHourMorning: '6:02-6:32 AM', blueHourEvening: '5:18-5:48 PM',
        dayLength: '10h 46m', solarNoon: '11:55 AM', twilightEnd: '5:48 PM',
        photoSpots: ['Shibuya Crossing at blue hour (neon + twilight sky)', 'Tokyo Tower from Shiba Park at sunset', 'Senso-ji at dawn (empty and mystical)', 'Rainbow Bridge at golden hour'],
        tips: ['Shibuya at blue hour is the most iconic Tokyo shot', 'Mt. Fuji is most visible at sunrise from December-February', 'Book a Skytree visit for 4:30 PM to see daylight transition to city lights']
    },
    'london': {
        city: 'London',
        sunrise: '7:38 AM', sunset: '4:52 PM',
        goldenHourMorning: '7:38-8:18 AM', goldenHourEvening: '4:12-4:52 PM',
        blueHourMorning: '7:08-7:38 AM', blueHourEvening: '4:52-5:22 PM',
        dayLength: '9h 14m', solarNoon: '12:15 PM', twilightEnd: '5:22 PM',
        photoSpots: ['Tower Bridge at sunrise', 'Parliament & Big Ben at golden hour', 'Primrose Hill at sunset (skyline panorama)', 'South Bank at blue hour'],
        tips: ['London sunsets are early in winter — plan golden hour activities around 4 PM', 'The Shard viewing platform is perfect for sunset', 'Hampton Court at golden hour is stunning and uncrowded']
    }
};
const DEFAULT_SUN = {
    city: 'Local',
    sunrise: '6:45 AM', sunset: '5:30 PM',
    goldenHourMorning: '6:45-7:25 AM', goldenHourEvening: '4:50-5:30 PM',
    blueHourMorning: '6:15-6:45 AM', blueHourEvening: '5:30-6:00 PM',
    dayLength: '10h 45m', solarNoon: '12:07 PM', twilightEnd: '6:00 PM',
    photoSpots: ['East-facing viewpoint for sunrise', 'Waterfront areas at golden hour', 'Hilltop parks for sunset panoramas'],
    tips: ['Golden hour is the 40 min before sunset — best light for photos', 'Blue hour (20-30 min after sunset) gives a magical twilight glow', 'Check the weather — partly cloudy skies make the best sunsets']
};
function matchCity(city) {
    const c = city.toLowerCase().trim();
    for (const [key, data] of Object.entries(CITY_SUN)) {
        if (c.includes(key) || key.includes(c))
            return data;
    }
    return { ...DEFAULT_SUN, city };
}
exports.sunriseSunsetService = {
    async getSunriseSunset(city) {
        await new Promise(r => setTimeout(r, 100));
        return { success: true, data: matchCity(city) };
    }
};
