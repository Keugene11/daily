"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transitRouteService = void 0;
const CITY_ROUTES = {
    'new york': (from, to) => ({
        city: 'New York',
        from, to,
        routes: [
            {
                totalDuration: '25-35 min',
                totalCost: '$2.90 (MetroCard/OMNY)',
                steps: [
                    { instruction: `Walk to nearest subway station`, mode: 'walk', duration: '5 min', detail: 'Head to the closest MTA entrance' },
                    { instruction: 'Take the subway', mode: 'subway', line: 'A/C/E or 1/2/3', duration: '15-20 min', detail: `Toward ${to}` },
                    { instruction: `Walk to ${to}`, mode: 'walk', duration: '5-10 min', detail: 'Follow signs to the exit and walk to destination' }
                ],
                tip: 'Use OMNY (tap your credit card) — no MetroCard needed'
            },
            {
                totalDuration: '15-30 min',
                totalCost: '$15-25',
                steps: [
                    { instruction: 'Take an Uber/Lyft', mode: 'bus', duration: '15-30 min', detail: `Direct rideshare from ${from} to ${to}. Surge pricing possible during rush hour.` }
                ],
                tip: 'Uber Pool/Lyft Shared can cut costs 40%'
            }
        ],
        generalTip: 'NYC subway runs 24/7. Express trains (skip stops) are faster but check the map. Citibike is great for distances under 2 miles.'
    }),
    'london': (from, to) => ({
        city: 'London',
        from, to,
        routes: [
            {
                totalDuration: '20-35 min',
                totalCost: '£2.80 (Oyster/contactless)',
                steps: [
                    { instruction: 'Walk to nearest Tube station', mode: 'walk', duration: '5 min', detail: 'Look for the Underground roundel sign' },
                    { instruction: 'Take the Tube', mode: 'subway', line: 'District/Circle/Central', duration: '10-20 min', detail: `Toward ${to} — check TfL map for best line` },
                    { instruction: `Walk to ${to}`, mode: 'walk', duration: '5-10 min', detail: 'Follow exit signs' }
                ],
                tip: 'Use contactless bank card — daily cap is cheaper than a day pass'
            },
            {
                totalDuration: '25-40 min',
                totalCost: '£1.75',
                steps: [
                    { instruction: 'Take the bus', mode: 'bus', line: 'Check CityMapper for route', duration: '25-40 min', detail: `Bus from near ${from} to ${to}. Slower but scenic — sit upstairs at the front!` }
                ],
                tip: 'London buses are £1.75 flat — cheapest way to see the city'
            }
        ],
        generalTip: 'Use Citymapper app — it\'s London\'s best transit app. The Tube closes around midnight (Night Tube on Fri/Sat on some lines).'
    }),
    'tokyo': (from, to) => ({
        city: 'Tokyo',
        from, to,
        routes: [
            {
                totalDuration: '20-40 min',
                totalCost: '¥200-400 (~$1.50-3)',
                steps: [
                    { instruction: 'Walk to nearest station', mode: 'walk', duration: '5 min', detail: 'Tokyo has a station every 500m — follow the signs' },
                    { instruction: 'Take the train', mode: 'train', line: 'JR Yamanote or Metro', duration: '10-25 min', detail: `Transfer may be needed — follow color-coded signs to ${to}` },
                    { instruction: `Walk to ${to}`, mode: 'walk', duration: '5-10 min', detail: 'Check Google Maps for the correct station exit number' }
                ],
                tip: 'Get a Suica/Pasmo IC card — works on all trains and buses, also at convenience stores'
            }
        ],
        generalTip: 'Tokyo trains are extremely punctual. Last train is around 12:00 AM, first train 5:00 AM. Google Maps works perfectly for Tokyo transit.'
    }),
    'paris': (from, to) => ({
        city: 'Paris',
        from, to,
        routes: [
            {
                totalDuration: '20-35 min',
                totalCost: '€2.15 (single t+ ticket)',
                steps: [
                    { instruction: 'Walk to nearest Métro station', mode: 'walk', duration: '5 min', detail: 'Look for the Art Nouveau "M" signs' },
                    { instruction: 'Take the Métro', mode: 'subway', line: 'Check RATP for line number', duration: '10-20 min', detail: `Direction ${to} — one transfer may be needed` },
                    { instruction: `Walk to ${to}`, mode: 'walk', duration: '5-10 min', detail: 'Follow "Sortie" signs to the exit' }
                ],
                tip: 'Buy a carnet of 10 tickets (€16.90) — cheaper than individual tickets'
            },
            {
                totalDuration: '30-50 min',
                totalCost: 'Free',
                steps: [
                    { instruction: 'Take a Vélib\' bike', mode: 'walk', duration: '30-50 min', detail: `Bike from ${from} to ${to} using the city bike-share system. First 30 min free!` }
                ],
                tip: 'Vélib\' e-bikes make hills easy — day pass is €5'
            }
        ],
        generalTip: 'Paris Métro covers the entire city — no station is more than 500m away. Runs 5:30 AM-1:15 AM (2:15 AM Fri/Sat).'
    }),
    'chicago': (from, to) => ({
        city: 'Chicago',
        from, to,
        routes: [
            {
                totalDuration: '20-35 min',
                totalCost: '$2.50 (Ventra card)',
                steps: [
                    { instruction: 'Walk to nearest L station', mode: 'walk', duration: '5 min', detail: 'Look for the CTA elevated station entrances' },
                    { instruction: 'Take the L train', mode: 'subway', line: 'Red/Blue/Brown/Green Line', duration: '10-20 min', detail: `Toward ${to} — check CTA map for line and direction` },
                    { instruction: `Walk to ${to}`, mode: 'walk', duration: '5-10 min', detail: 'Follow signs to street level' }
                ],
                tip: 'Blue Line runs 24/7 to O\'Hare. Other lines stop around 1 AM.'
            }
        ],
        generalTip: 'Chicago\'s L is reliable and covers most tourist areas. Bus is good for east-west travel. Divvy bikes are great along the Lakefront Trail.'
    })
};
const defaultRoutes = (city, from, to) => ({
    city, from, to,
    routes: [
        {
            totalDuration: '20-40 min',
            totalCost: '$2-5',
            steps: [
                { instruction: 'Walk to nearest transit stop', mode: 'walk', duration: '5 min', detail: 'Check local transit app for nearest stop' },
                { instruction: 'Take public transit', mode: 'bus', duration: '10-25 min', detail: `From ${from} area toward ${to}` },
                { instruction: `Walk to ${to}`, mode: 'walk', duration: '5-10 min', detail: 'Follow maps to final destination' }
            ]
        }
    ],
    generalTip: 'Download the local transit app and Google Maps for step-by-step directions.'
});
function matchCity(city, from, to) {
    const c = city.toLowerCase().trim();
    for (const [key, fn] of Object.entries(CITY_ROUTES)) {
        if (c.includes(key) || key.includes(c))
            return fn(from, to);
    }
    return defaultRoutes(city, from, to);
}
exports.transitRouteService = {
    async getTransitRoutes(city, from, to) {
        await new Promise(r => setTimeout(r, 150));
        return { success: true, data: matchCity(city, from, to) };
    }
};
