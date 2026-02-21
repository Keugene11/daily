import { ToolResult, EventItem } from '../../types';
import { resolveLocation } from './location_aliases';

// Internal type with scheduling info
interface ScheduledEvent {
  name: string;
  time: string;
  location: string;
  description: string;
  days?: number[];   // 0=Sun..6=Sat — omit for every day
  isFree?: boolean;
  price?: string;
}

const todayStr = () => new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const dayOfWeek = () => new Date().getDay();
const dayName = () => new Date().toLocaleDateString('en-US', { weekday: 'long' });

const CITY_EVENTS: Record<string, ScheduledEvent[]> = {
  'new york': [
    { name: 'Union Square Greenmarket', time: '8:00 AM - 6:00 PM', location: 'Union Square, Manhattan', description: 'NYC\'s flagship open-air farmers market with 140+ regional farmers and food vendors. Local honey, fresh bread, artisan cheese.', days: [1, 3, 5, 6], isFree: true },
    { name: 'Smorgasburg Food Market', time: '11:00 AM - 6:00 PM', location: 'Williamsburg Waterfront, Brooklyn', description: '100+ food vendors — ramen burgers, Thai rolled ice cream, lobster rolls. NYC\'s largest open-air food market.', days: [0, 6] },
    { name: 'Gallery Hop — Chelsea Art District', time: '10:00 AM - 6:00 PM', location: '20th-28th St between 10th & 11th Ave', description: 'Over 300 galleries with free entry. New exhibitions opening this week.', days: [2, 3, 4, 5, 6], isFree: true },
    { name: 'Comedy Cellar — Early Show', time: '7:00 PM', location: '117 MacDougal St, Greenwich Village', description: 'NYC\'s most famous comedy club. Surprise drop-ins from A-list comedians.', price: 'from $10' },
    { name: 'Shakespeare in the Park', time: '8:00 PM', location: 'Delacorte Theater, Central Park', description: 'Free tickets distributed at noon. A Midsummer Night\'s Dream.', days: [2, 3, 4, 5, 6, 0], isFree: true },
    { name: 'MoMA Free Friday Evening', time: '4:00 - 8:00 PM', location: '11 W 53rd St, Midtown', description: 'Free admission to MoMA — Picasso, Warhol, Monet, and 200,000+ works. Uniqlo-sponsored free Friday evenings.', days: [5], isFree: true },
    { name: 'Brooklyn Museum First Saturday', time: '5:00 - 11:00 PM', location: '200 Eastern Pkwy, Brooklyn', description: 'Free admission + live music, DJ sets, film screenings, and hands-on art workshops. Brooklyn\'s best free night out.', days: [6], isFree: true },
    { name: 'Sunday Gospel Brunch at Sylvia\'s', time: '12:00 PM', location: '328 Malcolm X Blvd, Harlem', description: 'Iconic soul food with live gospel music. Southern fried chicken, mac & cheese, collard greens.', days: [0], price: '$35 prix fixe' },
    { name: 'Brooklyn Flea Market', time: '10:00 AM - 5:00 PM', location: 'DUMBO Archway, Brooklyn', description: 'Vintage finds, handmade goods, and food vendors under the Manhattan Bridge.', days: [0, 6] },
    { name: 'Jazz at Lincoln Center — Free Concert', time: '7:30 PM', location: 'Dizzy\'s Club, Columbus Circle', description: 'Emerging artists showcase. World-class jazz overlooking Central Park.', days: [3, 5], isFree: true },
    { name: 'Thursday Late Night at Brooklyn Museum', time: '5:00 - 10:00 PM', location: '200 Eastern Pkwy, Brooklyn', description: 'Pay-what-you-wish admission + cocktails, live music, and gallery talks.', days: [4], price: 'pay-what-you-wish' },
    { name: 'Wednesday Matinee Broadway (TKTS)', time: '2:00 PM shows', location: 'TKTS Booth, Times Square', description: 'Midweek matinees have the best TKTS availability — 30-50% off Broadway shows.', days: [3], price: '30-50% off' },
  ],
  'los angeles': [
    { name: 'Hollywood Farmers Market', time: '8:00 AM - 1:00 PM', location: 'Ivar Ave & Selma Ave, Hollywood', description: 'Celebrity-spotting farmers market with California avocados, citrus, and gourmet food trucks.', days: [0] },
    { name: 'Venice Beach Drum Circle', time: '3:00 PM - Sunset', location: 'Venice Beach Boardwalk', description: 'Community drum circle and dance gathering. Free, all welcome.', days: [0, 6], isFree: true },
    { name: 'Outdoor Movie at Hollywood Forever', time: '8:30 PM', location: 'Hollywood Forever Cemetery', description: 'Iconic outdoor cinema screening classic films among the graves of Hollywood legends.', days: [6], price: '$20' },
    { name: 'Getty Center Garden Tour', time: '11:00 AM', location: 'The Getty Center, Brentwood', description: 'Free guided tour of the Getty\'s stunning Central Garden. Museum always free.', isFree: true },
    { name: 'Comedy Store — Original Room', time: '8:00 PM', location: '8433 Sunset Blvd, West Hollywood', description: 'Legendary comedy club on the Sunset Strip. Rising LA comedians.', price: '$20-30' },
    { name: 'Abbot Kinney First Friday', time: '5:00 - 10:00 PM', location: 'Abbot Kinney Blvd, Venice', description: 'Food trucks, live music, artisan vendors, and gallery openings along LA\'s coolest street.', days: [5], isFree: true },
    { name: 'LACMA Free Second Tuesday', time: '11:00 AM - 5:00 PM', location: 'Wilshire Blvd, Miracle Mile', description: 'Free admission to LA\'s largest art museum on the second Tuesday of each month.', days: [2], isFree: true },
    { name: 'Santa Monica Farmers Market', time: '8:00 AM - 1:00 PM', location: 'Arizona Ave, Santa Monica', description: 'The market where LA\'s top chefs shop. Fresh produce, flowers, baked goods.', days: [3, 6] },
    { name: 'Taco Tuesday All Over LA', time: 'All day', location: 'Citywide', description: '$1-2 tacos at hundreds of spots. Grand Central Market, Guisados, Sonoratown — LA takes Taco Tuesday seriously.', days: [2], price: '$1-2 tacos' },
    { name: 'Free Yoga at Runyon Canyon', time: '9:00 AM', location: 'Runyon Canyon, Hollywood Hills', description: 'Free outdoor yoga with city views. Bring your own mat. All levels welcome.', days: [0, 6], isFree: true },
  ],
  'chicago': [
    { name: 'Chicago Riverwalk Live Music', time: '5:00 - 9:00 PM', location: 'Chicago Riverwalk, between State & LaSalle', description: 'Free live music along the river with food and drink vendors. Tonight: blues ensemble.', days: [4, 5, 6], isFree: true },
    { name: 'Green City Market', time: '7:00 AM - 1:00 PM', location: 'Lincoln Park, south end', description: 'Chicago\'s premier sustainable farmers market. Chefs do cooking demos.', days: [3, 6] },
    { name: 'Second City Comedy Show', time: '8:00 PM', location: '1616 N Wells St, Old Town', description: 'The legendary improv theater. Free improv set after the main show.', price: '$30-50 (free improv after)' },
    { name: 'Art Institute Free Thursday Evening', time: '5:00 - 8:00 PM', location: '111 S Michigan Ave', description: 'Free evening admission to one of the world\'s great art museums — Seurat, Monet, Hopper, and more.', days: [4], isFree: true },
    { name: 'Lincoln Park Zoo', time: '10:00 AM - 5:00 PM', location: 'Lincoln Park', description: 'One of the last free zoos in the US — always free, 365 days a year.', isFree: true },
    { name: 'Millennium Park Free Yoga', time: '8:00 AM', location: 'Great Lawn, Millennium Park', description: 'Free outdoor yoga class with skyline views. Bring your own mat.', days: [6], isFree: true },
    { name: 'Blues Fest at Kingston Mines', time: '7:00 PM - 4:00 AM', location: '2548 N Halsted St, Lincoln Park', description: 'Chicago\'s oldest blues club. Two stages, live music every night.', price: '$15 cover' },
    { name: 'Sunday Brunch at the Chicago Athletic Association', time: '10:00 AM - 2:00 PM', location: '12 S Michigan Ave', description: 'Elegant brunch overlooking Millennium Park. Bottomless mimosas and seasonal menu.', days: [0], price: '$45' },
    { name: 'Maxwell Street Market', time: '7:00 AM - 3:00 PM', location: '800 S Desplaines St', description: 'Chicago\'s legendary street market — Mexican street food, vintage finds, live blues.', days: [0], isFree: true },
  ],
  'london': [
    { name: 'Borough Market Tasting Tour', time: '10:00 AM - 5:00 PM', location: 'Borough Market, Southwark', description: 'London\'s oldest food market (1,000+ years). Artisan cheese, fresh oysters, scotch eggs.', days: [1, 2, 3, 4, 5, 6], isFree: true },
    { name: 'West End Theatre — Half Price Tickets', time: 'various showtimes', location: 'TKTS Booth, Leicester Square', description: 'Same-day half-price tickets for West End shows. Queue from 10 AM.', price: '50% off' },
    { name: 'Changing of the Guard', time: '11:00 AM', location: 'Buckingham Palace', description: 'Free iconic ceremony — the King\'s Guard in full ceremonial dress with military band.', days: [1, 3, 5, 0], isFree: true },
    { name: 'Camden Market', time: '10:00 AM - 6:00 PM', location: 'Camden Town', description: '1,000+ stalls — vintage clothes, street food from 30+ cuisines, indie crafts.', days: [0, 6] },
    { name: 'Evensong at Westminster Abbey', time: '5:00 PM', location: 'Westminster Abbey', description: 'Free choral evensong service in the 700-year-old abbey. One of London\'s most beautiful free experiences.', isFree: true },
    { name: 'Friday Night at the V&A', time: '6:30 - 10:00 PM', location: 'Victoria & Albert Museum, South Ken', description: 'Free late-night opening with DJs, cocktails, talks, and exhibitions. The coolest museum night in London.', days: [5], isFree: true },
    { name: 'Columbia Road Flower Market', time: '8:00 AM - 3:00 PM', location: 'Columbia Rd, Shoreditch', description: 'Stunning Sunday flower market with independent cafés and shops opening their doors.', days: [0], isFree: true },
    { name: 'Brick Lane Night Market', time: '5:00 - 11:00 PM', location: 'Brick Lane, Shoreditch', description: 'Street food, vintage shopping, curry houses, and live DJs in London\'s creative East End.', days: [4, 5, 6] },
    { name: 'Saturday Portobello Road Market', time: '9:00 AM - 7:00 PM', location: 'Portobello Rd, Notting Hill', description: 'World-famous antiques market (Saturday only!) with street food and buskers.', days: [6] },
    { name: 'Southbank Centre Free Foyer Music', time: '12:00 - 2:00 PM', location: 'Royal Festival Hall', description: 'Free lunchtime concerts in the foyer — jazz, classical, world music. Perfect midday break.', days: [1, 2, 3, 4, 5], isFree: true },
  ],
  'paris': [
    { name: 'Marché d\'Aligre', time: '7:30 AM - 1:30 PM', location: 'Place d\'Aligre, 12th arr.', description: 'Paris\'s most authentic and affordable market. Cheese, wine, charcuterie, fresh flowers.', days: [2, 3, 4, 5, 6, 0] },
    { name: 'Free Walking Tour — Le Marais', time: '10:30 AM', location: 'Meet at Hôtel de Ville Métro', description: 'Explore medieval streets, Jewish quarter, LGBTQ+ history, hidden courtyards.', isFree: true },
    { name: 'Seine River Picnic', time: 'Sunset', location: 'Pont des Arts / Île Saint-Louis', description: 'Grab a baguette, cheese, and wine and join Parisians picnicking along the Seine.', isFree: true },
    { name: 'Montmartre Art Walk', time: '2:00 PM', location: 'Place du Tertre, 18th arr.', description: 'Artists paint in the square where Picasso and Monet once worked.', isFree: true },
    { name: 'Jazz Club — Le Caveau de la Huchette', time: '9:30 PM', location: '5 Rue de la Huchette, Latin Quarter', description: 'Swing and jazz in a medieval cellar since 1946. Dance floor, live band.', price: '€15 entry' },
    { name: 'First Sunday Free Museums', time: '10:00 AM - 6:00 PM', location: 'Louvre, Orsay, Pompidou, and more', description: 'The Louvre, Musée d\'Orsay, Centre Pompidou, Orangerie, and 30+ museums are FREE on the first Sunday of each month!', days: [0], isFree: true },
    { name: 'Thursday Late Night at Musée d\'Orsay', time: 'Until 9:45 PM', location: 'Musée d\'Orsay, 7th arr.', description: 'Late-night entry to see Monet, Van Gogh, and Renoir with far fewer crowds.', days: [4], price: '€16 (reduced after 6PM: €12)' },
    { name: 'Marché des Enfants Rouges', time: '8:30 AM - 8:30 PM', location: 'Le Marais, 3rd arr.', description: 'Paris\'s oldest covered market (1628). Japanese bento, Moroccan couscous, Italian deli, French crêpes.', days: [2, 3, 4, 5, 6, 0] },
    { name: 'Saturday Night Sacré-Cœur Steps', time: '8:00 PM - midnight', location: 'Sacré-Cœur, Montmartre', description: 'Free open-air gathering — street musicians, wine sellers, and panoramic night views of Paris.', days: [6], isFree: true },
  ],
  'tokyo': [
    { name: 'Tsukiji Outer Market', time: '5:00 AM - 2:00 PM', location: 'Tsukiji, Chuo City', description: 'The famous market\'s outer stalls — freshest sushi, tamagoyaki, and street food in Tokyo.', days: [1, 2, 3, 4, 5, 6] },
    { name: 'Harajuku Fashion Walk', time: 'All day', location: 'Takeshita Street, Harajuku', description: 'Tokyo\'s epicenter of youth culture — cosplay, kawaii fashion, crêpe stalls.', isFree: true },
    { name: 'Yoyogi Park Weekend Performers', time: '12:00 - 5:00 PM', location: 'Yoyogi Park, Shibuya', description: 'Rockabilly dancers, cosplay, street musicians, and martial arts demos.', days: [0, 6], isFree: true },
    { name: 'Shibuya Night Food Tour', time: '6:00 PM', location: 'Start at Hachiko Statue, Shibuya', description: 'Self-guided tour of izakayas, ramen shops, and yakitori alleys.', isFree: true },
    { name: 'TeamLab Borderless', time: '10:00 AM - 7:00 PM', location: 'Azabudai Hills, Minato', description: 'Immersive digital art museum — rooms of flowing light, water, and color.', price: '¥3,800' },
    { name: 'Sunday Meiji Shrine Market', time: '9:00 AM - 4:00 PM', location: 'Meiji Shrine Outer Gardens', description: 'Antique and craft market in the shrine grounds — vintage kimono, pottery, handmade goods.', days: [0], isFree: true },
    { name: 'Friday Night Roppongi Art Triangle', time: '5:00 - 10:00 PM', location: 'Roppongi Hills / Midtown / National Art Center', description: 'Late-night openings at 3 major galleries. Some free exhibitions. Art night atmosphere.', days: [5], price: 'varies (some free)' },
    { name: 'Shimokitazawa Vintage Shopping', time: '12:00 - 8:00 PM', location: 'Shimokitazawa', description: 'Tokyo\'s vintage neighborhood — thrift stores, record shops, indie cafés, tiny live music venues.', days: [0, 6] },
  ],
  'miami': [
    { name: 'Wynwood Art Walk', time: '12:00 - 10:00 PM', location: 'Wynwood Arts District', description: 'Open galleries, massive murals, and street art. Free gallery openings Saturday evenings.', isFree: true },
    { name: 'South Beach Volleyball', time: '8:00 AM - Sunset', location: 'Lummus Park Beach, South Beach', description: 'Free public volleyball courts. Join a pickup game or watch from the sand.', isFree: true },
    { name: 'Little Havana Food Tour', time: '11:00 AM', location: 'Calle Ocho, Little Havana', description: 'Cuban coffee at Versailles, empanadas at Los Pinarenos, cigars at El Titan de Bronze.' },
    { name: 'Sunset at Bayfront Park', time: '6:00 PM', location: 'Bayfront Park, Downtown', description: 'Free yoga, food trucks, and waterfront views of Biscayne Bay.', isFree: true },
    { name: 'Live Latin Music at Ball & Chain', time: '8:00 PM', location: '1513 SW 8th St, Little Havana', description: 'Live salsa and son cubano in a legendary 1935 nightclub.', price: 'no cover before 10PM' },
    { name: 'Wynwood Second Saturday Gallery Night', time: '6:00 - 10:00 PM', location: 'Wynwood Arts District', description: 'Dozens of galleries open with free wine, new exhibitions, and DJs. The best free night out in Miami.', days: [6], isFree: true },
    { name: 'Sunday Coconut Grove Farmers Market', time: '10:00 AM - 5:00 PM', location: 'Peacock Park, Coconut Grove', description: 'Tropical fruit, fresh juice, organic produce, and live music under the banyan trees.', days: [0] },
    { name: 'Free Pérez Art Museum Miami (First Thursday)', time: '1:00 - 9:00 PM', location: 'PAMM, Museum Park', description: 'Free admission on first Thursdays + waterfront happy hour with bay views.', days: [4], isFree: true },
  ],
  'san francisco': [
    { name: 'Ferry Building Farmers Market', time: '8:00 AM - 2:00 PM', location: 'Ferry Building, Embarcadero', description: 'SF\'s premier market — Cowgirl Creamery cheese, Blue Bottle Coffee, Acme bread, 100+ farm vendors.', days: [2, 4, 6] },
    { name: 'Golden Gate Park Free Concerts', time: '1:00 PM', location: 'Music Concourse, Golden Gate Park', description: 'Free outdoor concerts in the park bandshell. Bring a picnic and a jacket.', days: [0], isFree: true },
    { name: 'Chinatown Heritage Walk', time: '10:00 AM', location: 'Dragon\'s Gate, Grant Ave', description: 'Oldest Chinatown in North America — dim sum, temples, herbal shops.', isFree: true },
    { name: 'Mission District Mural Walk', time: 'Any time', location: 'Balmy Alley & Clarion Alley, Mission', description: '100+ murals — political art, Chicano culture, contemporary street art.', isFree: true },
    { name: 'Beach Bonfire at Ocean Beach', time: 'Sunset', location: 'Ocean Beach, fire pits', description: 'Free public fire pits. Bring wood, marshmallows, and layers. Arrive early to claim a pit.', days: [5, 6], isFree: true },
    { name: 'Free First Tuesday at de Young Museum', time: '9:30 AM - 5:15 PM', location: 'Golden Gate Park', description: 'Free admission on the first Tuesday of each month to SF\'s premier fine arts museum.', days: [2], isFree: true },
    { name: 'Saturday Off the Grid Food Trucks', time: '11:00 AM - 3:00 PM', location: 'Fort Mason Center', description: '30+ gourmet food trucks, live DJs, craft beer. SF\'s biggest weekly food event.', days: [6], price: '$5-15 per plate' },
    { name: 'Sunday SoMa StrEat Food Park', time: '11:00 AM - 9:00 PM', location: '428 11th St, SoMa', description: 'Rotating food trucks, beer garden, and sports on the big screen.', days: [0] },
  ],
  'nashville': [
    { name: 'Live Honky-Tonk on Broadway', time: '10:00 AM - 3:00 AM', location: 'Lower Broadway (Honky Tonk Highway)', description: 'Free live country, rock, and blues in every bar on Broadway. No cover charges.', isFree: true },
    { name: 'Nashville Farmers Market', time: '8:00 AM - 4:00 PM', location: '900 Rosa L Parks Blvd', description: 'Year-round market with Tennessee produce, hot chicken stalls, local crafts.', days: [0, 6] },
    { name: 'Grand Ole Opry Show', time: '7:00 PM', location: 'Grand Ole Opry House', description: 'The legendary country music radio show — running since 1925.', days: [2, 5, 6], price: '$40-100' },
    { name: 'Bluebird Cafe Songwriter Round', time: '9:00 PM', location: '4104 Hillsboro Pike', description: 'Intimate songwriter showcase in the room where Taylor Swift was discovered.', price: '$15-25' },
    { name: 'East Nashville Art Crawl', time: '6:00 - 9:00 PM', location: 'East Nashville', description: 'Galleries, studios, and pop-up shops. Free admission, wine at every stop.', days: [6], isFree: true },
    { name: 'Sunday Bluegrass Brunch at The Station Inn', time: '10:00 AM', location: '402 12th Ave S, The Gulch', description: 'Live bluegrass with breakfast. Nashville\'s most authentic music venue.', days: [0], price: '$20' },
    { name: 'Free Friday Night at Frist Art Museum', time: '5:00 - 9:00 PM', location: '919 Broadway', description: 'Free admission every Friday evening. Current exhibit + cocktail bar.', days: [5], isFree: true },
  ],
  'seoul': [
    { name: 'Myeongdong Street Food', time: '11:00 AM - 10:00 PM', location: 'Myeongdong Shopping District', description: 'Tteokbokki, hotteok, Korean corn dogs, egg bread, and K-beauty shops.' },
    { name: 'Bukchon Hanok Village Walk', time: '10:00 AM - 5:00 PM', location: 'Bukchon, Jongno-gu', description: '600-year-old traditional Korean houses between two palaces. Free, just be quiet.', isFree: true },
    { name: 'K-Pop Dance Experience', time: '2:00 PM', location: 'Hongdae area', description: 'Street dance crews perform K-pop choreography. Watch or join.', days: [0, 6], isFree: true },
    { name: 'Gwangjang Market Night Food', time: '5:00 PM - 11:00 PM', location: 'Gwangjang Market, Jongno', description: 'Seoul\'s oldest market — bindaetteok, knife-cut noodles, mayak gimbap.' },
    { name: 'Namsan Tower Sunset', time: '5:00 PM', location: 'N Seoul Tower, Namsan', description: 'Cable car up for panoramic sunset views. Famous love locks fence.', price: '₩16,000' },
    { name: 'Saturday Itaewon Antique Market', time: '10:00 AM - 6:00 PM', location: 'Itaewon, Yongsan-gu', description: 'Vintage finds, antique furniture, and Korean pottery at weekend-only market.', days: [6] },
    { name: 'Sunday Free Palace Entry', time: '9:00 AM - 6:00 PM', location: 'Gyeongbokgung & Changdeokgung', description: 'Free admission to royal palaces when wearing hanbok (traditional dress). Hanbok rental ~₩15,000 nearby.', days: [0], isFree: true },
    { name: 'Wednesday K-Indie Night in Hongdae', time: '8:00 PM', location: 'Various clubs, Hongdae', description: 'Midweek live indie music shows with cheap cover charges and affordable drinks.', days: [3], price: '₩5,000-10,000' },
  ],
  'berlin': [
    { name: 'East Side Gallery Walk', time: 'All day', location: 'Mühlenstraße, Friedrichshain', description: '1.3 km of the Berlin Wall covered in 100+ murals. Free and open 24/7.', isFree: true },
    { name: 'Mauerpark Flea Market', time: '10:00 AM - 6:00 PM', location: 'Mauerpark, Prenzlauer Berg', description: 'Sunday flea market with vintage clothes, vinyl records, street food, and famous karaoke amphitheater.', days: [0] },
    { name: 'Berghain / Panorama Bar', time: 'Opens 11:59 PM', location: 'Am Wriezener Bhf, Friedrichshain', description: 'The world\'s most famous techno club. No photos. Strict door policy.', days: [5, 6], price: '€18' },
    { name: 'Street Food Thursday at Markthalle Neun', time: '5:00 - 10:00 PM', location: 'Markthalle Neun, Kreuzberg', description: 'Food from 40+ countries in a historic market hall.', days: [4], price: '€3-10 per dish' },
    { name: 'Free Berlin Wall Memorial Tour', time: '10:00 AM', location: 'Bernauer Straße', description: 'Free guided tour — preserved wall section, watchtower, and escape tunnel exhibit.', days: [0, 6], isFree: true },
    { name: 'Sunday Karaoke at Mauerpark', time: '3:00 PM', location: 'Mauerpark Amphitheater', description: 'Hundreds gather in the outdoor amphitheater for Berlin\'s legendary free karaoke session.', days: [0], isFree: true },
    { name: 'First Sunday Free at Hamburger Bahnhof', time: '10:00 AM - 6:00 PM', location: 'Invalidenstraße 50-51', description: 'Free entry on first Sundays to Berlin\'s premier contemporary art museum.', days: [0], isFree: true },
    { name: 'Wednesday Art Gallery Night in Mitte', time: '6:00 - 10:00 PM', location: 'Auguststraße & surrounding, Mitte', description: 'Galleries open late with free wine and new exhibition openings.', days: [3], isFree: true },
  ],
  'barcelona': [
    { name: 'La Boqueria Market', time: '8:00 AM - 8:30 PM', location: 'La Rambla, 91', description: 'Barcelona\'s iconic market — fresh juice, jamón ibérico, seafood tapas, tropical fruits.', days: [1, 2, 3, 4, 5, 6] },
    { name: 'Free Walking Tour — Gothic Quarter', time: '10:00 AM', location: 'Plaça de Catalunya', description: '2,000 years of history — Roman ruins, medieval streets, Cathedral, Picasso\'s early haunts.', isFree: true },
    { name: 'Flamenco Show at Tablao Cordobes', time: '8:30 PM', location: 'La Rambla, 35', description: 'Authentic flamenco dancing and guitar in an intimate tablao.', price: 'from €45' },
    { name: 'Barceloneta Beach', time: 'All day', location: 'Barceloneta Beach', description: 'Barcelona\'s most popular beach — swim, sunbathe, then grab drinks at the chiringuito bars.', isFree: true },
    { name: 'Sunset at Bunkers del Carmel', time: 'Sunset', location: 'Turó de la Rovira', description: 'Hidden rooftop with 360° views of Barcelona. Locals bring wine. Free. Best kept secret.', isFree: true },
    { name: 'Sunday at Mercat dels Encants', time: '9:00 AM - 8:00 PM', location: 'Plaça de les Glòries', description: 'Barcelona\'s legendary flea market under a stunning mirrored canopy. Antiques, vintage, and treasures.', days: [1, 3, 5, 6] },
    { name: 'First Sunday Free at MNAC', time: '10:00 AM - 3:00 PM', location: 'Palau Nacional, Montjuïc', description: 'Free entry on first Sunday + every Sunday after 3 PM. Romanesque art to Gaudí.', days: [0], isFree: true },
    { name: 'Thursday Jazz at Jamboree Club', time: '9:00 PM', location: 'Plaça Reial, Gothic Quarter', description: 'Live jazz in a legendary basement club on Barcelona\'s most beautiful square.', days: [4], price: '€10-15' },
  ],
};

