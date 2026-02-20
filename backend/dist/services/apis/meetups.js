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
exports.meetupService = void 0;
const location_aliases_1 = require("./location_aliases");
const todayStr = () => new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const dayOfWeek = () => new Date().getDay();
const dayName = () => new Date().toLocaleDateString('en-US', { weekday: 'long' });
const CITY_MEETUPS = {
    'new york': [
        { name: 'NY Tech Meetup', time: '6:30 PM', location: 'NYU Skirball Center, 566 LaGuardia Pl', description: 'NYC\'s largest monthly tech meetup. Product demos, networking, and Q&A with founders. 800+ attendees.', category: 'meetup', days: [2], isFree: true, topics: ['startups', 'product'] },
        { name: 'Hack Manhattan', time: '7:00 PM - 11:00 PM', location: '137 W 14th St, 2nd Floor', description: 'Open hackerspace with electronics lab, 3D printers, and coworking. Drop-in welcome.', category: 'coworking', days: [2, 4, 6], price: '$10 drop-in', topics: ['hardware', 'maker'] },
        { name: 'NYC Python Meetup', time: '7:00 PM', location: 'Microsoft Reactor, Times Square', description: 'Monthly Python talks and lightning presentations. Pizza and networking after.', category: 'meetup', days: [3], isFree: true, topics: ['python', 'AI', 'data'] },
        { name: 'Startup Grind NYC', time: '6:00 - 9:00 PM', location: 'WeWork, 115 Broadway', description: 'Fireside chat with a successful founder. Networking, drinks, and Q&A. Google for Startups community.', category: 'networking', days: [4], isFree: true, topics: ['startups', 'VC', 'founders'] },
        { name: 'Brooklyn JS', time: '7:00 PM', location: '61 Local, 61 Bergen St, Brooklyn', description: 'JavaScript meetup in a bar. Casual 10-min talks, cheap drinks, good vibes. Community favorite.', category: 'meetup', days: [4], isFree: true, topics: ['javascript', 'web dev'] },
        { name: 'NYC Hackathon at MLH', time: '9:00 AM - 9:00 PM', location: 'Various venues (MLH events)', description: 'Weekend hackathons organized by Major League Hacking. Build, demo, win prizes.', category: 'hackathon', days: [0, 6], price: 'free-$25', topics: ['coding', 'AI', 'web dev'] },
        { name: 'AI/ML NYC', time: '6:30 PM', location: 'Google NYC, 111 8th Ave', description: 'Deep dives into machine learning research and applications. Papers, demos, and discussion.', category: 'meetup', days: [1], isFree: true, topics: ['AI', 'machine learning', 'data science'] },
        { name: 'Grand Central Tech Open House', time: '5:00 - 7:00 PM', location: 'Grand Central Tech, 335 Madison Ave', description: 'Tour NYC\'s premier free startup accelerator in Grand Central. Meet current cohort founders.', category: 'networking', days: [5], isFree: true, topics: ['startups', 'accelerator'] },
        { name: 'NYC Founders & Coders', time: '10:00 AM - 6:00 PM', location: 'The Yard, Williamsburg', description: 'Free peer-led coding bootcamp. Full-stack JavaScript curriculum. Build real projects.', category: 'workshop', days: [6], isFree: true, topics: ['coding', 'javascript', 'bootcamp'] },
        { name: 'Women Who Code NYC', time: '6:30 PM', location: 'Flatiron School, 11 Broadway', description: 'Technical talks, code reviews, and career workshops. All genders welcome as allies.', category: 'meetup', days: [3], isFree: true, topics: ['coding', 'diversity', 'career'] },
    ],
    'san francisco': [
        { name: 'SF Python Meetup', time: '7:00 PM', location: 'Holberton School, 972 Mission St', description: 'Python talks, lightning rounds, and networking. One of the largest Python groups globally.', category: 'meetup', days: [3], isFree: true, topics: ['python', 'AI', 'data'] },
        { name: 'Startup Grind SF', time: '6:00 - 9:00 PM', location: 'The Village SF, 969 Market St', description: 'Monthly fireside chat with top founders and VCs. Part of the global Google for Startups network.', category: 'networking', days: [1], isFree: true, topics: ['startups', 'VC', 'founders'] },
        { name: 'AI Tinkerers SF', time: '6:30 PM', location: 'Various venues, SoMa', description: 'Hands-on AI demos and discussions. Show what you\'re building with LLMs, agents, and generative AI.', category: 'meetup', days: [4], isFree: true, topics: ['AI', 'LLMs', 'agents'] },
        { name: 'Noisebridge Hackerspace', time: '11:00 AM - 11:00 PM', location: '2169 Mission St, Mission District', description: 'Legendary SF hackerspace. Electronics, 3D printing, sewing, coding. Do-ocracy — just show up and make things.', category: 'coworking', isFree: true, topics: ['hardware', 'maker', 'coding'] },
        { name: 'Hacker Dojo Open Hack Night', time: '6:00 - 10:00 PM', location: '855 Maude Ave, Mountain View', description: 'Community workspace in the heart of Silicon Valley. Open hack nights with free WiFi and whiteboards.', category: 'coworking', days: [2, 4], isFree: true, topics: ['coding', 'startups'] },
        { name: 'SF Startup Weekend', time: '6:00 PM Fri - 9:00 PM Sun', location: 'Galvanize SF, 44 Tehama St', description: '54-hour startup sprint — pitch, form teams, build, and demo. Mentors from top VCs.', category: 'hackathon', days: [5, 6, 0], price: '$99', topics: ['startups', 'product', 'pitching'] },
        { name: 'ReactJS SF', time: '6:30 PM', location: 'Stripe HQ, 510 Townsend St', description: 'React and frontend engineering talks hosted at Stripe. Food, drinks, and swag.', category: 'meetup', days: [2], isFree: true, topics: ['react', 'javascript', 'frontend'] },
        { name: 'YC Demo Day Watch Party', time: '10:00 AM - 2:00 PM', location: 'Various co-working spaces', description: 'Community viewing of Y Combinator Demo Day. Great networking with aspiring founders.', category: 'networking', days: [2, 3], isFree: true, topics: ['startups', 'YC', 'VC'] },
        { name: 'Women in Tech SF', time: '6:00 PM', location: 'Salesforce Tower, Mission St', description: 'Panels, workshops, and networking for women and allies in tech. Sponsored by major companies.', category: 'networking', days: [3], isFree: true, topics: ['diversity', 'career', 'tech'] },
        { name: 'Indie Hackers SF', time: '10:00 AM - 1:00 PM', location: 'WeWork, 600 California St', description: 'Brunch meetup for bootstrapped founders. Share revenue numbers, growth tactics, and war stories.', category: 'networking', days: [6], isFree: true, topics: ['startups', 'indie', 'bootstrapping'] },
    ],
    'los angeles': [
        { name: 'LA Tech Happy Hour', time: '6:00 - 9:00 PM', location: 'WeWork, 12130 Millennium Dr, Playa Vista', description: 'Monthly networking mixer in Silicon Beach. Startup founders, engineers, and VCs.', category: 'networking', days: [4], isFree: true, topics: ['startups', 'networking'] },
        { name: 'LA Hacks (UCLA)', time: '9:00 AM - 9:00 PM', location: 'UCLA Pauley Pavilion', description: 'One of the largest collegiate hackathons on the West Coast. 1000+ hackers, workshops, prizes.', category: 'hackathon', days: [0, 6], isFree: true, topics: ['coding', 'AI', 'mobile'] },
        { name: 'SoCal Python', time: '7:00 PM', location: 'Cross Campus, Santa Monica', description: 'Python talks and coding sessions. From beginners to ML engineers. Pizza provided.', category: 'meetup', days: [2], isFree: true, topics: ['python', 'AI', 'data'] },
        { name: 'Startup Grind LA', time: '6:00 - 9:00 PM', location: 'General Assembly, Santa Monica', description: 'Fireside chats with LA\'s top founders. Silicon Beach startup ecosystem networking.', category: 'networking', days: [3], isFree: true, topics: ['startups', 'founders', 'VC'] },
        { name: 'Crashspace Hackerspace', time: '8:00 PM - midnight', location: '10526 Venice Blvd, Culver City', description: 'Community hackerspace with electronics lab, laser cutter, CNC machines. Open house Tuesdays.', category: 'coworking', days: [2], price: '$10 drop-in', topics: ['hardware', 'maker'] },
        { name: 'JS.LA', time: '7:30 PM', location: 'Google LA, 340 Main St, Venice', description: 'LA\'s premier JavaScript meetup. Technical talks, demos, and networking at Google\'s Venice office.', category: 'meetup', days: [4], isFree: true, topics: ['javascript', 'web dev'] },
        { name: 'AI LA Meetup', time: '6:30 PM', location: 'Snap Inc, 2772 Donald Douglas Loop N', description: 'AI and machine learning talks and demos. Hosted at major LA tech companies.', category: 'meetup', days: [1], isFree: true, topics: ['AI', 'machine learning'] },
        { name: 'Santa Monica New Tech', time: '6:00 - 9:00 PM', location: 'The Bungalow, Santa Monica', description: '5-minute product demos from local startups. Audience votes on favorites. Networking after.', category: 'networking', days: [3], isFree: true, topics: ['startups', 'product', 'demos'] },
    ],
    'london': [
        { name: 'London Hackspace', time: '7:00 PM - 10:00 PM', location: '447 Hackney Rd, Hackney', description: 'Community-run hackerspace with electronics bench, 3D printers, woodworking, and a laser cutter.', category: 'coworking', days: [2, 4], price: '£5 drop-in', topics: ['hardware', 'maker'] },
        { name: 'Silicon Drinkabout', time: '6:30 - 9:00 PM', location: 'Various pubs, Shoreditch', description: 'Friday drinks for the London startup scene. Casual networking in a different Shoreditch pub each week.', category: 'networking', days: [5], isFree: true, topics: ['startups', 'networking'] },
        { name: 'London Python Meetup', time: '7:00 PM', location: 'Skills Matter, 10 South Place', description: 'One of the world\'s largest Python meetups. Talks, coding dojos, and monthly pub quizzes.', category: 'meetup', days: [4], isFree: true, topics: ['python', 'AI', 'data'] },
        { name: 'Founders Forum Meetup', time: '6:00 - 8:30 PM', location: 'Google Campus London, 4-5 Bonhill St', description: 'Founder talks and networking at Google\'s free startup campus. Workshop space and free coffee.', category: 'networking', days: [3], isFree: true, topics: ['startups', 'founders'] },
        { name: 'London.js', time: '6:30 PM', location: 'Pusher HQ, Shoreditch', description: 'JavaScript and web development talks. Casual, welcoming community. Beer and pizza.', category: 'meetup', days: [2], isFree: true, topics: ['javascript', 'web dev'] },
        { name: 'Hack the Planet', time: '10:00 AM - 8:00 PM', location: 'Imperial College, South Kensington', description: 'Monthly weekend hackathons. Themes rotate — fintech, healthtech, climate, AI.', category: 'hackathon', days: [6], isFree: true, topics: ['coding', 'hackathon'] },
        { name: 'AI & Deep Learning London', time: '6:30 PM', location: 'DeepMind, 5 New Street Square', description: 'Monthly talks on cutting-edge AI research and applications. Hosted at leading AI labs.', category: 'meetup', days: [1], isFree: true, topics: ['AI', 'deep learning', 'research'] },
        { name: 'Startup Grind London', time: '6:00 - 9:00 PM', location: 'WeWork Moorgate', description: 'Fireside chat with a prominent UK founder. Part of the global Google for Startups community.', category: 'networking', days: [4], isFree: true, topics: ['startups', 'VC'] },
        { name: 'Codebar London', time: '6:30 - 8:30 PM', location: 'Various host companies', description: 'Free coding workshops for underrepresented groups. Pair programming with experienced coaches.', category: 'workshop', days: [2, 3], isFree: true, topics: ['coding', 'diversity', 'beginner'] },
    ],
    'berlin': [
        { name: 'Berlin Startup Drinks', time: '7:00 PM', location: 'St. Oberholz, Rosenthaler Platz', description: 'The legendary startup café. Weekly networking drinks on the 2nd floor. Founders, freelancers, VCs.', category: 'networking', days: [4], isFree: true, topics: ['startups', 'networking'] },
        { name: 'Berlin.JS', time: '7:00 PM', location: 'co.up Community Space, Adalbertstr. 8', description: 'Berlin\'s JavaScript meetup. Talks, lightning rounds, and drinks in Kreuzberg.', category: 'meetup', days: [3], isFree: true, topics: ['javascript', 'web dev'] },
        { name: 'c-base Hackerspace', time: '8:00 PM - late', location: 'Rungestraße 20, near Jannowitzbrücke', description: 'Berlin\'s original hackerspace (since 1995). Electronics, coding, workshops in a spaceship-themed basement.', category: 'coworking', isFree: true, topics: ['hardware', 'maker', 'coding'] },
        { name: 'PyBerlin', time: '7:00 PM', location: 'Delivery Hero, Oranienburger Str. 70', description: 'Monthly Python meetup hosted at Berlin tech companies. Talks, pizza, and networking.', category: 'meetup', days: [1], isFree: true, topics: ['python', 'AI', 'data'] },
        { name: 'Berlin Startup Weekend', time: '6:00 PM Fri - 9:00 PM Sun', location: 'Factory Berlin, Rheinsberger Str. 76', description: '54-hour startup sprint. Pitch ideas Friday, build all weekend, demo Sunday. Factory Berlin campus.', category: 'hackathon', days: [5, 6, 0], price: '€49', topics: ['startups', 'product'] },
        { name: 'Rust Berlin', time: '7:00 PM', location: 'Mozilla Berlin, GSG-Hof Schlesische Str.', description: 'Monthly Rust programming meetup. Talks, hack nights, and beginner-friendly workshops.', category: 'meetup', days: [2], isFree: true, topics: ['rust', 'systems', 'coding'] },
        { name: 'AI Berlin Meetup', time: '6:30 PM', location: 'Merantix AI Campus, Lichtenberg', description: 'Europe\'s largest AI campus hosts monthly talks on ML research, NLP, and computer vision.', category: 'meetup', days: [3], isFree: true, topics: ['AI', 'machine learning'] },
        { name: 'Factory Berlin Open Night', time: '6:00 - 10:00 PM', location: 'Factory Berlin Görlitzer Park', description: 'Open evening at Berlin\'s biggest startup campus. Tours, talks, networking with 1000+ members.', category: 'networking', days: [4], isFree: true, topics: ['startups', 'community'] },
    ],
    'tokyo': [
        { name: 'Tokyo Hackerspace', time: '7:00 PM - 10:00 PM', location: 'Nishi-Azabu, Minato-ku', description: 'English-friendly community hackerspace. Electronics, robotics, and coding. Open house Tuesdays.', category: 'coworking', days: [2], price: '¥500 drop-in', topics: ['hardware', 'maker', 'coding'] },
        { name: 'Tokyo.rb (Ruby Meetup)', time: '7:00 PM', location: 'Cookpad Inc, Ebisu', description: 'Monthly Ruby meetup. Japan\'s Ruby community is the birthplace of the language. Talks + beer.', category: 'meetup', days: [3], isFree: true, topics: ['ruby', 'coding'] },
        { name: 'Startup Grind Tokyo', time: '7:00 - 9:00 PM', location: 'Google Japan, Roppongi Hills', description: 'Monthly fireside chat with Japanese and international founders. Google campus networking.', category: 'networking', days: [4], isFree: true, topics: ['startups', 'founders'] },
        { name: 'Code Chrysalis Community Night', time: '7:00 PM', location: 'Code Chrysalis, Roppongi', description: 'Tokyo\'s coding bootcamp opens its doors for talks, workshops, and networking.', category: 'workshop', days: [3], isFree: true, topics: ['coding', 'bootcamp', 'career'] },
        { name: 'Tokyo AI Meetup', time: '7:00 PM', location: 'LINE Corp HQ, Shinjuku', description: 'AI and machine learning talks with Japan\'s leading researchers. Simultaneous JP/EN translation.', category: 'meetup', days: [2], isFree: true, topics: ['AI', 'machine learning'] },
        { name: 'Hacker News Tokyo Meetup', time: '7:00 PM', location: 'Hub Tokyo, Meguro', description: 'Monthly meetup for the HN crowd in Tokyo. Startup discussions, tech debates, and craft beer.', category: 'networking', days: [5], isFree: true, topics: ['startups', 'tech', 'HN'] },
        { name: 'Weekend Hackathon at LODGE', time: '10:00 AM - 7:00 PM', location: 'Yahoo! LODGE, Chiyoda', description: 'Free coworking space hosts regular weekend hackathons. Open to all skill levels.', category: 'hackathon', days: [0, 6], isFree: true, topics: ['coding', 'hackathon'] },
        { name: 'Tokyo Dev Coffee', time: '10:00 AM - 12:00 PM', location: 'Various cafés, Shibuya', description: 'Casual Saturday morning coffee for developers and tech workers. English-friendly.', category: 'networking', days: [6], isFree: true, topics: ['networking', 'coding'] },
    ],
    'chicago': [
        { name: 'ChiPy (Chicago Python)', time: '7:00 PM', location: 'Braintree, 222 W Merchandise Mart Plaza', description: 'One of the most active Python meetups in the US. Talks, office hours, and mentorship.', category: 'meetup', days: [4], isFree: true, topics: ['python', 'AI', 'data'] },
        { name: 'Chicago Startup Drinks', time: '6:00 - 9:00 PM', location: 'The Aviary, West Loop', description: 'Monthly networking mixer for Chicago\'s startup community. Founders, engineers, and investors.', category: 'networking', days: [3], isFree: true, topics: ['startups', 'networking'] },
        { name: 'Pumping Station: One', time: '7:00 PM - 10:00 PM', location: '3519 N Elston Ave, Avondale', description: 'Chicago\'s premier hackerspace. CNC, 3D printing, woodworking, electronics, and coding.', category: 'coworking', days: [2, 4], price: '$10 drop-in', topics: ['hardware', 'maker'] },
        { name: 'Chicago JS', time: '6:30 PM', location: 'Groupon HQ, 600 W Chicago Ave', description: 'Monthly JavaScript meetup at major tech companies. Technical talks and networking.', category: 'meetup', days: [2], isFree: true, topics: ['javascript', 'web dev'] },
        { name: '1871 Open House', time: '5:00 - 7:00 PM', location: '1871, 222 W Merchandise Mart Plaza', description: 'Tour Chicago\'s flagship startup incubator. 400+ startups, meet founders, networking events.', category: 'networking', days: [5], isFree: true, topics: ['startups', 'accelerator'] },
        { name: 'Chicago Hackathon', time: '9:00 AM - 9:00 PM', location: 'University of Chicago, Hyde Park', description: 'Weekend hackathons organized by UChicago and Northwestern. Open to all skill levels.', category: 'hackathon', days: [0, 6], isFree: true, topics: ['coding', 'AI'] },
        { name: 'Chi Hack Night', time: '6:00 - 9:00 PM', location: 'Teamwork, 222 W Merchandise Mart Plaza', description: 'Weekly civic tech event. Build apps for public good, hear from city leaders, network.', category: 'meetup', days: [2], isFree: true, topics: ['civic tech', 'coding', 'community'] },
        { name: 'AI Chicago', time: '6:30 PM', location: 'Google Chicago, 320 N Morgan St', description: 'Monthly talks on AI, ML, and data science applications. Hosted at major Chicago tech offices.', category: 'meetup', days: [1], isFree: true, topics: ['AI', 'machine learning', 'data science'] },
    ],
    'austin': [
        { name: 'Austin Python Meetup', time: '7:00 PM', location: 'Capital Factory, 701 Brazos St', description: 'Monthly Python talks at Austin\'s biggest startup incubator. From data science to web dev.', category: 'meetup', days: [3], isFree: true, topics: ['python', 'data', 'AI'] },
        { name: 'Capital Factory Open House', time: '5:00 - 8:00 PM', location: 'Capital Factory, 701 Brazos St', description: 'Austin\'s most iconic startup campus. Weekly networking, startup demos, and coworking.', category: 'networking', days: [4], isFree: true, topics: ['startups', 'accelerator'] },
        { name: 'ATX Hack for Change', time: '9:00 AM - 6:00 PM', location: 'St. Edward\'s University', description: 'Weekend civic hackathon. Build solutions for Austin\'s biggest challenges. All skill levels.', category: 'hackathon', days: [0, 6], isFree: true, topics: ['civic tech', 'coding'] },
        { name: 'Austin JS', time: '6:30 PM', location: 'Dosh, 901 S MoPac', description: 'Austin\'s JavaScript community. Technical talks, demos, and deep dives into React, Node, and more.', category: 'meetup', days: [2], isFree: true, topics: ['javascript', 'web dev'] },
        { name: 'Startup Grind Austin', time: '6:00 - 9:00 PM', location: 'WeWork, Congress Ave', description: 'Monthly fireside chats with Austin founders. Google for Startups community.', category: 'networking', days: [1], isFree: true, topics: ['startups', 'founders', 'VC'] },
        { name: 'ATX AI Meetup', time: '6:30 PM', location: 'Indeed HQ, Domain', description: 'AI and ML talks from Austin\'s growing tech scene. Research papers, tools, and applications.', category: 'meetup', days: [4], isFree: true, topics: ['AI', 'machine learning'] },
        { name: 'Austin Hackerspace', time: '7:00 PM - 10:00 PM', location: '9701 Dessau Rd', description: 'Community makerspace with electronics, 3D printing, and CNC. Open house every Saturday.', category: 'coworking', days: [6], price: '$5 drop-in', topics: ['hardware', 'maker'] },
        { name: 'Built In Austin Tech Talks', time: '6:00 PM', location: 'Various companies', description: 'Tech talks hosted at Austin\'s top companies — Dell, Indeed, Oracle, and startups.', category: 'meetup', days: [3], isFree: true, topics: ['tech', 'career', 'engineering'] },
    ],
    'seattle': [
        { name: 'SeattleJS', time: '6:30 PM', location: 'Galvanize Seattle, Pioneer Square', description: 'Pacific Northwest\'s largest JavaScript meetup. Talks, workshops, and networking.', category: 'meetup', days: [4], isFree: true, topics: ['javascript', 'web dev'] },
        { name: 'Seattle Startup Week Events', time: '5:00 - 9:00 PM', location: 'Various venues, SLU', description: 'Year-round networking events for Seattle\'s startup community. Hosted at Amazon, Madrona, and more.', category: 'networking', days: [3], isFree: true, topics: ['startups', 'VC'] },
        { name: 'Ada\'s Technical Books & Cafe', time: '8:00 AM - 9:00 PM', location: '425 15th Ave E, Capitol Hill', description: 'Tech bookstore and café that hosts coding meetups, workshops, and study groups. Coworking friendly.', category: 'coworking', isFree: true, topics: ['coding', 'community'] },
        { name: 'Seattle AI Meetup', time: '6:30 PM', location: 'Allen Institute for AI, SLU', description: 'Hosted at Paul Allen\'s AI research institute. Monthly talks on cutting-edge AI research.', category: 'meetup', days: [2], isFree: true, topics: ['AI', 'research', 'deep learning'] },
        { name: 'PuPPy (Puget Sound Python)', time: '6:30 PM', location: 'Tune HQ, Fremont', description: 'Seattle\'s Python meetup. Talks, lightning rounds, and beginner-friendly workshops.', category: 'meetup', days: [3], isFree: true, topics: ['python', 'data', 'AI'] },
        { name: 'Seattle Hackathons', time: '9:00 AM - 9:00 PM', location: 'University of Washington', description: 'Student-led hackathons open to the community. Build projects, learn new skills, win prizes.', category: 'hackathon', days: [0, 6], isFree: true, topics: ['coding', 'hackathon'] },
        { name: 'Startup Grind Seattle', time: '6:00 - 9:00 PM', location: 'WeWork, South Lake Union', description: 'Fireside chats with Pacific NW founders. Amazon, Microsoft, and startup ecosystem networking.', category: 'networking', days: [1], isFree: true, topics: ['startups', 'founders'] },
        { name: 'Seattle Rust Meetup', time: '7:00 PM', location: 'Mozilla Seattle, Fremont', description: 'Monthly Rust programming meetup. Systems programming talks and hack nights.', category: 'meetup', days: [4], isFree: true, topics: ['rust', 'systems', 'coding'] },
    ],
    'miami': [
        { name: 'Miami Tech Meetup', time: '6:30 PM', location: 'CIC Miami, 1951 NW 7th Ave, Wynwood', description: 'Miami\'s largest tech meetup. Product demos, startup pitches, and networking in Wynwood.', category: 'meetup', days: [3], isFree: true, topics: ['startups', 'tech'] },
        { name: 'Wynwood Startup Drinks', time: '7:00 - 10:00 PM', location: 'Gramps, 176 NW 24th St, Wynwood', description: 'Casual drinks with Miami\'s tech and startup community. The city\'s main networking event.', category: 'networking', days: [4], isFree: true, topics: ['startups', 'networking'] },
        { name: 'Miami Hack Week', time: '9:00 AM - 6:00 PM', location: 'The LAB Miami, 400 NW 26th St', description: 'Weekend hackathons at Miami\'s flagship coworking space. Web3, AI, and fintech themes.', category: 'hackathon', days: [0, 6], isFree: true, topics: ['coding', 'web3', 'AI'] },
        { name: 'MiamiJS', time: '7:00 PM', location: 'Refresh Miami, Brickell', description: 'JavaScript meetup in Brickell. Talks, code reviews, and networking.', category: 'meetup', days: [2], isFree: true, topics: ['javascript', 'web dev'] },
        { name: 'The LAB Miami Coworking', time: '9:00 AM - 10:00 PM', location: '400 NW 26th St, Wynwood', description: 'Creative coworking in the heart of Wynwood. Day passes available. Regular tech events.', category: 'coworking', price: '$35 day pass', topics: ['coworking', 'startups'] },
        { name: 'Miami AI & Data Science', time: '6:30 PM', location: 'FIU, Biscayne Bay Campus', description: 'AI and data science talks. Mix of academic research and industry applications.', category: 'meetup', days: [1], isFree: true, topics: ['AI', 'data science'] },
        { name: 'Refresh Miami Monthly', time: '6:00 - 9:00 PM', location: 'Various venues, Brickell/Wynwood', description: 'Miami\'s OG tech networking event since 2006. Startup pitches and community building.', category: 'networking', days: [4], isFree: true, topics: ['startups', 'community'] },
        { name: 'Code for Miami', time: '7:00 PM', location: 'CIC Miami, Wynwood', description: 'Civic hacking brigade. Build tech for Miami\'s communities. All skill levels welcome.', category: 'workshop', days: [1], isFree: true, topics: ['civic tech', 'coding'] },
    ],
};
const DEFAULT_MEETUPS = [
    { name: 'Local Tech Meetup', time: '6:30 PM', location: 'Downtown coworking space', description: 'Monthly tech talks and networking. Local developers, designers, and founders share projects and ideas.', category: 'meetup', days: [3, 4], isFree: true, topics: ['tech', 'networking'] },
    { name: 'Startup Networking Mixer', time: '6:00 - 9:00 PM', location: 'Local startup hub', description: 'Casual networking for founders, engineers, and anyone interested in the startup ecosystem.', category: 'networking', days: [4], isFree: true, topics: ['startups', 'networking'] },
    { name: 'Community Hackerspace', time: '7:00 PM - 10:00 PM', location: 'Local makerspace', description: 'Open workshop with electronics, 3D printers, and coding stations. Drop-in welcome.', category: 'coworking', days: [2, 4, 6], price: '$5-10 drop-in', topics: ['hardware', 'maker', 'coding'] },
    { name: 'Weekend Hackathon', time: '9:00 AM - 6:00 PM', location: 'University campus or tech hub', description: 'Build something new in a weekend. Teams form on-site, mentors available, prizes for winners.', category: 'hackathon', days: [0, 6], isFree: true, topics: ['coding', 'hackathon'] },
    { name: 'Coding Workshop for Beginners', time: '10:00 AM - 1:00 PM', location: 'Public library or community center', description: 'Free intro to programming workshop. Learn web development basics. No experience needed.', category: 'workshop', days: [6], isFree: true, topics: ['coding', 'beginner'] },
    { name: 'AI & Data Science Meetup', time: '6:30 PM', location: 'Local tech company', description: 'Talks on AI, machine learning, and data science. Mix of research and practical applications.', category: 'meetup', days: [2], isFree: true, topics: ['AI', 'data science'] },
];
function mapsUrl(name, city) {
    return `https://maps.google.com/?q=${encodeURIComponent(name + ', ' + city)}`;
}
function matchCity(city) {
    const resolved = (0, location_aliases_1.resolveLocation)(city, Object.keys(CITY_MEETUPS));
    return resolved ? CITY_MEETUPS[resolved] : DEFAULT_MEETUPS;
}
exports.meetupService = {
    async getMeetups(city, interests, rightNow) {
        await new Promise(r => setTimeout(r, 200));
        const dow = dayOfWeek();
        const allEvents = matchCity(city);
        // Filter to events available today
        let available = allEvents.filter(e => !e.days || e.days.includes(dow));
        // Right Now mode: only show events happening now or in the next 2 hours
        if (rightNow) {
            const { isActiveNow } = await Promise.resolve().then(() => __importStar(require('./time_utils')));
            available = available.filter(e => isActiveNow(e.time));
        }
        // Build today's highlights — events that are day-specific and available today
        const todayHighlights = [];
        available.forEach(e => {
            if (e.days && e.days.length <= 3) {
                if (e.isFree) {
                    todayHighlights.push(`🆓 ${e.name} — FREE today (${dayName()})!`);
                }
                else if (e.price) {
                    todayHighlights.push(`💻 ${e.name} — ${e.price} (${dayName()})!`);
                }
                else {
                    todayHighlights.push(`📅 ${e.name} — happening today (${dayName()})!`);
                }
            }
        });
        // Convert to MeetupItem format
        const events = available.map(e => {
            const isSpecial = e.days && e.days.length <= 3;
            const url = mapsUrl(e.name, city);
            return {
                name: e.name,
                date: `${todayStr()}, ${e.time}`,
                location: e.location,
                description: e.description,
                category: e.category,
                url,
                link: `[${e.name}](${url})`,
                isFree: e.isFree,
                price: e.isFree ? 'Free' : e.price,
                topics: e.topics,
                daySpecific: isSpecial ? `${dayName()} event` : undefined,
            };
        });
        // Sort: day-specific first, then free, then everything else
        events.sort((a, b) => {
            if (a.daySpecific && !b.daySpecific)
                return -1;
            if (!a.daySpecific && b.daySpecific)
                return 1;
            if (a.isFree && !b.isFree)
                return -1;
            if (!a.isFree && b.isFree)
                return 1;
            return 0;
        });
        // Interest/topic matching — boost events that match user interests
        if (interests && interests.length > 0) {
            const interestStr = interests.join(' ').toLowerCase();
            events.sort((a, b) => {
                const aTopics = (a.topics || []).join(' ').toLowerCase();
                const bTopics = (b.topics || []).join(' ').toLowerCase();
                const aMatch = interests.filter(i => aTopics.includes(i.toLowerCase()) || a.description.toLowerCase().includes(i.toLowerCase())).length;
                const bMatch = interests.filter(i => bTopics.includes(i.toLowerCase()) || b.description.toLowerCase().includes(i.toLowerCase())).length;
                return bMatch - aMatch;
            });
        }
        return {
            success: true,
            data: {
                dayInfo: `Today is ${todayStr()}`,
                todayHighlights,
                events: events.slice(0, 8),
                totalAvailable: events.length,
                resourceLinks: {
                    meetup: `https://www.meetup.com/find/?keywords=tech+startup&location=${encodeURIComponent(city)}`,
                    eventbrite: `https://eventbrite.com/d/${encodeURIComponent(city)}/tech--events--today/`,
                    lumaEvents: `https://lu.ma/discover?keyword=tech&location=${encodeURIComponent(city)}`,
                },
            }
        };
    }
};
