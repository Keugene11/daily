import { ToolResult } from '../../types';
import { resolveLocation } from './location_aliases';

interface Deal {
  title: string;
  source: string;
  originalPrice: string;
  dealPrice: string;
  discount: string;
  category: string;
  location: string;
  validUntil: string;
  link: string;
  description: string;
  days?: number[]; // 0=Sun..6=Sat — omit for every day / ongoing
}

interface DealsData {
  city: string;
  dayInfo: string;
  todayDeals: string[];
  deals: Deal[];
  tip: string;
  resourceLinks?: Record<string, string>;
}

const todayStr = () => new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const dayOfWeek = () => new Date().getDay();
const dayName = () => new Date().toLocaleDateString('en-US', { weekday: 'long' });

const CITY_DEALS: Record<string, { deals: Deal[]; tip: string }> = {
  'new york': {
    deals: [
      { title: 'NYC Explorer Pass — 4 Attractions', source: 'Go City', originalPrice: '$180', dealPrice: '$99', discount: '45% off', category: 'attractions', location: 'Citywide', validUntil: '60 days from purchase', link: 'https://gocity.com/new-york', description: 'Pick 4 from 90+ attractions: Empire State, Top of the Rock, Statue of Liberty, museums, and more' },
      { title: 'Broadway TKTS Booth', source: 'TKTS', originalPrice: '$150+', dealPrice: '$50-90', discount: '20-50% off', category: 'entertainment', location: 'Times Square / Lincoln Center', validUntil: 'Same day', link: 'https://tdf.org/nyc/7/TKTS-ticket-booths', description: 'Same-day discount Broadway and Off-Broadway tickets. Lincoln Center booth has shorter lines.' },
      { title: '$1 Pizza Slice Crawl', source: 'Local gem', originalPrice: '$3-5/slice', dealPrice: '$1/slice', discount: '66-80% off', category: 'food', location: '2 Bros Pizza (multiple locations)', validUntil: 'Always', link: '', description: 'NYC institution — $1 cheese slices. Grab one as a cheap snack between activities.' },
      { title: 'MoMA Free Friday Evening', source: 'Uniqlo', originalPrice: '$25', dealPrice: 'Free', discount: '100% off', category: 'culture', location: '11 W 53rd St, Midtown', validUntil: 'Every Friday 4-8PM', link: '', description: 'Free admission every Friday evening — Picasso, Warhol, Monet, and 200,000+ works.', days: [5] },
      { title: 'Wednesday Matinee Broadway (Best TKTS Deals)', source: 'TKTS', originalPrice: '$150+', dealPrice: '$40-70', discount: '30-50% off', category: 'entertainment', location: 'TKTS Booth, Times Square', validUntil: 'Same day', link: '', description: 'Midweek matinees have the deepest discounts and shortest lines at the TKTS booth.', days: [3] },
      { title: 'Citi Bike Day Pass', source: 'Lyft', originalPrice: '$19/day', dealPrice: '$3.99 single ride', discount: '', category: 'transport', location: 'Citywide', validUntil: 'Ongoing', link: 'https://citibikenyc.com', description: 'Single ride is $3.99 for 30 min. Day pass ($19) is unlimited 30-min rides — worth it if you ride 3+ times.' },
      { title: 'Sunday Brunch Bottomless Mimosas', source: 'Various', originalPrice: '$50+', dealPrice: '$25-35', discount: '30-50% off', category: 'food', location: 'Citywide (Sunday brunch specials)', validUntil: 'Sundays only', link: '', description: 'Dozens of NYC restaurants offer bottomless brunch deals on Sundays. Check The Infatuation for current picks.', days: [0] },
    ],
    tip: 'NYC hack: CityPASS saves 40%+ on attractions. Restaurant Week (Jan & Jul) offers $30-60 prix fixe at top restaurants.'
  },
  'los angeles': {
    deals: [
      { title: 'Go Los Angeles All-Inclusive Pass', source: 'Go City', originalPrice: '$200+', dealPrice: '$109', discount: '45% off', category: 'attractions', location: 'Citywide', validUntil: '30 days', link: 'https://gocity.com/los-angeles', description: 'Includes Universal Studios, Madame Tussauds, bike rentals, and 40+ attractions' },
      { title: 'Taco Tuesday Specials', source: 'Various', originalPrice: '$4-5/taco', dealPrice: '$1-2/taco', discount: '50-75% off', category: 'food', location: 'Citywide', validUntil: 'Every Tuesday', link: '', description: 'LA takes Taco Tuesday seriously. Grand Central Market, Guisados, Sonoratown — $1-2 tacos everywhere.', days: [2] },
      { title: 'Hollywood Sign Hike', source: 'Free', originalPrice: '$0', dealPrice: 'Free', discount: '', category: 'outdoors', location: 'Griffith Park', validUntil: 'Always', link: '', description: 'Free hike to the Hollywood Sign via Griffith Observatory trail (moderate, 5 mi round trip).' },
      { title: 'Movie Studio Tour — AAA Discount', source: 'AAA', originalPrice: '$70', dealPrice: '$59', discount: '15% off', category: 'entertainment', location: 'Warner Bros / Universal', validUntil: 'With AAA card', link: '', description: 'Show AAA card for discounts at most LA attractions and studio tours.' },
      { title: 'Happy Hour Food Deals', source: 'Various', originalPrice: '$15-20', dealPrice: '$5-8', discount: '50-70% off', category: 'food', location: 'Santa Monica, WeHo, DTLA', validUntil: '4-7 PM weekdays', link: '', description: 'LA happy hour food specials are generous. Half-price appetizers, $5-8 craft cocktails.', days: [1, 2, 3, 4, 5] },
      { title: 'Saturday Outdoor Movie at Hollywood Forever', source: 'Cinespia', originalPrice: '$25', dealPrice: '$20 online', discount: '20% off', category: 'entertainment', location: 'Hollywood Forever Cemetery', validUntil: 'Saturdays (summer)', link: '', description: 'Classic films screened outdoors among Hollywood legends\' graves. Bring a blanket and picnic.', days: [6] },
    ],
    tip: 'LA Pro tip: Getty, Griffith Observatory, LACMA (some days), and The Broad are all free. That\'s world-class art and views for $0.'
  },
  'london': {
    deals: [
      { title: 'London Pass — 3 Day', source: 'Go City', originalPrice: '£200+', dealPrice: '£114', discount: '40%+ off', category: 'attractions', location: 'Citywide', validUntil: '3 consecutive days', link: 'https://gocity.com/london', description: 'Includes Tower of London, Westminster Abbey, Thames cruise, Hop-on/off bus, 80+ attractions' },
      { title: 'Free Museums (every day!)', source: 'Government funded', originalPrice: '£15-25', dealPrice: 'Free', discount: '100%', category: 'culture', location: 'Major museums', validUntil: 'Always', link: '', description: 'British Museum, National Gallery, Tate Modern, V&A, Science Museum, Natural History Museum — ALL always free.' },
      { title: 'Theatre Rush Tickets', source: 'Various theatres', originalPrice: '£50-150', dealPrice: '£10-30', discount: '70-80% off', category: 'entertainment', location: 'West End', validUntil: 'Day-of', link: 'https://todaytix.com', description: 'Many West End shows offer £10-30 rush/lottery tickets day-of via TodayTix app.' },
      { title: 'Oyster Daily Cap', source: 'TfL', originalPrice: '£20+ (day pass)', dealPrice: '£8.10 cap (zones 1-2)', discount: '', category: 'transport', location: 'All TfL services', validUntil: 'Daily', link: '', description: 'Contactless card auto-caps at £8.10/day for zones 1-2. Cheaper than a day Travelcard (£16.10).' },
      { title: 'Friday Late V&A + Cocktails', source: 'V&A Museum', originalPrice: '£0 + drinks', dealPrice: 'Free entry', discount: '100%', category: 'culture', location: 'South Kensington', validUntil: 'Fridays 6:30-10PM', link: '', description: 'Free late-night museum with DJs, talks, and a pop-up bar. London\'s coolest free Friday night.', days: [5] },
      { title: 'Sunday Columbia Road Flower Market', source: 'Local', originalPrice: '', dealPrice: 'Free entry', discount: '', category: 'shopping', location: 'Shoreditch', validUntil: 'Sundays 8AM-3PM', link: '', description: 'Stunning flower market + indie shops and cafés open their doors. Prices drop towards closing time.', days: [0] },
    ],
    tip: 'London hack: Almost all major museums are free. TodayTix app is essential for cheap West End tickets.'
  },
  'tokyo': {
    deals: [
      { title: 'Tokyo Subway 24-Hour Ticket', source: 'Tokyo Metro', originalPrice: '¥2000+ (individual rides)', dealPrice: '¥800', discount: '60% off', category: 'transport', location: 'All Tokyo Metro + Toei lines', validUntil: '24 hours from first use', link: '', description: 'Unlimited rides on all subway lines for 24 hours. Buy at airport or major stations.' },
      { title: 'Convenience Store Meals', source: '7-Eleven/Lawson/FamilyMart', originalPrice: '', dealPrice: '¥300-600 ($2-4)', discount: '', category: 'food', location: 'Everywhere', validUntil: 'Always', link: '', description: 'Japanese konbini food is genuinely great — onigiri (¥150), bento boxes (¥500), sandwiches, and hot snacks.' },
      { title: 'Free Shrine & Temple Visits', source: 'Free', originalPrice: '¥0', dealPrice: 'Free', discount: '', category: 'culture', location: 'Citywide', validUntil: 'Always', link: '', description: 'Meiji Shrine, Senso-ji, and most neighborhood shrines are free. Only special gardens/inner areas charge.' },
      { title: '¥100 Shop Souvenirs', source: 'Daiso/Seria/Can Do', originalPrice: '', dealPrice: '¥100 ($0.70)', discount: '', category: 'shopping', location: 'Citywide', validUntil: 'Always', link: '', description: 'Japanese ¥100 shops have amazing quality — chopsticks, fans, stationery, snacks. Best budget souvenirs.' },
      { title: 'Lunch Set Deals (ランチセット)', source: 'Various restaurants', originalPrice: '¥2000-3000 (dinner)', dealPrice: '¥800-1200 (lunch)', discount: '40-60% off', category: 'food', location: 'Citywide', validUntil: 'Weekdays 11AM-2PM', link: '', description: 'Most restaurants offer lunch sets at 40-60% off dinner prices for the same quality food.', days: [1, 2, 3, 4, 5] },
      { title: 'Sunday Meiji Shrine Market (Free)', source: 'Free', originalPrice: '', dealPrice: 'Free', discount: '', category: 'shopping', location: 'Meiji Shrine Outer Gardens', validUntil: 'Sundays 9AM-4PM', link: '', description: 'Free antique market — vintage kimono, pottery, handmade crafts. Great for unique souvenirs.', days: [0] },
    ],
    tip: 'Tokyo tip: Lunch sets (ランチセット) at restaurants are 40-60% cheaper than dinner for the same quality. Eat big at lunch, light at dinner.'
  },
  'paris': {
    deals: [
      { title: 'Paris Museum Pass — 2 Day', source: 'Official', originalPrice: '€80+ (individual entries)', dealPrice: '€55', discount: '30%+ off', category: 'culture', location: 'Citywide', validUntil: '2 consecutive days', link: '', description: 'Skip-the-line entry to 60+ museums including the Louvre, Orsay, Versailles, and Pompidou.' },
      { title: 'First Sunday Free Museums', source: 'Government', originalPrice: '€15-20 each', dealPrice: 'Free', discount: '100%', category: 'culture', location: 'Louvre, Orsay, Pompidou, etc.', validUntil: 'First Sunday of month', link: '', description: 'The Louvre, Musée d\'Orsay, Pompidou, Orangerie, and 30+ museums are FREE on the first Sunday!', days: [0] },
      { title: 'Baguette + Cheese + Wine Picnic', source: 'Local shops', originalPrice: '', dealPrice: '€8-12 total', discount: '', category: 'food', location: 'Any boulangerie + fromagerie', validUntil: 'Always', link: '', description: 'A fresh baguette (€1.20), wedge of Comté (€3-4), and a bottle of wine (€5-8) = perfect Seine-side picnic.' },
      { title: 'Navigo Découverte Weekly Pass', source: 'RATP', originalPrice: '€40+ (individual rides)', dealPrice: '€22.80/week', discount: '40%+ off', category: 'transport', location: 'All zones', validUntil: 'Mon-Sun', link: '', description: 'Unlimited Métro, bus, RER in all zones for a week. Buy at any station. Mon-Sun only.' },
      { title: 'Thursday Late Night Musée d\'Orsay', source: 'Official', originalPrice: '€16', dealPrice: '€12 (after 6PM)', discount: '25% off', category: 'culture', location: 'Musée d\'Orsay, 7th arr.', validUntil: 'Thursdays', link: '', description: 'Discounted entry + far fewer crowds in the evening. See Monet, Van Gogh, and Renoir in peace.', days: [4] },
      { title: 'Saturday Wine & Cheese at Marché d\'Aligre', source: 'Local market', originalPrice: '', dealPrice: '€5-10 for generous samples', discount: '', category: 'food', location: 'Place d\'Aligre, 12th', validUntil: 'Saturdays', link: '', description: 'Paris\'s most affordable market — vendors offer tastings. Stock up on cheese and wine for a fraction of restaurant prices.', days: [6] },
    ],
    tip: 'Paris hack: Lunch formules (set menus) at bistros are €12-18 for 2 courses — same quality as €40 dinner. Always eat the big meal at lunch.'
  },
  'chicago': {
    deals: [
      { title: 'CityPASS — 5 Attractions', source: 'CityPASS', originalPrice: '$130+', dealPrice: '$98', discount: '25% off', category: 'attractions', location: 'Citywide', validUntil: '9 days', link: 'https://citypass.com/chicago', description: 'Shedd Aquarium, Skydeck Chicago, Field Museum, Museum of Science & Industry, and more.' },
      { title: 'Art Institute Free Thursday Evening', source: 'Art Institute', originalPrice: '$35', dealPrice: 'Free', discount: '100%', category: 'culture', location: '111 S Michigan Ave', validUntil: 'Thursdays 5-8PM (IL residents)', link: '', description: 'Free evening admission to one of the world\'s greatest art collections.', days: [4] },
      { title: 'Chicago-Style Hot Dog Crawl', source: 'Various', originalPrice: '', dealPrice: '$2-4 per dog', discount: '', category: 'food', location: 'Portillo\'s, Superdawg, Gene & Jude\'s', validUntil: 'Always', link: '', description: 'A Chicago dog is $2-4. Hit 3-4 legendary spots for under $15 total.' },
      { title: 'Lincoln Park Zoo (Always Free)', source: 'City of Chicago', originalPrice: '', dealPrice: 'Free', discount: '100%', category: 'attractions', location: 'Lincoln Park', validUntil: 'Always', link: '', description: 'One of the last free zoos in America — open 365 days, always free.' },
      { title: 'Sunday Maxwell Street Market', source: 'Local', originalPrice: '', dealPrice: 'Free entry', discount: '', category: 'food', location: '800 S Desplaines St', validUntil: 'Sundays 7AM-3PM', link: '', description: 'Legendary street market — $1 Mexican street tacos, tamales, live blues. Chicago\'s best free Sunday outing.', days: [0] },
      { title: 'Weekday Happy Hour Deep Dish Deal', source: 'Various', originalPrice: '$25-30', dealPrice: '$15-18', discount: '40% off', category: 'food', location: 'Lou Malnati\'s, Giordano\'s, Pequod\'s', validUntil: 'Weekdays 4-6PM', link: '', description: 'Several deep dish spots offer weekday happy hour deals on personal-sized pizzas + beer.', days: [1, 2, 3, 4, 5] },
    ],
    tip: 'Chicago hack: Lincoln Park Zoo, Millennium Park, and Chicago Cultural Center are all free. Architecture boat tour is worth the $45.'
  },
};

