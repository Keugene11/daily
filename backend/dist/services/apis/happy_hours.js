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
exports.happyHourService = void 0;
const location_aliases_1 = require("./location_aliases");
const CITY_HH = {
    'new york': {
        city: 'New York',
        happyHours: [
            { bar: 'The Dead Rabbit', address: 'Water St, FiDi', hours: '4-7 PM', deals: ['$8 craft cocktails', '$5 draft beers', '$1 oysters'], vibe: 'Irish pub meets craft cocktail bar', rating: 4.7 },
            { bar: 'Rudy\'s Bar & Grill', address: '9th Ave, Hell\'s Kitchen', hours: '3-7 PM', deals: ['$4 pitchers of Rudy\'s Blonde', 'Free hot dogs all day'], vibe: 'Legendary dive bar, cash only', rating: 4.3 },
            { bar: 'Amor y Amargo', address: 'E 6th St, East Village', hours: '5-7 PM', deals: ['$10 amaro cocktails', '$7 bitters & soda'], vibe: 'Cozy bitters-focused speakeasy', rating: 4.6 },
            { bar: 'The Pony Bar', address: 'UES / Hell\'s Kitchen', hours: '4-7 PM', deals: ['$2 off all drafts', '$6 well drinks'], vibe: 'All-American craft beer haven', rating: 4.4 }
        ],
        tip: 'NYC banned actual "happy hour" pricing in bars — but many do "reverse happy hour" or food specials. East Village & Hell\'s Kitchen have the best deals.'
    },
    'los angeles': {
        city: 'Los Angeles',
        happyHours: [
            { bar: 'El Carmen', address: 'W 3rd St', hours: '5-7 PM', deals: ['$7 margaritas', '$5 tequila shots', 'Half-price guacamole'], vibe: 'Lucha libre-themed tequila bar', rating: 4.5 },
            { bar: 'The Bungalow', address: 'Pacific Coast Hwy, Santa Monica', hours: '4-7 PM', deals: ['$9 cocktails', '$6 beers', '$8 rosé'], vibe: 'Beach house party vibes', rating: 4.3 },
            { bar: 'HMS Bounty', address: 'Wilshire Blvd, Koreatown', hours: '3-7 PM', deals: ['$4.50 wells', '$3.50 beers', '$5 martinis'], vibe: 'Retro nautical dive since 1962', rating: 4.4 },
            { bar: 'Accomplice Bar', address: 'Hollywood Blvd', hours: '5-8 PM', deals: ['$8 cocktails', '$5 drafts', 'Half-price appetizers'], vibe: 'Speakeasy hidden behind a bookshelf', rating: 4.6 }
        ],
        tip: 'LA happy hours are generous — most run 4-7 PM. Koreatown has the cheapest drinks in the city.'
    },
    'chicago': {
        city: 'Chicago',
        happyHours: [
            { bar: 'The Berkshire Room', address: 'ACME Hotel, River North', hours: '4-6 PM', deals: ['$9 classic cocktails', '$6 beers', '$8 wines'], vibe: 'Vintage-chic hotel cocktail lounge', rating: 4.5 },
            { bar: 'Kaiser Tiger', address: 'Randolph St, West Loop', hours: '3-6 PM', deals: ['$5 steins', '$4 shots', '$6 brats'], vibe: 'German beer garden with fire pits', rating: 4.4 },
            { bar: 'The Owl', address: 'Logan Square', hours: '5-7 PM', deals: ['$3 Hamm\'s tallboys', '$5 whiskey specials', 'Free popcorn'], vibe: 'Neighborhood dive with great jukebox', rating: 4.2 },
            { bar: 'Arbella', address: 'Hubbard St, River North', hours: '4-6:30 PM', deals: ['$8 cocktails', '$5 beers', 'Half-price oysters'], vibe: 'Mediterranean-inspired cocktail bar', rating: 4.5 }
        ],
        tip: 'Chicago has incredible happy hour culture. West Loop and Logan Square are the sweet spots for value.'
    },
    'miami': {
        city: 'Miami',
        happyHours: [
            { bar: 'Bodega Taqueria y Tequila', address: 'South Beach', hours: '4-7 PM', deals: ['$5 margaritas', '$3 tacos', '$4 tequila shots'], vibe: 'Hidden speakeasy behind a taco stand', rating: 4.6 },
            { bar: 'Broken Shaker', address: 'Freehand Miami', hours: '5-7 PM', deals: ['$9 cocktails', '$5 beer & wine'], vibe: 'Award-winning tropical garden bar', rating: 4.7 },
            { bar: 'Mama Tried', address: 'Wynwood', hours: '4-7 PM', deals: ['$5 wells', '$4 longnecks', '$6 frozen drinks'], vibe: 'Honky-tonk meets Miami heat', rating: 4.3 },
            { bar: 'Sweet Liberty', address: 'Collins Ave, South Beach', hours: '4-7 PM', deals: ['$8 cocktails', 'Half-price snacks'], vibe: 'Top 50 bar with beachy energy', rating: 4.8 }
        ],
        tip: 'Miami happy hours are best in Wynwood and South Beach. Many places do "late night happy hour" from 11 PM-1 AM too.'
    },
    'nashville': {
        city: 'Nashville',
        happyHours: [
            { bar: 'Robert\'s Western World', address: 'Broadway', hours: '3-6 PM', deals: ['$3 PBR', '$5 wells', 'Free live music all day'], vibe: 'Legendary honky-tonk, no cover', rating: 4.7 },
            { bar: 'The Patterson House', address: '12 South', hours: '5-7 PM', deals: ['$9 craft cocktails', '$6 beer & wine'], vibe: 'Speakeasy-style craft cocktail lounge', rating: 4.6 },
            { bar: 'Pinewood Social', address: 'Chestnut St', hours: '3-6 PM', deals: ['$6 cocktails', '$4 beers', '$2 bowling'], vibe: 'Bar + bowling + pool + coffee shop', rating: 4.5 },
            { bar: 'Dino\'s', address: 'Gallatin Ave, East Nashville', hours: '5-7 PM', deals: ['$2 Hamm\'s', '$4 shots', '$6 burgers'], vibe: 'Beloved dive bar with smash burgers', rating: 4.4 }
        ],
        tip: 'Lower Broadway bars rarely have happy hours but never charge cover. For deals, head to East Nashville or 12 South.'
    }
};
const DEFAULT_HH = {
    city: 'Local',
    happyHours: [
        { bar: 'The Corner Tap', address: 'Main St & 3rd', hours: '4-7 PM', deals: ['$5 wells', '$3 draft beers', 'Half-price appetizers'], vibe: 'Classic neighborhood hangout', rating: 4.3 },
        { bar: 'Sunset Lounge', address: 'Oak Ave', hours: '5-7 PM', deals: ['$7 cocktails', '$4 house wine', '$5 sliders'], vibe: 'Relaxed rooftop bar', rating: 4.4 },
        { bar: 'The Dive', address: 'Downtown', hours: '3-6 PM', deals: ['$2 PBR tallboys', '$4 shots', 'Free popcorn'], vibe: 'No-frills dive with character', rating: 4.1 }
    ],
    tip: 'Happy hours typically run 4-7 PM on weekdays. Check Yelp for today\'s specials.'
};
function matchCity(city) {
    const resolved = (0, location_aliases_1.resolveLocation)(city, Object.keys(CITY_HH), true);
    if (resolved)
        return { ...CITY_HH[resolved], city, isDefault: false };
    return { ...DEFAULT_HH, city, isDefault: true };
}
function mapsUrl(name, city) {
    return `https://maps.google.com/?q=${encodeURIComponent(name + ', ' + city)}`;
}
exports.happyHourService = {
    async getHappyHours(city, rightNow, localHour) {
        await new Promise(r => setTimeout(r, 150));
        const data = matchCity(city);
        // Right Now mode: only show happy hours active now or starting within 2 hours
        if (rightNow) {
            const { isActiveNow } = await Promise.resolve().then(() => __importStar(require('./time_utils')));
            data.happyHours = data.happyHours.filter(hh => isActiveNow(hh.hours, localHour));
        }
        // Add Google Maps URLs (pre-formatted markdown for AI to use directly)
        const withUrls = data.happyHours.map(hh => {
            const url = mapsUrl(hh.bar, data.city);
            return { ...hh, url, link: `[${hh.bar}](${url})` };
        });
        const { isDefault, ...rest } = data;
        return {
            success: true,
            data: { ...rest, happyHours: withUrls },
            ...(isDefault && { note: `No local happy hour data for "${city}". These are generic placeholders — use your own knowledge of real bars and happy hours in ${city}.` })
        };
    }
};
