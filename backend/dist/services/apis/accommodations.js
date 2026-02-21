"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.accommodationService = void 0;
const location_aliases_1 = require("./location_aliases");
const CITY_ACCOMMODATIONS = {
    'new york': [
        { name: 'The Jane Hotel', type: 'boutique', priceRange: '$', avgNight: '$120/night', rating: '4.2/5', neighborhood: 'West Village', description: 'Former sailors\' home turned hip hotel with tiny cabin rooms and a killer rooftop bar', highlight: 'Rooftop Ballroom bar with Manhattan views' },
        { name: 'Pod 51', type: 'hotel', priceRange: '$', avgNight: '$100/night', rating: '4.0/5', neighborhood: 'Midtown East', description: 'Compact micro-rooms with everything you need. Rooftop deck open in summer', highlight: 'Central location steps from Rockefeller Center' },
        { name: 'HI New York City Hostel', type: 'hostel', priceRange: '$', avgNight: '$55/night', rating: '4.3/5', neighborhood: 'Upper West Side', description: 'Huge hostel in a landmark building on the UWS. Free events, community kitchen, great common areas', highlight: 'Free walking tours and pub crawls' },
        { name: 'The Ludlow Hotel', type: 'boutique', priceRange: '$$$', avgNight: '$350/night', rating: '4.6/5', neighborhood: 'Lower East Side', description: 'Industrial-chic boutique with floor-to-ceiling windows, vinyl players in rooms, and Dirty French downstairs', highlight: 'Lobby bar scene and LES nightlife at your door' },
        { name: 'citizenM New York Bowery', type: 'hotel', priceRange: '$$', avgNight: '$200/night', rating: '4.5/5', neighborhood: 'Bowery', description: 'Tech-forward rooms with mood lighting you control from a tablet. Amazing rooftop bar', highlight: 'CloudM rooftop with 360° skyline views' },
        { name: 'The Plaza', type: 'hotel', priceRange: '$$$$', avgNight: '$800/night', rating: '4.7/5', neighborhood: 'Central Park South', description: 'The iconic NYC luxury hotel since 1907. Gold leaf ceilings, butler service, overlooking Central Park', highlight: 'Afternoon tea at The Palm Court' },
        { name: 'Sonder Battery Park', type: 'apartment', priceRange: '$$', avgNight: '$180/night', rating: '4.4/5', neighborhood: 'Financial District', description: 'Stylish apartment-style suites with kitchenettes near the Statue of Liberty ferry', highlight: 'Full kitchen and washer/dryer in unit' }
    ],
    'los angeles': [
        { name: 'Freehand Los Angeles', type: 'hostel', priceRange: '$', avgNight: '$45/night', rating: '4.4/5', neighborhood: 'Downtown', description: 'Part hostel, part hotel with a rooftop pool and the excellent Broken Shaker cocktail bar', highlight: 'Rooftop pool and Broken Shaker bar' },
        { name: 'The Line Hotel', type: 'boutique', priceRange: '$$', avgNight: '$220/night', rating: '4.3/5', neighborhood: 'Koreatown', description: 'Converted mid-century building in K-Town with Roy Choi\'s Commissary restaurant and a greenhouse lobby', highlight: 'Roy Choi\'s Commissary restaurant on-site' },
        { name: 'Mama Shelter Los Angeles', type: 'boutique', priceRange: '$$', avgNight: '$180/night', rating: '4.2/5', neighborhood: 'Hollywood', description: 'Playful design hotel with rooftop bar, ping pong, and photo booths. Walk to Hollywood Blvd', highlight: 'Rooftop bar with Hollywood sign views' },
        { name: 'Hotel Figueroa', type: 'boutique', priceRange: '$$', avgNight: '$250/night', rating: '4.5/5', neighborhood: 'Downtown', description: 'Spanish Colonial revival hotel from 1926 with a stunning pool and Mediterranean vibes', highlight: 'Coffin-shaped pool and Veranda restaurant' },
        { name: 'Santa Monica HI Hostel', type: 'hostel', priceRange: '$', avgNight: '$50/night', rating: '4.1/5', neighborhood: 'Santa Monica', description: 'Two blocks from the beach and pier. Free breakfast, community kitchen, bike rentals', highlight: 'Walk to Santa Monica Pier and beach' },
        { name: 'The Beverly Hills Hotel', type: 'hotel', priceRange: '$$$$', avgNight: '$700/night', rating: '4.8/5', neighborhood: 'Beverly Hills', description: 'The Pink Palace — Hollywood\'s legendary hotel since 1912. Bungalows, cabanas, and the Polo Lounge', highlight: 'The Polo Lounge for celebrity sightings' }
    ],
    'chicago': [
        { name: 'HI Chicago', type: 'hostel', priceRange: '$', avgNight: '$45/night', rating: '4.3/5', neighborhood: 'The Loop', description: 'Clean, modern hostel right in the Loop. Free breakfast, great common areas, steps from Millennium Park', highlight: 'Walk to Millennium Park and Art Institute' },
        { name: 'The Robey', type: 'boutique', priceRange: '$$', avgNight: '$200/night', rating: '4.4/5', neighborhood: 'Wicker Park', description: 'Art deco tower turned boutique hotel in the heart of Wicker Park nightlife. Rooftop bar with skyline views', highlight: 'Up Room rooftop cocktail bar' },
        { name: 'Virgin Hotels Chicago', type: 'hotel', priceRange: '$$', avgNight: '$220/night', rating: '4.5/5', neighborhood: 'The Loop', description: 'Richard Branson\'s playful hotel with a rooftop pool, great rooms, and the Miss Ricky\'s diner', highlight: 'Cerise rooftop bar and pool' },
        { name: 'The Langham Chicago', type: 'hotel', priceRange: '$$$$', avgNight: '$500/night', rating: '4.8/5', neighborhood: 'River North', description: 'Mies van der Rohe\'s IBM building turned luxury hotel. Indoor pool overlooking the Chicago River', highlight: 'Chuan Spa and river views from every room' },
        { name: 'Freehand Chicago', type: 'hostel', priceRange: '$', avgNight: '$50/night', rating: '4.2/5', neighborhood: 'River North', description: 'Stylish hostel-hotel hybrid in River North. Shared and private rooms with Broken Shaker bar downstairs', highlight: 'Broken Shaker cocktail bar' },
        { name: 'Sonder at AKA', type: 'apartment', priceRange: '$$', avgNight: '$170/night', rating: '4.3/5', neighborhood: 'River North', description: 'Apartment-style suites with full kitchens in a prime River North location', highlight: 'Full kitchen and living room space' }
    ],
    'london': [
        { name: 'Generator London', type: 'hostel', priceRange: '$', avgNight: '£25/night', rating: '4.1/5', neighborhood: 'Russell Square', description: 'Design-forward hostel near the British Museum. Bar, cinema room, and great social scene', highlight: 'Nightly events and pub crawls' },
        { name: 'The Hoxton, Shoreditch', type: 'boutique', priceRange: '$$', avgNight: '£150/night', rating: '4.5/5', neighborhood: 'Shoreditch', description: 'The original Hoxton hotel — industrial-chic rooms, great lobby bar, and Shoreditch on your doorstep', highlight: 'Free light breakfast bag (Bircher muesli + OJ)' },
        { name: 'citizenM Tower of London', type: 'hotel', priceRange: '$$', avgNight: '£140/night', rating: '4.6/5', neighborhood: 'Tower Hill', description: 'Tablet-controlled smart rooms with Tower Bridge views. 24/7 canteen and rooftop bar', highlight: 'Rooftop bar overlooking Tower Bridge' },
        { name: 'The Ned', type: 'hotel', priceRange: '$$$', avgNight: '£350/night', rating: '4.7/5', neighborhood: 'City of London', description: 'Soho House\'s mega-hotel in a 1924 Lutyens bank building. Rooftop pool, 9 restaurants, members\' club', highlight: 'Rooftop pool and 9 restaurants under one roof' },
        { name: 'Wombat\'s City Hostel', type: 'hostel', priceRange: '$', avgNight: '£30/night', rating: '4.2/5', neighborhood: 'Tower Hill', description: 'Award-winning hostel chain with clean rooms, bar, and walking distance to Tower of London', highlight: 'womBar on-site with cheap drinks' },
        { name: 'The Savoy', type: 'hotel', priceRange: '$$$$', avgNight: '£600/night', rating: '4.8/5', neighborhood: 'Strand', description: 'London\'s most legendary hotel since 1889. Art Deco glamour, Thames views, and the American Bar', highlight: 'The American Bar — one of the world\'s best cocktail bars' }
    ],
    'paris': [
        { name: 'Generator Paris', type: 'hostel', priceRange: '$', avgNight: '€30/night', rating: '4.2/5', neighborhood: '10th arr. (Canal Saint-Martin)', description: 'Stylish hostel in a renovated building near Canal Saint-Martin. Terrace bar and café', highlight: 'Rooftop terrace with Sacré-Cœur views' },
        { name: 'Hôtel Jeanne d\'Arc Le Marais', type: 'hotel', priceRange: '$$', avgNight: '€140/night', rating: '4.5/5', neighborhood: 'Le Marais, 4th arr.', description: 'Charming budget hotel on a quiet street in Le Marais. Book months ahead — it\'s always full', highlight: 'Perfect Le Marais location at budget prices' },
        { name: 'Le Pavillon de la Reine', type: 'boutique', priceRange: '$$$', avgNight: '€350/night', rating: '4.7/5', neighborhood: 'Place des Vosges, 3rd arr.', description: 'Hidden behind ivy on Place des Vosges. Intimate courtyard, spa, and the most romantic hotel in Paris', highlight: 'Ivy-covered courtyard on Place des Vosges' },
        { name: 'citizenM Paris Gare de Lyon', type: 'hotel', priceRange: '$$', avgNight: '€120/night', rating: '4.4/5', neighborhood: '12th arr.', description: 'Smart rooms with mood lighting and a rooftop bar. Great base near Gare de Lyon and Bastille', highlight: 'Rooftop cloudM bar with Paris panorama' },
        { name: 'Les Piaules', type: 'hostel', priceRange: '$', avgNight: '€35/night', rating: '4.3/5', neighborhood: 'Belleville, 20th arr.', description: 'Hip hostel in trendy Belleville with rooftop bar, craft beer, and street art views', highlight: 'Rooftop bar with skyline views at hostel prices' },
        { name: 'Le Bristol Paris', type: 'hotel', priceRange: '$$$$', avgNight: '€900/night', rating: '4.9/5', neighborhood: 'Rue du Faubourg Saint-Honoré, 8th arr.', description: 'Palace hotel with a rooftop pool, three-Michelin-star Epicure restaurant, and a resident cat named Fa-Raon', highlight: 'Rooftop pool and Epicure restaurant (3 Michelin stars)' }
    ],
    'tokyo': [
        { name: 'Khaosan Tokyo Kabuki', type: 'hostel', priceRange: '$', avgNight: '¥3,000/night (~$20)', rating: '4.2/5', neighborhood: 'Asakusa', description: 'Popular backpacker hostel near Senso-ji temple. Clean capsule-style beds and great common area', highlight: 'Walk to Senso-ji temple and Nakamise-dori' },
        { name: 'MUJI Hotel Ginza', type: 'boutique', priceRange: '$$', avgNight: '¥20,000/night (~$135)', rating: '4.6/5', neighborhood: 'Ginza', description: 'Minimalist perfection — MUJI designed every detail. Connected to the massive MUJI Ginza flagship store', highlight: 'Pure MUJI aesthetic with MUJI amenities in every room' },
        { name: 'Park Hyatt Tokyo', type: 'hotel', priceRange: '$$$$', avgNight: '¥80,000/night (~$540)', rating: '4.8/5', neighborhood: 'Shinjuku', description: 'The Lost in Translation hotel. 52nd floor pool, New York Bar with jazz, and Mount Fuji views on clear days', highlight: 'New York Bar — the Lost in Translation bar' },
        { name: 'Nine Hours Shinjuku', type: 'hostel', priceRange: '$', avgNight: '¥4,500/night (~$30)', rating: '4.1/5', neighborhood: 'Shinjuku', description: 'Futuristic capsule hotel — sleek pods with sleep-optimized lighting and a minimalist lounge', highlight: 'The quintessential Japanese capsule hotel experience' },
        { name: 'Hotel Gracery Shinjuku', type: 'hotel', priceRange: '$$', avgNight: '¥15,000/night (~$100)', rating: '4.3/5', neighborhood: 'Kabukicho, Shinjuku', description: 'The Godzilla hotel — there\'s a life-size Godzilla head on the roof. Clean rooms, great Shinjuku location', highlight: 'Life-size Godzilla on the 8th floor terrace' },
        { name: 'Trunk Hotel', type: 'boutique', priceRange: '$$$', avgNight: '¥40,000/night (~$270)', rating: '4.5/5', neighborhood: 'Shibuya', description: 'Shibuya\'s coolest boutique hotel — socially conscious design, great restaurant, and a buzzy lobby lounge', highlight: 'Trunk Kitchen restaurant and Shibuya location' }
    ],
    'miami': [
        { name: 'Generator Miami', type: 'hostel', priceRange: '$', avgNight: '$40/night', rating: '4.1/5', neighborhood: 'Mid-Beach', description: 'Stylish hostel with pool, hammocks, and a social bar. Steps from the beach on Collins Ave', highlight: 'Pool and direct beach access at hostel prices' },
        { name: 'The Confidante', type: 'hotel', priceRange: '$$', avgNight: '$220/night', rating: '4.4/5', neighborhood: 'Mid-Beach', description: 'Hyatt Unbound collection hotel with two pools, lush gardens, and a retro-Miami vibe', highlight: 'Two pools and Bird & Bone Southern restaurant' },
        { name: 'The Setai', type: 'hotel', priceRange: '$$$$', avgNight: '$700/night', rating: '4.8/5', neighborhood: 'South Beach', description: 'Asian-inspired luxury on South Beach with three infinity pools at different temperatures', highlight: 'Three temperature-controlled infinity pools' },
        { name: 'Life House Little Havana', type: 'boutique', priceRange: '$$', avgNight: '$160/night', rating: '4.5/5', neighborhood: 'Little Havana', description: 'Boutique hotel immersed in Little Havana culture. Art-filled rooms and a Cuban coffee bar', highlight: 'Walking distance to Calle Ocho and Domino Park' },
        { name: 'Selina Gold Dust', type: 'hostel', priceRange: '$', avgNight: '$35/night', rating: '4.0/5', neighborhood: 'Downtown', description: 'Co-working hostel with dorms, private rooms, and a social scene. Good for digital nomads', highlight: 'Co-working space and community events' },
        { name: 'Sonder at Brickell', type: 'apartment', priceRange: '$$', avgNight: '$150/night', rating: '4.3/5', neighborhood: 'Brickell', description: 'Modern apartment-style suites in the Brickell financial district with pool and city views', highlight: 'Full kitchen and rooftop pool access' }
    ],
    'nashville': [
        { name: 'Nashville Downtown Hostel', type: 'hostel', priceRange: '$', avgNight: '$40/night', rating: '4.0/5', neighborhood: 'Downtown', description: 'Basic but social hostel walking distance from Broadway honky-tonks', highlight: 'Walk to Broadway and live music' },
        { name: 'Graduate Nashville', type: 'boutique', priceRange: '$$', avgNight: '$200/night', rating: '4.4/5', neighborhood: 'Midtown / Vanderbilt', description: 'Music-themed boutique near Vanderbilt with a rooftop bar, cross-shaped pool, and Dolly Parton mural', highlight: 'White Limozeen rooftop bar and Dolly mural' },
        { name: 'The 404 Hotel', type: 'boutique', priceRange: '$$$', avgNight: '$350/night', rating: '4.7/5', neighborhood: 'The Gulch', description: 'Only 5 rooms in this converted warehouse. Speakeasy bar, record players, and boutique perfection', highlight: 'Hidden speakeasy bar and only 5 rooms' },
        { name: 'Drury Plaza Hotel Nashville', type: 'hotel', priceRange: '$$', avgNight: '$180/night', rating: '4.6/5', neighborhood: 'Downtown', description: 'Great value downtown hotel in a renovated historic building. Free hot breakfast and evening reception', highlight: 'Free hot breakfast and evening drinks/snacks' },
        { name: 'The Hermitage Hotel', type: 'hotel', priceRange: '$$$$', avgNight: '$500/night', rating: '4.8/5', neighborhood: 'Downtown', description: 'Nashville\'s only Forbes Five-Star hotel since 1910. Beaux-Arts lobby, Capitol Grille, and legendary men\'s restroom', highlight: 'Beaux-Arts lobby and the famous Art Deco men\'s restroom' }
    ],
    'seoul': [
        { name: 'Zzzip Guesthouse', type: 'hostel', priceRange: '$', avgNight: '₩20,000/night (~$15)', rating: '4.1/5', neighborhood: 'Hongdae', description: 'Clean capsule-style guesthouse in the heart of Hongdae nightlife district', highlight: 'Walk to Hongdae clubs and street food' },
        { name: 'Hotel28 Myeongdong', type: 'hotel', priceRange: '$$', avgNight: '₩120,000/night (~$90)', rating: '4.4/5', neighborhood: 'Myeongdong', description: 'Design hotel in Seoul\'s shopping district. Modern rooms and K-beauty amenities', highlight: 'Central Myeongdong shopping at your doorstep' },
        { name: 'Josun Palace', type: 'hotel', priceRange: '$$$$', avgNight: '₩500,000/night (~$375)', rating: '4.8/5', neighborhood: 'Gangnam', description: 'Seoul\'s newest luxury hotel in Gangnam with Michelin dining and a stunning indoor pool', highlight: 'Luxury Collection hotel with Michelin restaurants' },
        { name: 'RYSE, Autograph Collection', type: 'boutique', priceRange: '$$$', avgNight: '₩250,000/night (~$188)', rating: '4.5/5', neighborhood: 'Hongdae', description: 'Art-forward boutique hotel in Hongdae with Side Note rooftop bar and curated galleries', highlight: 'Side Note rooftop bar and art installations' },
        { name: 'G Guesthouse Hongdae', type: 'hostel', priceRange: '$', avgNight: '₩25,000/night (~$19)', rating: '4.2/5', neighborhood: 'Hongdae', description: 'Popular backpacker guesthouse with Korean BBQ nights, free ramen, and K-pop dance parties', highlight: 'Free Korean dinner nights and K-pop events' },
        { name: 'Bukchon Hanok Stay', type: 'apartment', priceRange: '$$', avgNight: '₩100,000/night (~$75)', rating: '4.6/5', neighborhood: 'Bukchon', description: 'Traditional Korean hanok house in the historic Bukchon village. Sleep on ondol heated floors', highlight: 'Authentic hanok experience in a 100-year-old house' }
    ],
    'san francisco': [
        { name: 'HI San Francisco Fisherman\'s Wharf', type: 'hostel', priceRange: '$', avgNight: '$55/night', rating: '4.3/5', neighborhood: 'Fort Mason', description: 'Hostel in a historic Civil War-era building with bay views. Free breakfast and parking', highlight: 'Bay views and free parking (rare in SF!)' },
        { name: 'Hotel Vitale', type: 'boutique', priceRange: '$$$', avgNight: '$300/night', rating: '4.5/5', neighborhood: 'Embarcadero', description: 'Waterfront boutique on the Embarcadero with Bay Bridge views and a rooftop spa', highlight: 'Rooftop penthouse spa with bay views' },
        { name: 'The Proper Hotel', type: 'boutique', priceRange: '$$$', avgNight: '$350/night', rating: '4.6/5', neighborhood: 'Mid-Market', description: 'Kelly Wearstler-designed interiors in a 1904 flatiron building. Rooftop bar Charmaine\'s', highlight: 'Charmaine\'s rooftop bar and lounge' },
        { name: 'citizenM San Francisco', type: 'hotel', priceRange: '$$', avgNight: '$180/night', rating: '4.4/5', neighborhood: 'Union Square', description: 'Smart rooms with tablet controls near Union Square. Great rooftop with city views', highlight: 'Central Union Square location and rooftop bar' },
        { name: 'The Fairmont', type: 'hotel', priceRange: '$$$$', avgNight: '$450/night', rating: '4.6/5', neighborhood: 'Nob Hill', description: 'Historic Nob Hill landmark that survived the 1906 earthquake. Tiki bar and penthouse suite', highlight: 'Tonga Room tiki bar with indoor rainstorms' }
    ],
    'new orleans': [
        { name: 'India House Hostel', type: 'hostel', priceRange: '$', avgNight: '$30/night', rating: '4.1/5', neighborhood: 'Mid-City', description: 'Laid-back hostel in a Victorian mansion with a pool, hammocks, and crawfish boils', highlight: 'Pool parties and weekly crawfish boils' },
        { name: 'Hotel Peter & Paul', type: 'boutique', priceRange: '$$$', avgNight: '$280/night', rating: '4.7/5', neighborhood: 'Marigny', description: 'A converted church, schoolhouse, rectory, and convent — each building has its own style', highlight: 'Sleep in a converted 19th-century church' },
        { name: 'Ace Hotel New Orleans', type: 'boutique', priceRange: '$$', avgNight: '$200/night', rating: '4.4/5', neighborhood: 'Warehouse District', description: 'Art deco Ace in a 1928 building with Alto rooftop pool bar and Josephine Estelle restaurant', highlight: 'Alto rooftop pool with skyline views' },
        { name: 'The Roosevelt New Orleans', type: 'hotel', priceRange: '$$$$', avgNight: '$400/night', rating: '4.7/5', neighborhood: 'Central Business District', description: 'Waldorf Astoria property since 1893. The Sazerac Bar invented the cocktail. Block-long lobby at Christmas', highlight: 'The Sazerac Bar — birthplace of the cocktail' },
        { name: 'Sonder at Duncan Plaza', type: 'apartment', priceRange: '$$', avgNight: '$140/night', rating: '4.3/5', neighborhood: 'Central Business District', description: 'Modern apartment suites near the Superdome with full kitchens and washer/dryer', highlight: 'Full kitchen for heating up your takeout leftovers' }
    ],
    'bangkok': [
        { name: 'NapPark Hostel', type: 'hostel', priceRange: '$', avgNight: '฿400/night (~$11)', rating: '4.3/5', neighborhood: 'Banglamphu (Khao San area)', description: 'Award-winning hostel near Khao San Road. Clean pods, great café, and rooftop hangout', highlight: 'Near Khao San Road at a fraction of the price' },
        { name: 'The Siam', type: 'hotel', priceRange: '$$$$', avgNight: '฿15,000/night (~$420)', rating: '4.8/5', neighborhood: 'Dusit', description: 'Art deco riverside luxury with a Muay Thai ring, cooking school, and private pier', highlight: 'On-site Muay Thai ring and cooking school' },
        { name: 'Lub d Bangkok Siam', type: 'hostel', priceRange: '$', avgNight: '฿500/night (~$14)', rating: '4.2/5', neighborhood: 'Siam', description: 'Modern hostel near Siam Square malls and BTS station. Theater room and social events', highlight: 'Connected to BTS Siam station for easy transit' },
        { name: 'Shanghai Mansion', type: 'boutique', priceRange: '$$', avgNight: '฿2,500/night (~$70)', rating: '4.4/5', neighborhood: 'Chinatown (Yaowarat)', description: 'Colorful Sino-Portuguese boutique in the heart of Bangkok\'s Chinatown food scene', highlight: 'Walk to Yaowarat night food market' },
        { name: 'Mandarin Oriental Bangkok', type: 'hotel', priceRange: '$$$$', avgNight: '฿20,000/night (~$560)', rating: '4.9/5', neighborhood: 'Riverside', description: 'The oldest luxury hotel in Bangkok (1876). Authors\' Wing where Somerset Maugham and Joseph Conrad stayed', highlight: 'Authors\' Lounge afternoon tea on the river' }
    ],
    'barcelona': [
        { name: 'Casa Gracia', type: 'hostel', priceRange: '$', avgNight: '€25/night', rating: '4.3/5', neighborhood: 'Gràcia', description: 'Boutique hostel in a modernista building on Passeig de Gràcia. Terrace bar and free events', highlight: 'Rooftop terrace on Passeig de Gràcia' },
        { name: 'Hotel Brummell', type: 'boutique', priceRange: '$$', avgNight: '€160/night', rating: '4.5/5', neighborhood: 'Poble-sec', description: 'Design hotel in hip Poble-sec with a pool, yoga classes, and rotating art exhibitions', highlight: 'Pool, yoga classes, and neighborhood tapas bars' },
        { name: 'El Palace Barcelona', type: 'hotel', priceRange: '$$$$', avgNight: '€400/night', rating: '4.7/5', neighborhood: 'Eixample', description: 'Grand 1919 palace hotel with a rooftop pool, Caelis Michelin restaurant, and opulent ballrooms', highlight: 'Rooftop pool and Michelin-star dining' },
        { name: 'TOC Hostel Barcelona', type: 'hostel', priceRange: '$', avgNight: '€22/night', rating: '4.1/5', neighborhood: 'Eixample', description: 'Social hostel with rooftop pool, tapas nights, and walking tours of the Gothic Quarter', highlight: 'Rooftop pool and free tapas nights' },
        { name: 'Yurbban Passage Hotel', type: 'boutique', priceRange: '$$', avgNight: '€140/night', rating: '4.4/5', neighborhood: 'Gothic Quarter', description: 'Sleek boutique hotel hidden in the Gothic Quarter with a rooftop plunge pool', highlight: 'Rooftop with plunge pool in the Gothic Quarter' }
    ],
    'ho chi minh city': [
        { name: 'The Common Room Project', type: 'hostel', priceRange: '$', avgNight: '₫200,000/night (~$8)', rating: '4.4/5', neighborhood: 'District 1', description: 'Modern hostel in the heart of Saigon with pod beds, co-working space, and rooftop bar', highlight: 'Rooftop bar and central District 1 location' },
        { name: 'Hotel Nikko Saigon', type: 'hotel', priceRange: '$$', avgNight: '₫2,000,000/night (~$80)', rating: '4.5/5', neighborhood: 'District 1', description: 'Japanese-run hotel with excellent service, pool, and walking distance to Ben Thanh Market', highlight: 'Outdoor pool and Japanese-standard cleanliness' },
        { name: 'The Reverie Saigon', type: 'hotel', priceRange: '$$$$', avgNight: '₫8,000,000/night (~$320)', rating: '4.8/5', neighborhood: 'District 1', description: 'Saigon\'s most lavish hotel with Italian designer interiors, rooftop bar, and Saigon River views', highlight: 'Rooftop bar with panoramic city views' },
        { name: 'M Social Saigon', type: 'boutique', priceRange: '$$', avgNight: '₫1,500,000/night (~$60)', rating: '4.3/5', neighborhood: 'District 1', description: 'Philippe Starck-designed boutique hotel near the riverfront with a trendy rooftop pool', highlight: 'Design hotel with rooftop pool at mid-range prices' },
        { name: 'Long Hostel', type: 'hostel', priceRange: '$', avgNight: '₫150,000/night (~$6)', rating: '4.1/5', neighborhood: 'District 1', description: 'Backpacker favorite on the famous Bui Vien walking street. Clean dorms and social atmosphere', highlight: 'Steps from Bui Vien backpacker street nightlife' },
        { name: 'Saigon Heritage Villa', type: 'boutique', priceRange: '$$', avgNight: '₫1,800,000/night (~$72)', rating: '4.6/5', neighborhood: 'District 3', description: 'Colonial-era villa converted to boutique hotel with courtyard garden and Vietnamese breakfast', highlight: 'Beautiful French colonial architecture and garden' }
    ],
};
const DEFAULT_ACCOMMODATIONS = [
    { name: 'City Center Hotel', type: 'hotel', priceRange: '$$', avgNight: '$150/night', rating: '4.3/5', neighborhood: 'Downtown', description: 'Clean, well-located hotel in the city center with modern rooms and friendly staff', highlight: 'Central location within walking distance of main sights' },
    { name: 'Backpacker\'s Hostel', type: 'hostel', priceRange: '$', avgNight: '$35/night', rating: '4.1/5', neighborhood: 'City Center', description: 'Social hostel with dorms and private rooms. Common kitchen, lounge, and free walking tours', highlight: 'Free walking tours and social events' },
    { name: 'Boutique Inn', type: 'boutique', priceRange: '$$$', avgNight: '$250/night', rating: '4.6/5', neighborhood: 'Historic District', description: 'Charming boutique in a restored historic building with unique rooms and local character', highlight: 'Each room uniquely designed with local art' },
    { name: 'City Apartment Stay', type: 'apartment', priceRange: '$$', avgNight: '$120/night', rating: '4.4/5', neighborhood: 'Residential Area', description: 'Spacious apartment with full kitchen, living area, and local neighborhood feel', highlight: 'Full kitchen and laundry facilities' }
];
function matchCity(city) {
    const resolved = (0, location_aliases_1.resolveLocation)(city, Object.keys(CITY_ACCOMMODATIONS));
    return resolved ? CITY_ACCOMMODATIONS[resolved] : DEFAULT_ACCOMMODATIONS;
}
exports.accommodationService = {
    async getAccommodations(city, budget, type) {
        await new Promise(resolve => setTimeout(resolve, 200));
        const resolved = (0, location_aliases_1.resolveLocation)(city, Object.keys(CITY_ACCOMMODATIONS), true);
        const isDefault = !resolved;
        let accommodations = [...(resolved ? CITY_ACCOMMODATIONS[resolved] : DEFAULT_ACCOMMODATIONS)];
        // Filter by budget
        if (budget) {
            const budgetMap = {
                'free': ['$'],
                'low': ['$'],
                'medium': ['$', '$$'],
                'high': ['$', '$$', '$$$', '$$$$'],
            };
            const allowed = budgetMap[budget] || ['$', '$$', '$$$', '$$$$'];
            const filtered = accommodations.filter(a => allowed.includes(a.priceRange));
            if (filtered.length > 0)
                accommodations = filtered;
        }
        // Filter by type
        if (type) {
            const filtered = accommodations.filter(a => a.type === type.toLowerCase());
            if (filtered.length > 0)
                accommodations = filtered;
        }
        // Add Google Maps links
        const withUrls = accommodations.map(a => {
            const url = `https://maps.google.com/?q=${encodeURIComponent(a.name + ', ' + city)}`;
            return { ...a, url, link: `[${a.name}](${url})` };
        });
        return {
            success: true,
            data: withUrls.slice(0, 4),
            ...(isDefault && { note: `No curated data for "${city}" — these are generic placeholders. REPLACE every entry with real hotels/hostels/apartments you know in or near ${city}.` })
        };
    }
};
