"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Smoke test: run key services against popular tourist cities
 * Usage: npx tsx src/test-cities.ts
 */
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const restaurants_1 = require("./services/apis/restaurants");
const events_1 = require("./services/apis/events");
const free_stuff_1 = require("./services/apis/free_stuff");
const accommodations_1 = require("./services/apis/accommodations");
const happy_hours_1 = require("./services/apis/happy_hours");
const deals_1 = require("./services/apis/deals");
const CITIES = [
    'Miami', 'New York', 'Los Angeles', 'Chicago', 'London', 'Paris',
    'Tokyo', 'Barcelona', 'San Francisco', 'Austin', 'Nashville',
    'Seoul', 'Berlin', 'Amsterdam', 'Rome', 'Sydney',
    // Aliases
    'NYC', 'LA', 'SF', 'NOLA',
    // Less common cities (should still work with defaults)
    'Reykjavik', 'Marrakech', 'Cape Town', 'Lisbon',
];
const results = [];
function check(city, service, ok, issue) {
    results.push({ city, service, ok, issue });
    if (!ok)
        console.log(`  FAIL  ${service}: ${issue}`);
}
async function testCity(city) {
    console.log(`\n--- ${city} ---`);
    // Restaurants
    try {
        const res = await restaurants_1.restaurantService.getRestaurants(city);
        const restaurants = res.data || [];
        check(city, 'restaurants', res.success && restaurants.length > 0, `got ${restaurants.length} restaurants`);
        for (const r of restaurants.slice(0, 3)) {
            if (!r.name || r.name.includes('Local Favorite') || r.name.includes('Popular')) {
                check(city, 'restaurants:quality', false, `generic name: "${r.name}"`);
            }
        }
    }
    catch (e) {
        check(city, 'restaurants', false, e.message);
    }
    // Events
    try {
        const res = await events_1.eventsService.getEvents(city);
        check(city, 'events', res.success, !res.success ? 'failed' : undefined);
    }
    catch (e) {
        check(city, 'events', false, e.message);
    }
    // Free stuff
    try {
        const res = await free_stuff_1.freeStuffService.getFreeStuff(city);
        const activities = res.data?.activities || [];
        check(city, 'freeStuff', res.success && activities.length > 0, `got ${activities.length} activities`);
    }
    catch (e) {
        check(city, 'freeStuff', false, e.message);
    }
    // Accommodations
    try {
        const res = await accommodations_1.accommodationService.getAccommodations(city);
        const accomms = res.data || [];
        check(city, 'accommodations', res.success && accomms.length > 0, `got ${accomms.length} accommodations`);
        for (const a of accomms.slice(0, 3)) {
            if (!a.url && !a.link) {
                check(city, 'accommodations:links', false, `no url for "${a.name}"`);
            }
        }
    }
    catch (e) {
        check(city, 'accommodations', false, e.message);
    }
    // Happy hours
    try {
        const res = await happy_hours_1.happyHourService.getHappyHours(city);
        check(city, 'happyHours', res.success, !res.success ? 'failed' : undefined);
    }
    catch (e) {
        check(city, 'happyHours', false, e.message);
    }
    // Deals
    try {
        const res = await deals_1.dealsService.getDeals(city);
        check(city, 'deals', res.success, !res.success ? 'failed' : undefined);
    }
    catch (e) {
        check(city, 'deals', false, e.message);
    }
}
async function main() {
    console.log(`Testing ${CITIES.length} cities across 6 services...\n`);
    for (const city of CITIES) {
        await testCity(city);
    }
    // Summary
    const fails = results.filter(r => !r.ok);
    console.log('\n' + '='.repeat(60));
    console.log(`RESULTS: ${results.length - fails.length}/${results.length} passed`);
    if (fails.length > 0) {
        console.log(`\nFAILURES (${fails.length}):`);
        for (const f of fails) {
            console.log(`  ${f.city} | ${f.service} | ${f.issue}`);
        }
    }
    else {
        console.log('\nAll tests passed!');
    }
    console.log('='.repeat(60));
}
main().catch(console.error);
