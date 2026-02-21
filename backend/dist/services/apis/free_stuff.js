"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.freeStuffService = void 0;
const location_aliases_1 = require("./location_aliases");
const todayStr = () => new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const dayOfWeek = () => new Date().getDay();
const dayName = () => new Date().toLocaleDateString('en-US', { weekday: 'long' });
const CITY_FREE = {
    'new york': {
        activities: [
            { name: 'MoMA Free Friday Evening', type: 'museum', location: '11 W 53rd St, Midtown', time: '4-8 PM', description: 'Free admission to one of the world\'s best modern art collections — Picasso, Warhol, Monet', tip: 'Arrive by 3:45 — line forms fast', days: [5] },
            { name: 'Brooklyn Museum First Saturday', type: 'museum', location: '200 Eastern Pkwy, Brooklyn', time: '5-11 PM', description: 'Free admission + DJ sets, film screenings, hands-on art workshops, and cocktails', tip: 'Check brooklynmuseum.org for this month\'s theme', days: [6] },
            { name: 'SummerStage Concert', type: 'concert', location: 'Central Park', time: '7 PM', description: 'Free live music in the park — indie rock, hip-hop, Latin, jazz', tip: 'Bring a blanket and snacks', days: [4, 5, 6] },
            { name: 'Brooklyn Bridge Walk', type: 'tour', location: 'City Hall to DUMBO', time: 'Anytime', description: 'Self-guided walk across the iconic bridge with skyline views', tip: 'Go at sunset for golden hour photos' },
            { name: 'Staten Island Ferry', type: 'tour', location: 'Whitehall Terminal', time: '24/7, every 30 min', description: 'Free ferry ride with Statue of Liberty and harbor views' },
            { name: 'NYPL Exhibition', type: 'library', location: '42nd St & 5th Ave', time: '10 AM-6 PM', description: 'Free exhibitions in the stunning Beaux-Arts main branch' },
            { name: 'High Line Walk', type: 'park', location: 'Gansevoort to 34th St', time: '7 AM-10 PM', description: 'Elevated park on a former rail line with art installations and city views' },
            { name: 'Sunday Jazz at National Sawdust', type: 'concert', location: 'Williamsburg, Brooklyn', time: '2 PM', description: 'Free Sunday afternoon jazz sessions in Brooklyn\'s coolest music venue', days: [0] },
        ],
        alwaysFree: ['Central Park', 'Brooklyn Bridge Park', 'The High Line', 'Staten Island Ferry', 'NYPL Main Branch', 'Grand Central Terminal tour']
    },
    'los angeles': {
        activities: [
            { name: 'The Getty Center', type: 'museum', location: 'Brentwood', time: '10 AM-5:30 PM', description: 'World-class art museum with stunning architecture and gardens — always free', tip: 'Parking is $20 but museum is free' },
            { name: 'Griffith Observatory', type: 'tour', location: 'Griffith Park', time: '12-10 PM', description: 'Free observatory with telescope viewing, exhibits, and Hollywood Sign views' },
            { name: 'LACMA Free Second Tuesday', type: 'museum', location: 'Wilshire Blvd', time: '11 AM-5 PM', description: 'Free entry to LA\'s largest art museum on the second Tuesday of each month', days: [2] },
            { name: 'Venice Beach Boardwalk', type: 'park', location: 'Venice', time: 'All day', description: 'Street performers, Muscle Beach, skate park, murals — endless free entertainment' },
            { name: 'Hollywood Forever Cemetery', type: 'tour', location: 'Santa Monica Blvd', time: '8 AM-5 PM', description: 'Free self-guided tour past graves of Hollywood legends' },
            { name: 'Free Yoga at Runyon Canyon', type: 'class', location: 'Runyon Canyon, Hollywood Hills', time: '9 AM', description: 'Free outdoor yoga with panoramic city views', days: [0, 6] },
            { name: 'First Friday Art Walk on Abbot Kinney', type: 'festival', location: 'Abbot Kinney Blvd, Venice', time: '5-10 PM', description: 'Gallery openings, live music, food trucks — LA\'s best free street event', days: [5] },
        ],
        alwaysFree: ['The Getty Center', 'Griffith Observatory', 'Venice Beach', 'Santa Monica Pier', 'The Broad (with reservation)', 'Runyon Canyon hike']
    },
    'chicago': {
        activities: [
            { name: 'Art Institute Free Thursday Evening', type: 'museum', location: '111 S Michigan Ave', time: '5-8 PM', description: 'Free evening admission — Seurat, Monet, Hopper, American Gothic, and more', tip: 'Illinois residents only — bring ID', days: [4] },
            { name: 'Millennium Park Concert', type: 'concert', location: 'Pritzker Pavilion', time: '6:30 PM', description: 'Free classical, jazz, or world music at the stunning outdoor pavilion', days: [3, 4, 5] },
            { name: 'Lincoln Park Zoo', type: 'park', location: 'Lincoln Park', time: '10 AM-5 PM', description: 'One of the last free zoos in the US — always free, 365 days a year' },
            { name: 'Chicago Cultural Center', type: 'museum', location: 'Washington & Michigan', time: '10 AM-5 PM', description: 'Free exhibits under the world\'s largest Tiffany dome' },
            { name: 'Lakefront Trail Walk', type: 'park', location: 'Lake Michigan', time: 'Anytime', description: '18-mile trail along the lake with skyline views, beaches, and public art' },
            { name: 'Free Saturday Yoga in Millennium Park', type: 'class', location: 'Great Lawn, Millennium Park', time: '8 AM', description: 'Free outdoor yoga with skyline views. Bring your own mat.', days: [6] },
            { name: 'Maxwell Street Market (Sunday)', type: 'festival', location: '800 S Desplaines St', time: '7 AM-3 PM', description: 'Free entry to Chicago\'s legendary street market — Mexican street food and live blues', days: [0] },
        ],
        alwaysFree: ['Lincoln Park Zoo', 'Millennium Park/Cloud Gate', 'Chicago Cultural Center', 'Lakefront Trail', 'Navy Pier (entry)', 'Garfield Park Conservatory']
    },
    'london': {
        activities: [
            { name: 'British Museum', type: 'museum', location: 'Bloomsbury', time: '10 AM-5 PM', description: 'World-famous museum with Rosetta Stone, Egyptian mummies — always free' },
            { name: 'Tate Modern', type: 'museum', location: 'Bankside', time: '10 AM-6 PM', description: 'Free modern art in a converted power station on the Thames' },
            { name: 'Changing of the Guard', type: 'tour', location: 'Buckingham Palace', time: '11 AM', description: 'Free iconic ceremony with the King\'s Guard in full dress uniform', days: [1, 3, 5, 0] },
            { name: 'Hyde Park & Speakers Corner', type: 'park', location: 'Westminster', time: 'All day', description: 'Royal park with boating lake, Diana Memorial, and famous Speakers Corner' },
            { name: 'National Gallery', type: 'museum', location: 'Trafalgar Square', time: '10 AM-6 PM', description: 'Free entry to masterworks by Van Gogh, Monet, Da Vinci, and more' },
            { name: 'Friday Night at the V&A', type: 'museum', location: 'South Kensington', time: '6:30-10 PM', description: 'Free late-night museum with DJs, talks, exhibitions, and cocktails', days: [5] },
            { name: 'Columbia Road Flower Market', type: 'festival', location: 'Columbia Rd, Shoreditch', time: '8 AM-3 PM', description: 'Stunning Sunday flower market — buy blooms, browse indie shops, sip coffee', days: [0] },
            { name: 'Southbank Centre Free Foyer Music', type: 'concert', location: 'Royal Festival Hall', time: '12-2 PM', description: 'Free lunchtime concerts — jazz, classical, world music', days: [1, 2, 3, 4, 5] },
        ],
        alwaysFree: ['British Museum', 'National Gallery', 'Tate Modern', 'V&A Museum', 'Natural History Museum', 'Science Museum', 'Hyde Park']
    },
    'paris': {
        activities: [
            { name: 'Sacré-Cœur & Montmartre', type: 'tour', location: '18th arr.', time: '6 AM-10:30 PM', description: 'Free entry to the basilica with panoramic views of Paris from the steps' },
            { name: 'First Sunday Free Museums', type: 'museum', location: 'Louvre, Orsay, Pompidou, etc.', time: '10 AM-6 PM', description: 'Louvre, Orsay, Pompidou, Orangerie, and 30+ museums are FREE on the first Sunday!', days: [0] },
            { name: 'Jardin du Luxembourg', type: 'park', location: '6th arr.', time: '7:30 AM-dusk', description: 'Stunning palace gardens with fountains, orchards, and free chairs to relax in' },
            { name: 'Père Lachaise Cemetery', type: 'tour', location: '20th arr.', time: '8 AM-6 PM', description: 'Free stroll among graves of Jim Morrison, Oscar Wilde, Edith Piaf' },
            { name: 'Paris Plages', type: 'festival', location: 'Seine riverbank', time: '9 AM-midnight (summer)', description: 'Free pop-up beaches along the Seine with sand, deckchairs, and activities', days: [0, 1, 2, 3, 4, 5, 6] },
            { name: 'Free Walking Tour — Le Marais', type: 'tour', location: 'Hôtel de Ville Métro', time: '10:30 AM', description: 'Free 2-hour tour through medieval streets, hidden courtyards, and Jewish quarter' },
            { name: 'Saturday Steps of Sacré-Cœur', type: 'concert', location: 'Montmartre', time: '8 PM-midnight', description: 'Free open-air gathering with street musicians, wine sellers, and panoramic night views', days: [6] },
        ],
        alwaysFree: ['Notre-Dame exterior', 'Sacré-Cœur Basilica', 'Jardin du Luxembourg', 'Tuileries Garden', 'Père Lachaise', 'Canal Saint-Martin walk']
    },
    'tokyo': {
        activities: [
            { name: 'Meiji Shrine', type: 'tour', location: 'Shibuya', time: 'Sunrise-sunset', description: 'Free entry to Tokyo\'s most famous Shinto shrine in a tranquil forest' },
            { name: 'Senso-ji Temple', type: 'tour', location: 'Asakusa', time: '6 AM-5 PM', description: 'Free entry to Tokyo\'s oldest temple with vibrant Nakamise shopping street' },
            { name: 'Tsukiji Outer Market', type: 'tour', location: 'Tsukiji', time: '5 AM-2 PM', description: 'Free to browse — sample street food from Japan\'s famous fish market area' },
            { name: 'Shibuya Crossing', type: 'tour', location: 'Shibuya', time: 'Anytime', description: 'Experience the world\'s busiest intersection — best viewed from Starbucks above' },
            { name: 'Yoyogi Park', type: 'park', location: 'Harajuku', time: 'All day', description: 'Free park where Tokyo\'s subcultures gather on weekends — cosplay, bands, dance groups', days: [0, 6] },
            { name: 'Sunday Meiji Shrine Antique Market', type: 'festival', location: 'Meiji Shrine Outer Gardens', time: '9 AM-4 PM', description: 'Free antique and craft market — vintage kimono, pottery, handmade goods', days: [0] },
        ],
        alwaysFree: ['Meiji Shrine', 'Senso-ji Temple', 'Imperial Palace East Gardens', 'Shibuya Crossing', 'Harajuku street fashion', 'Yoyogi Park']
    }
};
const DEFAULT_FREE = {
    activities: [
        { name: 'Public Library Events', type: 'library', location: 'Main Library', time: '10 AM-8 PM', description: 'Free book clubs, workshops, movie screenings, and community events' },
        { name: 'City Park Walk', type: 'park', location: 'Central Park', time: 'Dawn to dusk', description: 'Free walking trails, playgrounds, picnic areas, and nature exploration' },
        { name: 'Community Concert Series', type: 'concert', location: 'Town Square', time: '6 PM', description: 'Free live music featuring local bands and performers', days: [5, 6] },
        { name: 'Art Gallery First Friday', type: 'museum', location: 'Arts District', time: '5-9 PM', description: 'Free gallery openings with wine, snacks, and local art', days: [5] },
        { name: 'Sunday Farmers Market', type: 'festival', location: 'Downtown', time: '9 AM-2 PM', description: 'Free entry — browse local produce, artisan crafts, and food samples', days: [0] },
        { name: 'Weekend Outdoor Fitness', type: 'class', location: 'Main City Park', time: '8 AM', description: 'Free community fitness — yoga, bootcamp, or running club', days: [0, 6] },
    ],
    alwaysFree: ['Public parks', 'Library programs', 'Window shopping', 'People watching', 'Community bulletin boards for events']
};
function mapsUrl(name, city) {
    return `https://maps.google.com/?q=${encodeURIComponent(name + ', ' + city)}`;
}
function matchCity(city) {
    const resolved = (0, location_aliases_1.resolveLocation)(city, Object.keys(CITY_FREE), true);
    return resolved
        ? { ...CITY_FREE[resolved], isDefault: false }
        : { ...DEFAULT_FREE, isDefault: true };
}
exports.freeStuffService = {
    async getFreeStuff(city, rightNow, localHour) {
        await new Promise(r => setTimeout(r, 150));
        const dow = dayOfWeek();
        const matched = matchCity(city);
        // Filter activities to those available today
        let available = matched.activities.filter(a => !a.days || a.days.includes(dow));
        // Right Now mode: only show activities happening now or in the next 2 hours
        if (rightNow) {
            const { isActiveNow } = await Promise.resolve().then(() => __importStar(require('./time_utils')));
            available = available.filter(a => isActiveNow(a.time, localHour));
        }
        // Add Google Maps URLs (pre-formatted markdown for AI to use directly)
        const activitiesWithUrls = available.map(a => {
            const url = mapsUrl(a.name, city);
            return { ...a, url, link: `[${a.name}](${url})` };
        });
        // Build today's highlights for day-specific free stuff
        const todayHighlights = [];
        available.forEach(a => {
            if (a.days && a.days.length <= 3) {
                todayHighlights.push(`🆓 ${a.name} — FREE today (${dayName()} only)!`);
            }
        });
        return {
            success: true,
            data: {
                city,
                dayInfo: `Today is ${todayStr()}`,
                todayHighlights,
                activities: activitiesWithUrls,
                alwaysFree: matched.alwaysFree,
                resourceLinks: {
                    freeEvents: `https://eventbrite.com/d/${encodeURIComponent(city)}/free--events--today/`,
                },
            },
            ...(matched.isDefault && { note: `No local data for "${city}". These are generic placeholders — use your own knowledge of real free activities in ${city}.` })
        };
    }
};