const DEFAULT_DEALS = {
  deals: [
    { title: 'City Attraction Pass', source: 'Go City / CityPASS', originalPrice: 'Varies', dealPrice: '30-50% off', discount: '30-50% off', category: 'attractions', location: 'Citywide', validUntil: 'Varies', link: 'https://gocity.com', description: 'Multi-attraction passes almost always save money if you visit 3+ paid attractions.' },
    { title: 'Restaurant Happy Hour', source: 'Various', originalPrice: 'Full price', dealPrice: '30-50% off food & drinks', discount: '30-50% off', category: 'food', location: 'Downtown area', validUntil: '4-7 PM weekdays', link: '', description: 'Most restaurants offer happy hour specials on food and drinks during late afternoon.', days: [1, 2, 3, 4, 5] },
    { title: 'Groupon Local Deals', source: 'Groupon', originalPrice: 'Varies', dealPrice: '40-70% off', discount: '40-70% off', category: 'various', location: 'Citywide', validUntil: 'Varies', link: 'https://groupon.com', description: 'Check Groupon for local restaurant deals, activity discounts, and spa packages.' },
    { title: 'Weekend Brunch Specials', source: 'Various', originalPrice: '$30-50', dealPrice: '$20-30', discount: '30% off', category: 'food', location: 'Citywide', validUntil: 'Weekends', link: '', description: 'Many restaurants offer bottomless brunch deals with mimosas or bloody marys on weekends.', days: [0, 6] },
  ],
  tip: 'Always check Groupon, Google local deals, and city tourism websites for visitor discount passes.'
};