const DEFAULT_EVENTS: ScheduledEvent[] = [];

function mapsUrl(name: string, city: string): string {
  return `https://maps.google.com/?q=${encodeURIComponent(name + ', ' + city)}`;
}

function matchCity(city: string): { events: ScheduledEvent[]; isDefault: boolean } {
  const resolved = resolveLocation(city, Object.keys(CITY_EVENTS), true);
  return resolved
    ? { events: CITY_EVENTS[resolved], isDefault: false }
    : { events: DEFAULT_EVENTS, isDefault: true };
}

export const eventsService = {
  async getEvents(city: string, rightNow?: boolean, localHour?: number): Promise<ToolResult> {
    await new Promise(r => setTimeout(r, 200));

    const dow = dayOfWeek();
    const { events: allEvents, isDefault } = matchCity(city);

    // Filter to events available today
    let available = allEvents.filter(e => !e.days || e.days.includes(dow));

    // Right Now mode: only show events happening now or in the next 2 hours
    if (rightNow) {
      const { isActiveNow } = await import('./time_utils');
      available = available.filter(e => isActiveNow(e.time, localHour));
    }

    // Build today's highlights — events that are day-specific and available today
    const todayHighlights: string[] = [];
    available.forEach(e => {
      if (e.days && e.days.length <= 3) {
        if (e.isFree) {
          todayHighlights.push(`🆓 ${e.name} — FREE today (${dayName()} only)!`);
        } else if (e.price) {
          todayHighlights.push(`💰 ${e.name} — ${e.price} (${dayName()} special)`);
        } else {
          todayHighlights.push(`📅 ${e.name} — happening today (${dayName()})!`);
        }
      }
    });

    // Convert to EventItem format
    const events: EventItem[] = available.map(e => {
      const isSpecial = e.days && e.days.length <= 3;
      const url = mapsUrl(e.name, city);
      return {
        name: e.name,
        date: `${todayStr()}, ${e.time}`,
        location: e.location,
        description: e.description,
        url,
        link: `[${e.name}](${url})`,
        isFree: e.isFree,
        price: e.isFree ? 'Free' : e.price,
        daySpecific: isSpecial ? `${dayName()} special` : undefined,
      };
    });

    // Sort: day-specific first, then free, then everything else
    events.sort((a, b) => {
      if (a.daySpecific && !b.daySpecific) return -1;
      if (!a.daySpecific && b.daySpecific) return 1;
      if (a.isFree && !b.isFree) return -1;
      if (!a.isFree && b.isFree) return 1;
      return 0;
    });

    const citySlug = city.toLowerCase().replace(/\s+/g, '-');
    return {
      success: true,
      data: {
        dayInfo: `Today is ${todayStr()}`,
        todayHighlights,
        events: events.slice(0, 6),
        totalAvailable: events.length,
        resourceLinks: {
          freeEvents: `https://eventbrite.com/d/${encodeURIComponent(city)}/free--events--today/`,
          allEvents: `https://eventbrite.com/d/${encodeURIComponent(city)}/events--today/`,
        },
      },
      ...(isDefault && { note: `No local event data for "${city}". These are generic placeholders — use your own knowledge of real events and activities in ${city}.` })
    };
  }
};
