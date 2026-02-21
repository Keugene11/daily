"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeToolCall = exports.tools = void 0;
const weather_1 = require("./apis/weather");
const events_1 = require("./apis/events");
const news_1 = require("./apis/news");
const restaurants_1 = require("./apis/restaurants");
const spotify_1 = require("./apis/spotify");
const transit_1 = require("./apis/transit");
const gas_prices_1 = require("./apis/gas_prices");
const happy_hours_1 = require("./apis/happy_hours");
const free_stuff_1 = require("./apis/free_stuff");
const sunrise_sunset_1 = require("./apis/sunrise_sunset");
const pollen_1 = require("./apis/pollen");
const parking_1 = require("./apis/parking");
const transit_routes_1 = require("./apis/transit_routes");
const wait_times_1 = require("./apis/wait_times");
const deals_1 = require("./apis/deals");
const accommodations_1 = require("./apis/accommodations");
exports.tools = [
    {
        type: 'function',
        function: {
            name: 'get_weather',
            description: 'Get detailed current weather for a city. Returns temperature (°C/°F), feels-like, condition, humidity, wind speed/direction/gusts, precipitation (rain/snow/storm chances), UV index, visibility, sunrise/sunset, and hourly forecast. Use this data to give specific weather advice in the itinerary.',
            parameters: {
                type: 'object',
                properties: {
                    city: {
                        type: 'string',
                        description: 'City name (e.g., "San Francisco", "London", "Tokyo")'
                    }
                },
                required: ['city']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_local_events',
            description: 'Find local events happening today in a specific city. Day-aware — only returns events available on today\'s day of the week (e.g., Saturday markets, Friday free museum nights). Highlights free and discounted events with todayHighlights.',
            parameters: {
                type: 'object',
                properties: {
                    city: {
                        type: 'string',
                        description: 'City name where to search for events'
                    }
                },
                required: ['city']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_trending_news',
            description: 'Get trending news topics and headlines for today. Use this to help users stay informed about current events and interesting stories.',
            parameters: {
                type: 'object',
                properties: {
                    city: {
                        type: 'string',
                        description: 'City or region for localized news (optional)'
                    }
                },
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_restaurant_recommendations',
            description: 'Get restaurant recommendations for a city. Returns curated dining options with cuisine type, price range, and ratings.',
            parameters: {
                type: 'object',
                properties: {
                    city: {
                        type: 'string',
                        description: 'City name for restaurant search'
                    },
                    cuisine: {
                        type: 'string',
                        description: 'Preferred cuisine type (optional)'
                    },
                    budget: {
                        type: 'string',
                        description: 'Budget level: "low", "medium", "high"',
                        enum: ['low', 'medium', 'high']
                    }
                },
                required: ['city']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_playlist_suggestion',
            description: 'Generate a Spotify playlist suggestion based on the city and mood. Returns a themed playlist with tracks that match the location\'s musical culture and vibe. Always pass the city so the playlist fits the destination.',
            parameters: {
                type: 'object',
                properties: {
                    city: {
                        type: 'string',
                        description: 'City name — used to pick location-appropriate music (e.g., jazz for New Orleans, bossa nova for Rio)'
                    },
                    mood: {
                        type: 'string',
                        description: 'Desired mood for the playlist (optional)'
                    }
                },
                required: ['city']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_transit_estimates',
            description: 'Get estimated travel times between locations in a city. Returns walking, transit, and driving times.',
            parameters: {
                type: 'object',
                properties: {
                    city: {
                        type: 'string',
                        description: 'City name'
                    },
                    from: {
                        type: 'string',
                        description: 'Starting location or area'
                    },
                    to: {
                        type: 'string',
                        description: 'Destination location or area'
                    }
                },
                required: ['city', 'from', 'to']
            }
        }
    },
    // ── New tools ──────────────────────────────────────────────────────────
    {
        type: 'function',
        function: {
            name: 'get_gas_prices',
            description: 'Get local gas/fuel prices for a city. Returns nearby stations with regular, midgrade, premium, and diesel prices. Use when the itinerary includes driving activities or road trips.',
            parameters: {
                type: 'object',
                properties: {
                    city: {
                        type: 'string',
                        description: 'City name to search gas prices'
                    }
                },
                required: ['city']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_happy_hours',
            description: 'Find happy hour drink and food specials at local bars and restaurants. Returns bars with deal details, hours, and vibe descriptions. Great for evening/nightlife planning.',
            parameters: {
                type: 'object',
                properties: {
                    city: {
                        type: 'string',
                        description: 'City name to search for happy hours'
                    }
                },
                required: ['city']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_free_stuff',
            description: 'Find free activities and attractions available TODAY — free museum days, concerts, parks, tours, and more. Day-aware: only shows free activities available on today\'s day of the week (e.g., MoMA free Fridays, Sunday markets). Returns todayHighlights for day-specific free events.',
            parameters: {
                type: 'object',
                properties: {
                    city: {
                        type: 'string',
                        description: 'City name to search for free activities'
                    }
                },
                required: ['city']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_sunrise_sunset',
            description: 'Get sunrise, sunset, golden hour, and blue hour times for a city. Also returns recommended photo spots and timing tips for optimal experiences. Use to schedule golden-hour activities, sunset dinner reservations, or photography outings.',
            parameters: {
                type: 'object',
                properties: {
                    city: {
                        type: 'string',
                        description: 'City name'
                    }
                },
                required: ['city']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_pollen_count',
            description: 'Get pollen and air quality data for a city. Returns tree, grass, weed, and mold levels plus air quality index. Use to warn allergy sufferers before outdoor plans and suggest best times to be outside.',
            parameters: {
                type: 'object',
                properties: {
                    city: {
                        type: 'string',
                        description: 'City name'
                    }
                },
                required: ['city']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_parking',
            description: 'Find parking availability and costs near a specific area. Returns garages, lots, street parking, and park-and-ride options with rates and availability.',
            parameters: {
                type: 'object',
                properties: {
                    city: {
                        type: 'string',
                        description: 'City name'
                    },
                    area: {
                        type: 'string',
                        description: 'Neighborhood or area to search near (e.g., "Midtown", "Downtown", "Hollywood")'
                    }
                },
                required: ['city']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_public_transit_routes',
            description: 'Get step-by-step public transit directions between two locations. Returns detailed routes with specific subway/bus lines, walking segments, durations, costs, and local transit tips.',
            parameters: {
                type: 'object',
                properties: {
                    city: {
                        type: 'string',
                        description: 'City name'
                    },
                    from: {
                        type: 'string',
                        description: 'Starting location'
                    },
                    to: {
                        type: 'string',
                        description: 'Destination'
                    }
                },
                required: ['city', 'from', 'to']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_wait_times',
            description: 'Get estimated wait times for restaurants, attractions, and popular venues in a city. Returns current waits, best times to visit, and tips to skip lines.',
            parameters: {
                type: 'object',
                properties: {
                    city: {
                        type: 'string',
                        description: 'City name'
                    },
                    venue: {
                        type: 'string',
                        description: 'Specific venue name or type to check (optional)'
                    }
                },
                required: ['city']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_deals_coupons',
            description: 'Find deals, coupons, and discount passes available TODAY. Day-aware: filters to deals valid on today\'s day of the week (e.g., Taco Tuesday, Thursday late-night museum discounts, Sunday brunch specials). Returns todayDeals highlights for day-specific savings.',
            parameters: {
                type: 'object',
                properties: {
                    city: {
                        type: 'string',
                        description: 'City name'
                    },
                    category: {
                        type: 'string',
                        description: 'Category to filter: "food", "attractions", "entertainment", "transport", "culture" (optional)'
                    }
                },
                required: ['city']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_accommodations',
            description: 'Get accommodation recommendations for a city. Returns curated options from budget hostels to luxury hotels with prices, ratings, and neighborhoods.',
            parameters: {
                type: 'object',
                properties: {
                    city: {
                        type: 'string',
                        description: 'City name to search for accommodations'
                    },
                    budget: {
                        type: 'string',
                        description: 'Budget level: "low", "medium", "high"',
                        enum: ['low', 'medium', 'high']
                    },
                    type: {
                        type: 'string',
                        description: 'Accommodation type preference',
                        enum: ['hotel', 'hostel', 'boutique', 'apartment']
                    }
                },
                required: ['city']
            }
        }
    },
];
/**
 * Execute a tool call and return the result
 * All tools follow the same error handling pattern
 */
const executeToolCall = async (toolName, args, context) => {
    console.log(`[Tool Execution] ${toolName} with args:`, JSON.stringify(args));
    try {
        switch (toolName) {
            case 'get_weather':
                return await weather_1.weatherService.getWeather(args.city);
            case 'get_local_events':
                return await events_1.eventsService.getEvents(args.city, context?.rightNow, context?.currentHour);
            case 'get_trending_news':
                return await news_1.newsService.getNews(args.city);
            case 'get_restaurant_recommendations':
                return await restaurants_1.restaurantService.getRestaurants(args.city, args.cuisine, args.budget);
            case 'get_playlist_suggestion':
                return await spotify_1.spotifyService.getPlaylist(args.city || '', args.mood);
            case 'get_transit_estimates':
                return await transit_1.transitService.getTransitEstimates(args.city, args.from, args.to);
            case 'get_gas_prices':
                return await gas_prices_1.gasPriceService.getGasPrices(args.city);
            case 'get_happy_hours':
                return await happy_hours_1.happyHourService.getHappyHours(args.city, context?.rightNow, context?.currentHour);
            case 'get_free_stuff':
                return await free_stuff_1.freeStuffService.getFreeStuff(args.city, context?.rightNow, context?.currentHour);
            case 'get_sunrise_sunset':
                return await sunrise_sunset_1.sunriseSunsetService.getSunriseSunset(args.city);
            case 'get_pollen_count':
                return await pollen_1.pollenService.getPollenCount(args.city);
            case 'get_parking':
                return await parking_1.parkingService.getParking(args.city, args.area || '');
            case 'get_public_transit_routes':
                return await transit_routes_1.transitRouteService.getTransitRoutes(args.city, args.from, args.to);
            case 'get_wait_times':
                return await wait_times_1.waitTimeService.getWaitTimes(args.city, args.venue);
            case 'get_deals_coupons':
                return await deals_1.dealsService.getDeals(args.city, args.category, context?.rightNow, context?.currentHour);
            case 'get_accommodations':
                return await accommodations_1.accommodationService.getAccommodations(args.city, args.budget, args.type);
            default:
                return {
                    success: false,
                    error: `Unknown tool: ${toolName}`
                };
        }
    }
    catch (error) {
        console.error(`[Tool Execution Error] ${toolName}:`, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
};
exports.executeToolCall = executeToolCall;