function mapsUrl(name: string, city: string): string {
  return `https://maps.google.com/?q=${encodeURIComponent(name + ', ' + city)}`;
}

function matchCity(city: string): { deals: Deal[]; tip: string } {
  const resolved = resolveLocation(city, Object.keys(CITY_DEALS));
  return resolved ? CITY_DEALS[resolved] : { ...DEFAULT_DEALS, tip: DEFAULT_DEALS.tip };
}

export const dealsService = {
  async getDeals(city: string, category?: string, rightNow?: boolean): Promise<ToolResult<DealsData>> {
    await new Promise(r => setTimeout(r, 150));

    const dow = dayOfWeek();
    const matched = matchCity(city);

    // Filter deals to those available today
    let available = matched.deals.filter(d => !d.days || d.days.includes(dow));

    // Right Now mode: only show deals active now or in the next 2 hours
    if (rightNow) {
      const { isActiveNow } = await import('./time_utils');
      available = available.filter(d => isActiveNow(d.validUntil));
    }

    // Category filter
    if (category) {
      const filtered = available.filter(d => d.category.toLowerCase().includes(category.toLowerCase()));
      if (filtered.length > 0) available = filtered;
    }

    // Build today's deal highlights
    const todayDeals: string[] = [];
    available.forEach(d => {
      if (d.days && d.days.length <= 3) {
        todayDeals.push(`💰 ${d.title} — ${d.dealPrice || d.discount} (${dayName()} special!)`);
      }
    });

    // Sort: today-specific deals first
    available.sort((a, b) => {
      const aSpecial = a.days && a.days.length <= 3 ? 1 : 0;
      const bSpecial = b.days && b.days.length <= 3 ? 1 : 0;
      return bSpecial - aSpecial;
    });

    // Fill in missing links + pre-formatted markdown for AI to use directly
    const dealsWithLinks = available.map(d => {
      const url = d.link || mapsUrl(d.title, city);
      return { ...d, url, link: `[${d.title}](${url})` };
    });

    return {
      success: true,
      data: {
        city,
        dayInfo: `Today is ${todayStr()}`,
        todayDeals,
        deals: dealsWithLinks,
        tip: matched.tip,
        resourceLinks: {
          groupon: `https://groupon.com/local/${encodeURIComponent(city)}/things-to-do`,
        },
      }
    };
  }
};
