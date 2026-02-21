"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.spotifyService = void 0;
const dedalus_labs_1 = __importDefault(require("dedalus-labs"));
let _dedalusClient = null;
function getDedalus() {
    if (!_dedalusClient) {
        _dedalusClient = new dedalus_labs_1.default({
            apiKey: process.env.DEDALUS_API_KEY || '',
            timeout: 25000,
        });
    }
    return _dedalusClient;
}
function trackUrl(artist, title) {
    const query = encodeURIComponent(`${artist} ${title}`);
    return `https://open.spotify.com/search/${query}`;
}
function track(title, artist) {
    const url = trackUrl(artist, title);
    return {
        title,
        artist,
        spotifyUrl: url,
        markdownLink: `[${title} - ${artist}](${url})`,
        previewUrl: ''
    };
}
async function fetchDeezerPreview(artist, title) {
    try {
        const query = encodeURIComponent(`${artist} ${title}`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`https://api.deezer.com/search?q=${query}&limit=1`, {
            signal: controller.signal
        });
        clearTimeout(timeout);
        const data = await res.json();
        return data?.data?.[0]?.preview || '';
    }
    catch {
        return '';
    }
}
/** Shuffle array using Fisher-Yates */
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
/** Pick n random items from array */
function pickRandom(arr, n) {
    return shuffle(arr).slice(0, n);
}
// ── Vibe-based track pools ──────────────────────────────────────────────
// Large pools organized by energy/vibe. We pick randomly from these.
const VIBE_POOLS = {
    chill: {
        names: ['Slow Afternoon', 'Easy Breeze', 'Sunday Mood', 'Low Key Day', 'Mellow Gold'],
        descriptions: [
            'Laid-back tunes for a no-rush kind of day',
            'Soft grooves and warm vibes to unwind to',
            'The sonic equivalent of a deep breath',
        ],
        tracks: [
            track('Yellow', 'Coldplay'),
            track('The Scientist', 'Coldplay'),
            track('Fix You', 'Coldplay'),
            track('Thinking Out Loud', 'Ed Sheeran'),
            track('Perfect', 'Ed Sheeran'),
            track('Someone Like You', 'Adele'),
            track('Stay', 'Rihanna'),
            track('Fallin\'', 'Alicia Keys'),
            track('No One', 'Alicia Keys'),
            track('Say You Won\'t Let Go', 'James Arthur'),
            track('Lover', 'Taylor Swift'),
            track('Chasing Cars', 'Snow Patrol'),
            track('Banana Pancakes', 'Jack Johnson'),
            track('Better Together', 'Jack Johnson'),
            track('Just the Way You Are', 'Bruno Mars'),
            track('Lazy Song', 'Bruno Mars'),
            track('Let Her Go', 'Passenger'),
            track('A Thousand Years', 'Christina Perri'),
            track('Ho Hey', 'The Lumineers'),
            track('I\'m Yours', 'Jason Mraz'),
            track('Make You Feel My Love', 'Adele'),
            track('All of Me', 'John Legend'),
            track('Here Comes the Sun', 'The Beatles'),
            track('Three Little Birds', 'Bob Marley'),
            track('Riptide', 'Vance Joy'),
        ]
    },
    upbeat: {
        names: ['Good Energy', 'Main Character Walk', 'Serotonin Boost', 'Bright Side', 'Feel Good Inc'],
        descriptions: [
            'Tracks that make you walk a little faster and smile a little wider',
            'Pure good-mood energy for your day out',
            'Uplifting sounds to keep the momentum going',
        ],
        tracks: [
            track('Mr. Blue Sky', 'Electric Light Orchestra'),
            track('September', 'Earth Wind & Fire'),
            track('Lovely Day', 'Bill Withers'),
            track('Everywhere', 'Fleetwood Mac'),
            track('Dreams', 'Fleetwood Mac'),
            track('The Chain', 'Fleetwood Mac'),
            track('Happy', 'Pharrell Williams'),
            track('Can\'t Stop the Feeling', 'Justin Timberlake'),
            track('Shake It Off', 'Taylor Swift'),
            track('Good as Hell', 'Lizzo'),
            track('Shut Up and Dance', 'WALK THE MOON'),
            track('Best Day of My Life', 'American Authors'),
            track('Heat Waves', 'Glass Animals'),
            track('Dog Days Are Over', 'Florence + The Machine'),
            track('Moves Like Jagger', 'Maroon 5'),
            track('Sugar', 'Maroon 5'),
            track('You Make My Dreams', 'Hall & Oates'),
            track('I Wanna Dance with Somebody', 'Whitney Houston'),
            track("Ain't No Mountain High Enough", 'Marvin Gaye'),
            track('Walking on Sunshine', 'Katrina & The Waves'),
            track('Dancing in the Moonlight', 'King Harvest'),
            track('Island in the Sun', 'Weezer'),
            track('Superstition', 'Stevie Wonder'),
            track('Sir Duke', 'Stevie Wonder'),
            track('Uptown Funk', 'Bruno Mars'),
            track('Come and Get Your Love', 'Redbone'),
            track('Golden', 'Harry Styles'),
            track('Watermelon Sugar', 'Harry Styles'),
            track('Good Feeling', 'Flo Rida'),
            track('I Gotta Feeling', 'Black Eyed Peas'),
        ]
    },
    adventure: {
        names: ['Open Road', 'New Horizons', 'Explorer Mode', 'Uncharted', 'Wild Card'],
        descriptions: [
            'Anthems for going somewhere you\'ve never been',
            'The soundtrack to discovering something unexpected',
            'Music that makes the journey as good as the destination',
        ],
        tracks: [
            track('Midnight City', 'M83'),
            track('Little Talks', 'Of Monsters and Men'),
            track('Ophelia', 'The Lumineers'),
            track('Ho Hey', 'The Lumineers'),
            track('Home', 'Edward Sharpe & The Magnetic Zeros'),
            track('On Top of the World', 'Imagine Dragons'),
            track('Radioactive', 'Imagine Dragons'),
            track('Believer', 'Imagine Dragons'),
            track('Budapest', 'George Ezra'),
            track('Shotgun', 'George Ezra'),
            track('Riptide', 'Vance Joy'),
            track('Pompeii', 'Bastille'),
            track('Happier', 'Marshmello'),
            track('Counting Stars', 'OneRepublic'),
            track('Good Life', 'OneRepublic'),
            track('Viva la Vida', 'Coldplay'),
            track('Adventure of a Lifetime', 'Coldplay'),
            track('Paradise', 'Coldplay'),
            track('Wherever I Go', 'OneRepublic'),
            track('Ride', 'Twenty One Pilots'),
            track('Stressed Out', 'Twenty One Pilots'),
            track('Eastside', 'Benny Blanco'),
            track('Waves', 'Dean Lewis'),
            track('Cheap Thrills', 'Sia'),
            track('Chandelier', 'Sia'),
            track('Thunder', 'Imagine Dragons'),
            track('Something Just Like This', 'The Chainsmokers'),
            track('Closer', 'The Chainsmokers'),
            track('Sunflower', 'Post Malone'),
            track('Circles', 'Post Malone'),
        ]
    },
    romantic: {
        names: ['After Dark', 'Candlelight', 'Slow Dance', 'Close to You', 'Twilight Hour'],
        descriptions: [
            'Warm, intimate sounds for a perfect evening together',
            'Songs that turn any moment into a scene from a movie',
            'The kind of music that makes you reach for someone\'s hand',
        ],
        tracks: [
            track('At Last', 'Etta James'),
            track('Let\'s Stay Together', 'Al Green'),
            track('Tired of Being Alone', 'Al Green'),
            track('The Very Thought of You', 'Nat King Cole'),
            track('La Vie en Rose', 'Louis Armstrong'),
            track('Fly Me to the Moon', 'Frank Sinatra'),
            track('Unchained Melody', 'The Righteous Brothers'),
            track('Lover', 'Taylor Swift'),
            track('Endless Love', 'Diana Ross & Lionel Richie'),
            track('I Will Always Love You', 'Whitney Houston'),
            track('My Girl', 'The Temptations'),
            track('Just the Two of Us', 'Grover Washington Jr.'),
            track('Crazy in Love', 'Beyonce'),
            track('Falling', 'Harry Styles'),
            track('Make You Feel My Love', 'Bob Dylan'),
            track('Always', 'Bon Jovi'),
            track('Take My Breath Away', 'Berlin'),
            track('Something', 'The Beatles'),
            track('Can\'t Help Falling in Love', 'Elvis Presley'),
            track('Sway', 'Dean Martin'),
            track('L-O-V-E', 'Nat King Cole'),
            track('Feeling Good', 'Nina Simone'),
            track('No One', 'Alicia Keys'),
            track('XO', 'Beyonce'),
            track('All of Me', 'John Legend'),
            track('I\'m Yours', 'Jason Mraz'),
            track('Perfect', 'Ed Sheeran'),
            track('Stay', 'Rihanna'),
            track('Thinking Out Loud', 'Ed Sheeran'),
            track('A Thousand Years', 'Christina Perri'),
        ]
    },
    nightout: {
        names: ['After Hours', 'Neon Lights', 'Late Night Run', 'City After Dark', 'Night Shift'],
        descriptions: [
            'High-energy tracks for when the sun goes down',
            'The playlist your night out deserves',
            'Beats that hit different after midnight',
        ],
        tracks: [
            track('Blinding Lights', 'The Weeknd'),
            track('Save Your Tears', 'The Weeknd'),
            track('After Hours', 'The Weeknd'),
            track('One More Time', 'Daft Punk'),
            track('Get Lucky', 'Daft Punk'),
            track('Around the World', 'Daft Punk'),
            track('Dancing Queen', 'ABBA'),
            track('Gimme! Gimme! Gimme!', 'ABBA'),
            track('Hung Up', 'Madonna'),
            track('Physical', 'Dua Lipa'),
            track('Don\'t Start Now', 'Dua Lipa'),
            track('Levitating', 'Dua Lipa'),
            track("Don't Stop Me Now", 'Queen'),
            track('Bohemian Rhapsody', 'Queen'),
            track('Yeah!', 'Usher'),
            track('In Da Club', '50 Cent'),
            track('Crazy in Love', 'Beyonce'),
            track('Toxic', 'Britney Spears'),
            track('We Found Love', 'Rihanna'),
            track('Party Rock Anthem', 'LMFAO'),
            track('Starboy', 'The Weeknd'),
            track('Stronger', 'Kanye West'),
            track('Turn Down for What', 'DJ Snake'),
            track('Titanium', 'David Guetta'),
            track('I Gotta Feeling', 'Black Eyed Peas'),
            track('Lean On', 'Major Lazer'),
            track('Where Have You Been', 'Rihanna'),
            track('Poker Face', 'Lady Gaga'),
            track('Bad Guy', 'Billie Eilish'),
            track('Cheap Thrills', 'Sia'),
        ]
    },
    contemplative: {
        names: ['Inner World', 'Deep Thoughts', 'Quiet Hours', 'Mind Wander', 'Still Point'],
        descriptions: [
            'Thoughtful, layered music for when you\'re in your head',
            'Songs that make you stare out windows on purpose',
            'The perfect backdrop for galleries, cafes, and long walks',
        ],
        tracks: [
            track('Mad World', 'Gary Jules'),
            track('Hallelujah', 'Jeff Buckley'),
            track('The Sound of Silence', 'Disturbed'),
            track('Creep', 'Radiohead'),
            track('Everybody Hurts', 'R.E.M.'),
            track('Clocks', 'Coldplay'),
            track('The Scientist', 'Coldplay'),
            track('Skinny Love', 'Birdy'),
            track('A Thousand Years', 'Christina Perri'),
            track('Breathe Me', 'Sia'),
            track('Lovely', 'Billie Eilish'),
            track('Ocean Eyes', 'Billie Eilish'),
            track('when the party\'s over', 'Billie Eilish'),
            track('All Too Well', 'Taylor Swift'),
            track('drivers license', 'Olivia Rodrigo'),
            track('Someone Like You', 'Adele'),
            track('Hello', 'Adele'),
            track('Let It Be', 'The Beatles'),
            track('Imagine', 'John Lennon'),
            track('Yesterday', 'The Beatles'),
            track('Bohemian Rhapsody', 'Queen'),
            track('Wish You Were Here', 'Pink Floyd'),
            track('Chasing Cars', 'Snow Patrol'),
            track('Fix You', 'Coldplay'),
            track('How to Save a Life', 'The Fray'),
            track('Say Something', 'A Great Big World'),
            track('Hurt', 'Johnny Cash'),
            track('Tears in Heaven', 'Eric Clapton'),
            track('Fast Car', 'Tracy Chapman'),
            track('Nothing Compares 2 U', 'Sinead O\'Connor'),
        ]
    },
    groovy: {
        names: ['Pocket Full of Soul', 'Funk & Found', 'Rhythm Section', 'Smooth Operator', 'Bass Face'],
        descriptions: [
            'Funk, soul, and groove that\'ll have you moving without thinking',
            'Irresistible rhythms for a day with flavor',
            'Music with a pulse — impossible to sit still',
        ],
        tracks: [
            track('Superstition', 'Stevie Wonder'),
            track('Sir Duke', 'Stevie Wonder'),
            track('I Wish', 'Stevie Wonder'),
            track('Kiss', 'Prince'),
            track('When Doves Cry', 'Prince'),
            track('Le Freak', 'Chic'),
            track('Good Times', 'Chic'),
            track('Got to Give It Up', 'Marvin Gaye'),
            track('I Want You Back', 'The Jackson 5'),
            track('Off the Wall', 'Michael Jackson'),
            track('Rock with You', 'Michael Jackson'),
            track('Boogie Wonderland', 'Earth Wind & Fire'),
            track('Pick Up the Pieces', 'Average White Band'),
            track('Jungle Boogie', 'Kool & the Gang'),
            track('Celebration', 'Kool & the Gang'),
            track('Play That Funky Music', 'Wild Cherry'),
            track('Uptown Funk', 'Bruno Mars'),
            track('24K Magic', 'Bruno Mars'),
            track('Treasure', 'Bruno Mars'),
            track('Juice', 'Lizzo'),
            track('About Damn Time', 'Lizzo'),
            track('Finesse', 'Bruno Mars'),
            track('Doo Wop (That Thing)', 'Lauryn Hill'),
            track('Passionfruit', 'Drake'),
            track('Redbone', 'Childish Gambino'),
            track('Ain\'t Nobody', 'Rufus & Chaka Khan'),
            track('Billie Jean', 'Michael Jackson'),
            track('Stayin\' Alive', 'Bee Gees'),
            track('September', 'Earth Wind & Fire'),
            track('Get Down Tonight', 'KC and the Sunshine Band'),
        ]
    },
    indie: {
        names: ['Side Streets', 'Record Store Find', 'Blog Era', 'Hidden Gem', 'B-Side Gold'],
        descriptions: [
            'Alternative picks that feel like a personal discovery',
            'Indie-flavored tracks everyone secretly loves',
            'Songs your friend with good taste would recommend',
        ],
        tracks: [
            track('Do I Wanna Know?', 'Arctic Monkeys'),
            track('505', 'Arctic Monkeys'),
            track('R U Mine?', 'Arctic Monkeys'),
            track('Somebody Told Me', 'The Killers'),
            track('Mr. Brightside', 'The Killers'),
            track('Somebody That I Used to Know', 'Gotye'),
            track('Maps', 'Yeah Yeah Yeahs'),
            track('Heads Will Roll', 'Yeah Yeah Yeahs'),
            track('Take Me Out', 'Franz Ferdinand'),
            track('Wake Up', 'Arcade Fire'),
            track('Such Great Heights', 'The Postal Service'),
            track('Young Folks', 'Peter Bjorn and John'),
            track('Sex on Fire', 'Kings of Leon'),
            track('Use Somebody', 'Kings of Leon'),
            track('Lonely Boy', 'The Black Keys'),
            track('Howlin\' for You', 'The Black Keys'),
            track('Two Weeks', 'Grizzly Bear'),
            track('Electric Feel', 'MGMT'),
            track('Kids', 'MGMT'),
            track('All My Friends', 'LCD Soundsystem'),
            track('Dance Yrself Clean', 'LCD Soundsystem'),
            track('Breezeblocks', 'alt-J'),
            track('New Slang', 'The Shins'),
            track('Float On', 'Modest Mouse'),
            track('Pumped Up Kicks', 'Foster the People'),
            track('Sit Next to Me', 'Foster the People'),
            track('Are You Gonna Be My Girl', 'Jet'),
            track('Last Nite', 'The Strokes'),
            track('Reptilia', 'The Strokes'),
            track('Sweater Weather', 'The Neighbourhood'),
        ]
    },
    tropical: {
        names: ['Island Time', 'Warm Breeze', 'Coastline', 'Sun-Drenched', 'Salt Air'],
        descriptions: [
            'Warm, breezy sounds that taste like salt and sunshine',
            'Tropical rhythms and beachside grooves',
            'Music that makes anywhere feel like vacation',
        ],
        tracks: [
            track('Is This Love', 'Bob Marley'),
            track('Three Little Birds', 'Bob Marley'),
            track('Sun Is Shining', 'Bob Marley'),
            track('Could You Be Loved', 'Bob Marley'),
            track('Red Red Wine', 'UB40'),
            track('Santeria', 'Sublime'),
            track('What I Got', 'Sublime'),
            track('No Woman No Cry', 'Bob Marley'),
            track('Girl from Ipanema', 'Stan Getz'),
            track('Mas Que Nada', 'Sergio Mendes'),
            track('Agua de Beber', 'Astrud Gilberto'),
            track('Steal My Sunshine', 'Len'),
            track('Kokomo', 'The Beach Boys'),
            track('Good Vibrations', 'The Beach Boys'),
            track('Wouldn\'t It Be Nice', 'The Beach Boys'),
            track('Tequila Sunrise', 'Eagles'),
            track('Under the Boardwalk', 'The Drifters'),
            track('Sunflower', 'Post Malone'),
            track('Here Comes the Sun', 'The Beatles'),
            track('Savage Love', 'Jawsh 685'),
            track('Mi Gente', 'J Balvin'),
            track('Despacito', 'Luis Fonsi'),
            track('Danza Kuduro', 'Don Omar'),
            track('Vivir Mi Vida', 'Marc Anthony'),
            track('Bailando', 'Enrique Iglesias'),
            track('Taki Taki', 'DJ Snake'),
            track('Summertime', 'DJ Jazzy Jeff'),
            track('Magalenha', 'Sergio Mendes'),
            track('Island in the Sun', 'Weezer'),
            track('Slow Motion', 'Third World'),
        ]
    },
    melancholy: {
        names: ['Rainy Window', 'November Afternoon', 'Blue Hour', 'Gentle Ache', 'Overcast'],
        descriptions: [
            'Beautiful sadness — for when you just want to feel things',
            'Songs that sit with you in the quiet moments',
            'Bittersweet melodies for a reflective day',
        ],
        tracks: [
            track('Skinny Love', 'Bon Iver'),
            track('The Night We Met', 'Lord Huron'),
            track('Mad World', 'Gary Jules'),
            track('Everybody Hurts', 'R.E.M.'),
            track('Hallelujah', 'Jeff Buckley'),
            track('Hurt', 'Johnny Cash'),
            track('Black', 'Pearl Jam'),
            track('Nothing Compares 2 U', 'Sinead O\'Connor'),
            track('Tears in Heaven', 'Eric Clapton'),
            track('Yesterday', 'The Beatles'),
            track('Let It Be', 'The Beatles'),
            track('The Sound of Silence', 'Simon & Garfunkel'),
            track('Bridge Over Troubled Water', 'Simon & Garfunkel'),
            track('Wish You Were Here', 'Pink Floyd'),
            track('Comfortably Numb', 'Pink Floyd'),
            track('Someone Like You', 'Adele'),
            track('Hello', 'Adele'),
            track('Set Fire to the Rain', 'Adele'),
            track('Back to Black', 'Amy Winehouse'),
            track('Love Is a Losing Game', 'Amy Winehouse'),
            track('Skinny Love', 'Birdy'),
            track('Say Something', 'A Great Big World'),
            track('Un-Break My Heart', 'Toni Braxton'),
            track('Jealous', 'Labrinth'),
            track('How to Save a Life', 'The Fray'),
            track('Chasing Cars', 'Snow Patrol'),
            track('Fix You', 'Coldplay'),
            track('The Night We Met', 'Lord Huron'),
            track('Liability', 'Lorde'),
            track('good 4 u', 'Olivia Rodrigo'),
        ]
    },
};
// ── City-specific playlists ─────────────────────────────────────────────
// Kept for iconic cities — tracks are shuffled each time for variety
const CITY_PLAYLISTS = {
    'new york': {
        name: 'NYC Soundtrack',
        description: 'The sounds of the city that never sleeps',
        mood: 'urban & electric',
        playlistUrl: 'https://open.spotify.com/search/new%20york%20city%20soundtrack',
        tracks: [
            track('Empire State of Mind', 'Jay-Z ft. Alicia Keys'),
            track('New York, New York', 'Frank Sinatra'),
            track('Welcome to New York', 'Taylor Swift'),
            track('Juicy', 'The Notorious B.I.G.'),
            track('No Sleep Till Brooklyn', 'Beastie Boys'),
            track('Englishman in New York', 'Sting'),
            track('Stayin\' Alive', 'Bee Gees'),
            track('Girl on Fire', 'Alicia Keys'),
            track('Run This Town', 'Jay-Z ft. Rihanna & Kanye West'),
            track('New York State of Mind', 'Billy Joel'),
        ]
    },
    'los angeles': {
        name: 'LA Cruisin\'',
        description: 'West coast energy for the city of angels',
        mood: 'chill & sunny',
        playlistUrl: 'https://open.spotify.com/search/los%20angeles%20vibes',
        tracks: [
            track('California Love', 'Tupac'),
            track('Hotel California', 'Eagles'),
            track('Under the Bridge', 'Red Hot Chili Peppers'),
            track('Malibu', 'Miley Cyrus'),
            track('Free Fallin\'', 'Tom Petty'),
            track('L.A. Woman', 'The Doors'),
            track('California Dreamin\'', 'The Mamas & The Papas'),
            track('Dani California', 'Red Hot Chili Peppers'),
            track('West Coast', 'Lana Del Rey'),
            track('Beverly Hills', 'Weezer'),
        ]
    },
    'miami': {
        name: 'Miami Heat',
        description: 'Latin beats and tropical bass energy',
        mood: 'tropical & fiery',
        playlistUrl: 'https://open.spotify.com/search/miami%20latin%20vibes',
        tracks: [
            track('Celia', 'Gente De Zona'),
            track('Despacito', 'Luis Fonsi'),
            track('Vivir Mi Vida', 'Marc Anthony'),
            track('Hips Don\'t Lie', 'Shakira'),
            track('Danza Kuduro', 'Don Omar'),
            track('Gasolina', 'Daddy Yankee'),
            track('Conga', 'Gloria Estefan'),
            track('Suavemente', 'Elvis Crespo'),
            track('Oye Como Va', 'Santana'),
            track('Mi Gente', 'J Balvin'),
        ]
    },
    'nashville': {
        name: 'Nashville Nights',
        description: 'Country, Americana, and Music City soul',
        mood: 'country & soulful',
        playlistUrl: 'https://open.spotify.com/search/nashville%20country%20hits',
        tracks: [
            track('Jolene', 'Dolly Parton'),
            track('Tennessee Whiskey', 'Chris Stapleton'),
            track('Ring of Fire', 'Johnny Cash'),
            track('Wagon Wheel', 'Darius Rucker'),
            track('Before He Cheats', 'Carrie Underwood'),
            track('Folsom Prison Blues', 'Johnny Cash'),
            track('Friends in Low Places', 'Garth Brooks'),
            track('Fast Car', 'Tracy Chapman'),
            track('Mammas Don\'t Let Your Babies Grow Up', 'Waylon Jennings'),
            track('The Gambler', 'Kenny Rogers'),
        ]
    },
    'new orleans': {
        name: 'NOLA Jazz & Soul',
        description: 'Jazz, blues, and brass band grooves from the birthplace of jazz',
        mood: 'jazzy & soulful',
        playlistUrl: 'https://open.spotify.com/search/new%20orleans%20jazz',
        tracks: [
            track('When the Saints Go Marching In', 'Louis Armstrong'),
            track('Iko Iko', 'The Dixie Cups'),
            track('House of the Rising Sun', 'The Animals'),
            track('What a Wonderful World', 'Louis Armstrong'),
            track('Walkin\' to New Orleans', 'Fats Domino'),
            track('Down in New Orleans', 'Dr. John'),
            track('Do You Know What It Means to Miss New Orleans', 'Louis Armstrong'),
            track('Blueberry Hill', 'Fats Domino'),
            track('When You\'re Smiling', 'Louis Armstrong'),
            track('Such a Night', 'Dr. John'),
        ]
    },
    'chicago': {
        name: 'Chi-Town Blues & Soul',
        description: 'Blues, house music, and soul from the Windy City',
        mood: 'blues & groovy',
        playlistUrl: 'https://open.spotify.com/search/chicago%20blues%20soul',
        tracks: [
            track('Sweet Home Chicago', 'Robert Johnson'),
            track('Saturday in the Park', 'Chicago'),
            track('Move On Up', 'Curtis Mayfield'),
            track('My Kind of Town', 'Frank Sinatra'),
            track('Jesus Walks', 'Kanye West'),
            track('All Night Long', 'Chance the Rapper'),
            track('Ultralight Beam', 'Kanye West'),
            track('25 or 6 to 4', 'Chicago'),
            track('Homecoming', 'Kanye West'),
            track('All of the Lights', 'Kanye West'),
        ]
    },
    'san francisco': {
        name: 'Bay Area Vibes',
        description: 'Psychedelic rock, indie, and foggy city folk from the Bay',
        mood: 'dreamy & free-spirited',
        playlistUrl: 'https://open.spotify.com/search/san%20francisco%20indie',
        tracks: [
            track('San Francisco', 'Scott McKenzie'),
            track('Sittin\' on the Dock of the Bay', 'Otis Redding'),
            track('Lights', 'Journey'),
            track('White Rabbit', 'Jefferson Airplane'),
            track('I Left My Heart in San Francisco', 'Tony Bennett'),
            track('Somebody to Love', 'Jefferson Airplane'),
            track('Going to California', 'Led Zeppelin'),
            track('If You\'re Going to San Francisco', 'Scott McKenzie'),
            track('Ripple', 'Grateful Dead'),
            track('Touch of Grey', 'Grateful Dead'),
        ]
    },
    'austin': {
        name: 'Keep Austin Weird',
        description: 'Live music capital vibes — indie rock, blues, and Tex-Mex flavor',
        mood: 'indie & raw',
        playlistUrl: 'https://open.spotify.com/search/austin%20texas%20indie%20rock',
        tracks: [
            track('Texas Flood', 'Stevie Ray Vaughan'),
            track('Float On', 'Modest Mouse'),
            track('Lonely Boy', 'The Black Keys'),
            track('La Grange', 'ZZ Top'),
            track('All These Things That I\'ve Done', 'The Killers'),
            track('Gold on the Ceiling', 'The Black Keys'),
            track('Pride and Joy', 'Stevie Ray Vaughan'),
            track('El Camino', 'The Black Keys'),
            track('Howlin\' for You', 'The Black Keys'),
            track('Sharp Dressed Man', 'ZZ Top'),
        ]
    },
    'seattle': {
        name: 'Emerald City Grunge',
        description: 'Grunge, alternative rock, and rainy-day indie from the PNW',
        mood: 'moody & introspective',
        playlistUrl: 'https://open.spotify.com/search/seattle%20grunge%20alternative',
        tracks: [
            track('Smells Like Teen Spirit', 'Nirvana'),
            track('Black Hole Sun', 'Soundgarden'),
            track('Even Flow', 'Pearl Jam'),
            track('Would?', 'Alice in Chains'),
            track('Such Great Heights', 'The Postal Service'),
            track('Heart-Shaped Box', 'Nirvana'),
            track('Man in the Box', 'Alice in Chains'),
            track('Alive', 'Pearl Jam'),
            track('Fell on Black Days', 'Soundgarden'),
            track('Nearly Lost You', 'Screaming Trees'),
        ]
    },
    'london': {
        name: 'London Calling',
        description: 'Britpop, grime, and classic UK rock',
        mood: 'eclectic & bold',
        playlistUrl: 'https://open.spotify.com/search/london%20britpop%20uk',
        tracks: [
            track('London Calling', 'The Clash'),
            track('Waterloo Sunset', 'The Kinks'),
            track('Wannabe', 'Spice Girls'),
            track('Bitter Sweet Symphony', 'The Verve'),
            track('Wonderwall', 'Oasis'),
            track('Under Pressure', 'Queen & David Bowie'),
            track('Livin\' on a Prayer', 'Bon Jovi'),
            track('Don\'t Look Back in Anger', 'Oasis'),
            track('Baker Street', 'Gerry Rafferty'),
            track('A Day in the Life', 'The Beatles'),
        ]
    },
    'paris': {
        name: 'Paris Je T\'Aime',
        description: 'French chanson, electronic, and cafe culture vibes',
        mood: 'romantic & sophisticated',
        playlistUrl: 'https://open.spotify.com/search/paris%20french%20chanson',
        tracks: [
            track('La Vie en Rose', 'Edith Piaf'),
            track('Quelqu\'un m\'a dit', 'Carla Bruni'),
            track('Tous les garçons et les filles', 'Françoise Hardy'),
            track('Digital Love', 'Daft Punk'),
            track('La Bohème', 'Charles Aznavour'),
            track('La Mer', 'Charles Trenet'),
            track('Je t\'aime... moi non plus', 'Serge Gainsbourg'),
            track('Comptine d\'un autre été', 'Yann Tiersen'),
            track('Les Champs-Elysées', 'Joe Dassin'),
            track('Bonnie and Clyde', 'Serge Gainsbourg'),
        ]
    },
    'berlin': {
        name: 'Berlin Techno & Beyond',
        description: 'Electronic, techno, and the sounds of Germany\'s creative capital',
        mood: 'underground & pulsing',
        playlistUrl: 'https://open.spotify.com/search/berlin%20techno%20electronic',
        tracks: [
            track('Heroes', 'David Bowie'),
            track('99 Luftballons', 'Nena'),
            track('Das Model', 'Kraftwerk'),
            track('Blue (Da Ba Dee)', 'Eiffel 65'),
            track('Levels', 'Avicii'),
            track('Sandstorm', 'Darude'),
            track('Wake Me Up', 'Avicii'),
            track('Titanium', 'David Guetta'),
            track('Don\'t You Worry Child', 'Swedish House Mafia'),
            track('Around the World', 'Daft Punk'),
        ]
    },
    'rome': {
        name: 'Roma Eterna',
        description: 'Italian classics, opera highlights, and Mediterranean warmth',
        mood: 'passionate & timeless',
        playlistUrl: 'https://open.spotify.com/search/roma%20italian%20classics',
        tracks: [
            track('Volare', 'Dean Martin'),
            track('That\'s Amore', 'Dean Martin'),
            track('Nessun Dorma', 'Luciano Pavarotti'),
            track('Con te partirò', 'Andrea Bocelli'),
            track('Tu Vuò Fà L\'Americano', 'Renato Carosone'),
            track('Bella Ciao', 'Traditional'),
            track('Gloria', 'Umberto Tozzi'),
            track('Felicità', 'Al Bano'),
            track('Nel Blu Dipinto di Blu', 'Domenico Modugno'),
            track('Funiculì Funiculà', 'Luciano Pavarotti'),
        ]
    },
    'barcelona': {
        name: 'Barcelona Nights',
        description: 'Flamenco, Latin pop, and Mediterranean beats',
        mood: 'passionate & festive',
        playlistUrl: 'https://open.spotify.com/search/barcelona%20spanish%20flamenco',
        tracks: [
            track('Barcelona', 'Freddie Mercury'),
            track('Bamboleo', 'Gipsy Kings'),
            track('Bailando', 'Enrique Iglesias'),
            track('Waka Waka', 'Shakira'),
            track('Entre dos Aguas', 'Paco de Lucia'),
            track('La Flaca', 'Jarabe de Palo'),
            track('Buleria', 'David Bisbal'),
            track('Porro Bonito', 'Bomba Estereo'),
            track('Llorando Se Fue', 'Los Kjarkas'),
            track('Danza Kuduro', 'Don Omar'),
        ]
    },
    'madrid': {
        name: 'Madrid Caliente',
        description: 'Flamenco, Spanish pop, and the sound of Spain\'s beating heart',
        mood: 'passionate & vibrant',
        playlistUrl: 'https://open.spotify.com/search/madrid%20spanish%20music',
        tracks: [
            track('Entre dos Aguas', 'Paco de Lucía'),
            track('Corazón Partío', 'Alejandro Sanz'),
            track('Malamente', 'Rosalía'),
            track('Despechá', 'Rosalía'),
            track('La Vida Bohème', 'La Oreja de Van Gogh'),
            track('Aserejé', 'Las Ketchup'),
            track('Macarena', 'Los del Río'),
            track('Atrevete-Te-Te', 'Calle 13'),
            track('Bamboleo', 'Gipsy Kings'),
            track('Bailando', 'Enrique Iglesias'),
            track('Me Portaré Bonito', 'Rosalía'),
            track('Yo No Soy Esa', 'Mari Trini'),
            track('Tú Me Dejaste de Querer', 'C. Tangana'),
            track('Ingobernable', 'C. Tangana'),
            track('La Bicicleta', 'Shakira'),
        ]
    },
    'amsterdam': {
        name: 'Amsterdam Grooves',
        description: 'Dutch EDM, chill house, and canal-side vibes',
        mood: 'free & euphoric',
        playlistUrl: 'https://open.spotify.com/search/amsterdam%20dutch%20edm',
        tracks: [
            track('Amsterdam', 'Coldplay'),
            track('Levels', 'Avicii'),
            track('In the Name of Love', 'Martin Garrix'),
            track('Titanium', 'David Guetta'),
            track('Don\'t You Worry Child', 'Swedish House Mafia'),
            track('Adagio for Strings', 'Tiesto'),
            track('Clarity', 'Zedd'),
            track('Animals', 'Martin Garrix'),
            track('Wake Me Up', 'Avicii'),
            track('Waiting for Love', 'Avicii'),
        ]
    },
    'tokyo': {
        name: 'Tokyo Neon',
        description: 'City pop, J-pop, and electronic beats from Japan\'s electric capital',
        mood: 'neon & futuristic',
        playlistUrl: 'https://open.spotify.com/search/tokyo%20city%20pop%20jpop',
        tracks: [
            track('Plastic Love', 'Mariya Takeuchi'),
            track('Stay With Me', 'Miki Matsubara'),
            track('Sparkle', 'RADWIMPS'),
            track('Ride on Time', 'Tatsuro Yamashita'),
            track('4:00 AM', 'Taeko Ohnuki'),
            track('Mayonaka no Door', 'Miki Matsubara'),
            track('Magic Ways', 'Tatsuro Yamashita'),
            track('Remember Summer Days', 'Anri'),
            track('Flyday Chinatown', 'Yasuha'),
            track('I Love You So', 'Tatsuro Yamashita'),
        ]
    },
    'seoul': {
        name: 'Seoul Electric',
        description: 'K-pop hits and Korean indie for the capital of cool',
        mood: 'dynamic & trendy',
        playlistUrl: 'https://open.spotify.com/search/seoul%20kpop%20korean%20indie',
        tracks: [
            track('Dynamite', 'BTS'),
            track('How You Like That', 'BLACKPINK'),
            track('Gangnam Style', 'PSY'),
            track('Love Dive', 'IVE'),
            track('Next Level', 'aespa'),
            track('Butter', 'BTS'),
            track('Kill This Love', 'BLACKPINK'),
            track('ANTIFRAGILE', 'LE SSERAFIM'),
            track('Super Shy', 'NewJeans'),
            track('Ditto', 'NewJeans'),
        ]
    },
    'mumbai': {
        name: 'Bollywood & Beyond',
        description: 'Bollywood bangers, Indian fusion, and Mumbai street energy',
        mood: 'colorful & euphoric',
        playlistUrl: 'https://open.spotify.com/search/bollywood%20mumbai%20hits',
        tracks: [
            track('Jai Ho', 'A.R. Rahman'),
            track('Chaiyya Chaiyya', 'Sukhwinder Singh'),
            track('Mundian To Bach Ke', 'Panjabi MC'),
            track('Dil Se Re', 'A.R. Rahman'),
            track('Lean On', 'Major Lazer'),
            track('Balam Pichkari', 'Vishal Dadlani'),
            track('London Thumakda', 'Labh Janjua'),
            track('Gallan Goodiyaan', 'Yashita Sharma'),
            track('Badtameez Dil', 'Benny Dayal'),
            track('Malhari', 'Vishal Dadlani'),
        ]
    },
    'bangkok': {
        name: 'Bangkok Nights',
        description: 'Thai pop, tropical house, and Southeast Asian vibes',
        mood: 'tropical & vibrant',
        playlistUrl: 'https://open.spotify.com/search/bangkok%20thai%20tropical',
        tracks: [
            track('One Night in Bangkok', 'Murray Head'),
            track('Savage Love', 'Jawsh 685'),
            track('Sunflower', 'Post Malone'),
            track('Taki Taki', 'DJ Snake'),
            track('Mi Gente', 'J Balvin'),
            track('Cola Song', 'INNA'),
            track('Lean On', 'Major Lazer'),
            track('Sorry', 'Justin Bieber'),
            track('Cheap Thrills', 'Sia'),
            track('This Is What You Came For', 'Calvin Harris'),
        ]
    },
    'rio de janeiro': {
        name: 'Rio Rhythm',
        description: 'Bossa nova, samba, and Brazilian beats for Cidade Maravilhosa',
        mood: 'tropical & groovy',
        playlistUrl: 'https://open.spotify.com/search/rio%20bossa%20nova%20samba',
        tracks: [
            track('Girl from Ipanema', 'Stan Getz'),
            track('Mas Que Nada', 'Sergio Mendes'),
            track('Aquarela do Brasil', 'Ary Barroso'),
            track('Eu Sei Que Vou Te Amar', 'Tom Jobim'),
            track('Magalenha', 'Sergio Mendes'),
            track('Agua de Beber', 'Astrud Gilberto'),
            track('Desafinado', 'Stan Getz'),
            track('Samba de Uma Nota Só', 'Tom Jobim'),
            track('Wave', 'Tom Jobim'),
            track('Corcovado', 'Tom Jobim'),
        ]
    },
    'mexico city': {
        name: 'CDMX Vibra',
        description: 'Mariachi, rock en español, and modern Mexican sounds',
        mood: 'vibrant & proud',
        playlistUrl: 'https://open.spotify.com/search/mexico%20city%20mariachi%20rock',
        tracks: [
            track('Cielito Lindo', 'Mariachi Vargas'),
            track('La Bamba', 'Ritchie Valens'),
            track('Malagueña Salerosa', 'Chingon'),
            track('Ingrata', 'Café Tacvba'),
            track('Amores Perros', 'Gustavo Santaolalla'),
            track('De Musica Ligera', 'Soda Stereo'),
            track('Rayando El Sol', 'Mana'),
            track('Oye Mi Amor', 'Mana'),
            track('El Rey', 'Jose Alfredo Jimenez'),
            track('Sabor a Mi', 'Eydie Gorme'),
        ]
    },
    'havana': {
        name: 'Havana Club',
        description: 'Cuban son, salsa, and Buena Vista Social Club vibes',
        mood: 'warm & rhythmic',
        playlistUrl: 'https://open.spotify.com/search/havana%20cuban%20son%20salsa',
        tracks: [
            track('Chan Chan', 'Buena Vista Social Club'),
            track('Havana', 'Camila Cabello'),
            track('Guantanamera', 'Celia Cruz'),
            track('Quimbara', 'Celia Cruz'),
            track('Oye Como Va', 'Santana'),
            track('El Cuarto de Tula', 'Buena Vista Social Club'),
            track('Dos Gardenias', 'Buena Vista Social Club'),
            track('Candela', 'Buena Vista Social Club'),
            track('La Vida Es un Carnaval', 'Celia Cruz'),
            track('Hasta Siempre', 'Carlos Puebla'),
        ]
    },
    'sydney': {
        name: 'Sydney Surf & Sun',
        description: 'Australian rock, surf vibes, and harbour city chill',
        mood: 'carefree & sunny',
        playlistUrl: 'https://open.spotify.com/search/sydney%20australian%20rock',
        tracks: [
            track('Down Under', 'Men At Work'),
            track('Thunderstruck', 'AC/DC'),
            track('Somebody That I Used to Know', 'Gotye'),
            track('Electric Blue', 'Icehouse'),
            track('New Sensation', 'INXS'),
            track('Am I Ever Gonna See Your Face Again', 'The Angels'),
            track('Flame Trees', 'Cold Chisel'),
            track('Let Me Entertain You', 'Robbie Williams'),
            track('The Horses', 'Daryl Braithwaite'),
            track('Better Be Home Soon', 'Crowded House'),
        ]
    },
    'cairo': {
        name: 'Cairo Nights',
        description: 'Arabic classics, shaabi, and sounds of the Nile',
        mood: 'mystical & warm',
        playlistUrl: 'https://open.spotify.com/search/cairo%20arabic%20classics',
        tracks: [
            track('Enta Omri', 'Umm Kulthum'),
            track('Habibi Ya Nour El Ain', 'Amr Diab'),
            track('Ya Rayah', 'Dahmane El Harrachi'),
            track('Desert Rose', 'Sting'),
            track('Tamally Maak', 'Amr Diab'),
            track('Ahwak', 'Abdel Halim Hafez'),
            track('El Donia Helwa', 'Warda'),
            track('3 Daqat', 'Abu'),
            track('Nassam Alayna El Hawa', 'Fairuz'),
            track('Ya Tabtab', 'Nancy Ajram'),
        ]
    },
    'lagos': {
        name: 'Lagos Afrobeats',
        description: 'Afrobeats, Afropop, and the sounds of West Africa',
        mood: 'energetic & joyful',
        playlistUrl: 'https://open.spotify.com/search/lagos%20afrobeats%20afropop',
        tracks: [
            track('Essence', 'Wizkid'),
            track('Last Last', 'Burna Boy'),
            track('Love Nwantiti', 'CKay'),
            track('Ye', 'Burna Boy'),
            track('Peru', 'Fireboy DML'),
            track('Joro', 'Wizkid'),
            track('FEM', 'Davido'),
            track('Soco', 'Wizkid'),
            track('Johnny', 'Yemi Alade'),
            track('Kilometre', 'Burna Boy'),
        ]
    },
    'detroit': {
        name: 'Motor City Soul',
        description: 'Motown legends, techno pioneers, and Detroit grit',
        mood: 'soulful & gritty',
        playlistUrl: 'https://open.spotify.com/search/detroit%20motown%20soul',
        tracks: [
            track('My Girl', 'The Temptations'),
            track('Ain\'t Too Proud to Beg', 'The Temptations'),
            track('What\'s Going On', 'Marvin Gaye'),
            track('Respect', 'Aretha Franklin'),
            track('I Heard It Through the Grapevine', 'Marvin Gaye'),
            track('Signed Sealed Delivered', 'Stevie Wonder'),
            track('Lose Yourself', 'Eminem'),
            track('Seven Nation Army', 'The White Stripes'),
            track('Strings of Life', 'Derrick May'),
            track('Big Fun', 'Inner City'),
        ]
    },
    'atlanta': {
        name: 'ATL Vibes',
        description: 'Southern hip-hop, trap, and ATL soul',
        mood: 'bouncy & confident',
        playlistUrl: 'https://open.spotify.com/search/atlanta%20hip%20hop',
        tracks: [
            track('Hey Ya!', 'OutKast'),
            track('So Fresh, So Clean', 'OutKast'),
            track('Ms. Jackson', 'OutKast'),
            track('Rosa Parks', 'OutKast'),
            track('Crazy', 'Gnarls Barkley'),
            track('Waterfalls', 'TLC'),
            track('No Scrubs', 'TLC'),
            track('Welcome to Atlanta', 'Jermaine Dupri'),
            track('Yeah!', 'Usher'),
            track('What\'s Your Fantasy', 'Ludacris'),
        ]
    },
    'memphis': {
        name: 'Memphis Soul & Blues',
        description: 'Stax Records soul, Sun Studio rock, and Delta blues',
        mood: 'soulful & raw',
        playlistUrl: 'https://open.spotify.com/search/memphis%20soul%20blues',
        tracks: [
            track('Walking in Memphis', 'Marc Cohn'),
            track('Green Onions', 'Booker T. & the M.G.\'s'),
            track('Hold On I\'m Comin\'', 'Sam & Dave'),
            track('Soul Man', 'Sam & Dave'),
            track('That\'s All Right', 'Elvis Presley'),
            track('Suspicious Minds', 'Elvis Presley'),
            track('In the Midnight Hour', 'Wilson Pickett'),
            track('Try a Little Tenderness', 'Otis Redding'),
            track('Mustang Sally', 'Wilson Pickett'),
            track('Last Night', 'The Mar-Keys'),
        ]
    },
    'minneapolis': {
        name: 'Minneapolis Sound',
        description: 'Prince\'s city — funk, rock, and the Minneapolis sound',
        mood: 'funky & eclectic',
        playlistUrl: 'https://open.spotify.com/search/minneapolis%20prince%20sound',
        tracks: [
            track('Purple Rain', 'Prince'),
            track('When Doves Cry', 'Prince'),
            track('Kiss', 'Prince'),
            track('Let\'s Go Crazy', 'Prince'),
            track('Little Red Corvette', 'Prince'),
            track('1999', 'Prince'),
            track('Sign o\' the Times', 'Prince'),
            track('Raspberry Beret', 'Prince'),
            track('Can\'t Hardly Wait', 'The Replacements'),
            track('Bastards of Young', 'The Replacements'),
        ]
    },
    'philadelphia': {
        name: 'Philly Soul',
        description: 'The Sound of Philadelphia — soul, R&B, and the city of brotherly love',
        mood: 'smooth & soulful',
        playlistUrl: 'https://open.spotify.com/search/philadelphia%20soul%20sound',
        tracks: [
            track('Ain\'t No Stoppin\' Us Now', 'McFadden & Whitehead'),
            track('Me and Mrs. Jones', 'Billy Paul'),
            track('If You Don\'t Know Me By Now', 'Harold Melvin & the Blue Notes'),
            track('T.S.O.P.', 'MFSB'),
            track('Love Train', 'The O\'Jays'),
            track('Back Stabbers', 'The O\'Jays'),
            track('Summertime', 'DJ Jazzy Jeff & The Fresh Prince'),
            track('Streets of Philadelphia', 'Bruce Springsteen'),
            track('Wake Up Everybody', 'Harold Melvin & the Blue Notes'),
            track('Could It Be I\'m Falling in Love', 'The Spinners'),
        ]
    },
    'boston': {
        name: 'Boston Sound',
        description: 'Rock, punk, folk, and the spirit of New England',
        mood: 'classic & anthemic',
        playlistUrl: 'https://open.spotify.com/search/boston%20rock%20classics',
        tracks: [
            track('More Than a Feeling', 'Boston'),
            track('Shipping Up to Boston', 'Dropkick Murphys'),
            track('Sweet Caroline', 'Neil Diamond'),
            track('Don\'t Look Back', 'Boston'),
            track('Peace of Mind', 'Boston'),
            track('Rock and Roll Band', 'Boston'),
            track('Dream On', 'Aerosmith'),
            track('Walk This Way', 'Aerosmith'),
            track('Roadrunner', 'The Modern Lovers'),
            track('I\'m Gonna Be (500 Miles)', 'The Proclaimers'),
        ]
    },
    'honolulu': {
        name: 'Aloha Vibes',
        description: 'Hawaiian music, island rhythms, and Pacific surf',
        mood: 'tropical & serene',
        playlistUrl: 'https://open.spotify.com/search/hawaiian%20music%20aloha',
        tracks: [
            track('Somewhere Over the Rainbow', 'Israel Kamakawiwo\'ole'),
            track('What a Wonderful World', 'Israel Kamakawiwo\'ole'),
            track('Blue Hawaii', 'Elvis Presley'),
            track('Aloha Oe', 'Israel Kamakawiwo\'ole'),
            track('Tiny Bubbles', 'Don Ho'),
            track('Wipeout', 'The Surfaris'),
            track('Surfin\' USA', 'The Beach Boys'),
            track('Island Style', 'John Cruz'),
            track('White Sandy Beach', 'Israel Kamakawiwo\'ole'),
            track('Henehene Kou Aka', 'Ledward Kaapana'),
        ]
    },
    'toronto': {
        name: 'The 6ix',
        description: 'Drake, The Weeknd, and Canada\'s greatest hits',
        mood: 'dynamic & versatile',
        playlistUrl: 'https://open.spotify.com/search/toronto%20canadian%20hits',
        tracks: [
            track('Started From the Bottom', 'Drake'),
            track('Hotline Bling', 'Drake'),
            track('Blinding Lights', 'The Weeknd'),
            track('Starboy', 'The Weeknd'),
            track('Call Me Maybe', 'Carly Rae Jepsen'),
            track('Ahead by a Century', 'The Tragically Hip'),
            track('Heart of Gold', 'Neil Young'),
            track('Hallelujah', 'Leonard Cohen'),
            track('Summer of \'69', 'Bryan Adams'),
            track('You Oughta Know', 'Alanis Morissette'),
        ]
    },
    'dublin': {
        name: 'Dublin Calling',
        description: 'Irish rock, trad, and the soul of the Emerald Isle',
        mood: 'spirited & poetic',
        playlistUrl: 'https://open.spotify.com/search/dublin%20irish%20rock',
        tracks: [
            track('Sunday Bloody Sunday', 'U2'),
            track('With or Without You', 'U2'),
            track('Zombie', 'The Cranberries'),
            track('Linger', 'The Cranberries'),
            track('Galway Girl', 'Steve Earle'),
            track('Danny Boy', 'Celtic Woman'),
            track('Whiskey in the Jar', 'Thin Lizzy'),
            track('The Boys Are Back in Town', 'Thin Lizzy'),
            track('Fairytale of New York', 'The Pogues'),
            track('Take Me to Church', 'Hozier'),
        ]
    },
    'lisbon': {
        name: 'Lisboa Fado & Soul',
        description: 'Portuguese fado, saudade, and Atlantic warmth',
        mood: 'melancholic & warm',
        playlistUrl: 'https://open.spotify.com/search/lisbon%20fado%20portuguese',
        tracks: [
            track('Estranha Forma de Vida', 'Amália Rodrigues'),
            track('Uma Casa Portuguesa', 'Amália Rodrigues'),
            track('Chuva', 'Mariza'),
            track('Desfado', 'Ana Moura'),
            track('Canção do Mar', 'Dulce Pontes'),
            track('Lisboa Menina e Moça', 'Carlos do Carmo'),
            track('Ainda', 'Madredeus'),
            track('Grândola Vila Morena', 'Zeca Afonso'),
            track('Cavaleiro Monge', 'Rodrigo Leão'),
            track('Asas Fechadas', 'Ana Moura'),
        ]
    },
    'vienna': {
        name: 'Wiener Klassik',
        description: 'Classical masterworks, waltzes, and Austrian culture',
        mood: 'elegant & timeless',
        playlistUrl: 'https://open.spotify.com/search/vienna%20classical%20waltz',
        tracks: [
            track('The Blue Danube', 'Johann Strauss II'),
            track('Eine Kleine Nachtmusik', 'Mozart'),
            track('Rock Me Amadeus', 'Falco'),
            track('Der Kommissar', 'Falco'),
            track('Für Elise', 'Beethoven'),
            track('Radetzky March', 'Johann Strauss I'),
            track('The Marriage of Figaro Overture', 'Mozart'),
            track('Spring - Four Seasons', 'Vivaldi'),
            track('Waltz No. 2', 'Shostakovich'),
            track('Nessun Dorma', 'Luciano Pavarotti'),
        ]
    },
    'istanbul': {
        name: 'Istanbul Nights',
        description: 'Turkish pop, Anatolian rock, and Bosphorus vibes',
        mood: 'mystical & vibrant',
        playlistUrl: 'https://open.spotify.com/search/istanbul%20turkish%20music',
        tracks: [
            track('Istanbul (Not Constantinople)', 'They Might Be Giants'),
            track('Simarik', 'Tarkan'),
            track('Dudu', 'Tarkan'),
            track('Dönence', 'Barış Manço'),
            track('Yalnızlık Senfonisi', 'Barış Manço'),
            track('Şıkıdım', 'Tarkan'),
            track('Her Şey Seninle Güzel', 'Zerrin Özer'),
            track('Hadi Bakalım', 'Sezen Aksu'),
            track('Git', 'Sezen Aksu'),
            track('Yüksek Yüksek Tepelere', 'Selda Bağcan'),
        ]
    },
    'buenos aires': {
        name: 'Buenos Aires Tango',
        description: 'Tango, Argentine rock, and the soul of the Rio de la Plata',
        mood: 'passionate & dramatic',
        playlistUrl: 'https://open.spotify.com/search/buenos%20aires%20tango%20rock',
        tracks: [
            track('La Cumparsita', 'Julio Sosa'),
            track('Por Una Cabeza', 'Carlos Gardel'),
            track('El Día Que Me Quieras', 'Carlos Gardel'),
            track('Libertango', 'Astor Piazzolla'),
            track('Adiós Nonino', 'Astor Piazzolla'),
            track('Oblivion', 'Astor Piazzolla'),
            track('Mi Buenos Aires Querido', 'Carlos Gardel'),
            track('De Música Ligera', 'Soda Stereo'),
            track('Persiana Americana', 'Soda Stereo'),
            track('Canción Animal', 'Soda Stereo'),
        ]
    },
    'stockholm': {
        name: 'Swedish Pop Machine',
        description: 'ABBA, indie pop, and the sounds of Scandinavia',
        mood: 'bright & melodic',
        playlistUrl: 'https://open.spotify.com/search/stockholm%20swedish%20pop',
        tracks: [
            track('Dancing Queen', 'ABBA'),
            track('SOS', 'ABBA'),
            track('The Final Countdown', 'Europe'),
            track('The Sign', 'Ace of Base'),
            track('Lovefool', 'The Cardigans'),
            track('Heartbeats', 'The Knife'),
            track('With Every Heartbeat', 'Robyn'),
            track('Dancing On My Own', 'Robyn'),
            track('My Favourite Game', 'The Cardigans'),
            track('Save Tonight', 'Eagle-Eye Cherry'),
        ]
    },
};
// ── Mood → vibe mapping ─────────────────────────────────────────────────
function moodToVibes(mood) {
    if (!mood)
        return [];
    const m = mood.toLowerCase();
    if (/terrible|awful|sad|rough|bad|stressed|anxious|overwhelm/i.test(m))
        return ['chill', 'melancholy'];
    if (/tired|exhausted|sleepy|drained|low energy/i.test(m))
        return ['chill', 'contemplative'];
    if (/chill|relax|calm|peaceful|easy|lazy/i.test(m))
        return ['chill', 'tropical'];
    if (/adventur|explor|discover|wander|curious/i.test(m))
        return ['adventure', 'upbeat'];
    if (/excit|hype|wired|pumped|energi|ready/i.test(m))
        return ['upbeat', 'nightout'];
    if (/romantic|date|love|intimate|together/i.test(m))
        return ['romantic', 'chill'];
    if (/party|dance|club|night out|going out/i.test(m))
        return ['nightout', 'groovy'];
    if (/creative|art|inspired|deep|think/i.test(m))
        return ['contemplative', 'indie'];
    if (/happy|great|amazing|wonderful|fantastic/i.test(m))
        return ['upbeat', 'groovy'];
    if (/funky|groove|soul|retro|vintage/i.test(m))
        return ['groovy', 'upbeat'];
    if (/indie|alt|underground|hipster/i.test(m))
        return ['indie', 'adventure'];
    return [];
}
// ── City alias matching ─────────────────────────────────────────────────
const CITY_ALIASES = {
    // City abbreviations & neighborhoods
    'nyc': 'new york', 'ny': 'new york', 'manhattan': 'new york',
    'brooklyn': 'new york', 'queens': 'new york', 'new york city': 'new york',
    'la': 'los angeles', 'sf': 'san francisco', 'frisco': 'san francisco',
    'nola': 'new orleans', 'cdmx': 'mexico city',
    'río': 'rio de janeiro', 'rio': 'rio de janeiro', 'bombay': 'mumbai',
    // Country → representative city (for playlist matching)
    'spain': 'madrid', 'españa': 'madrid', 'seville': 'madrid', 'sevilla': 'madrid', 'malaga': 'madrid', 'valencia': 'madrid',
    'france': 'paris', 'lyon': 'paris', 'marseille': 'paris', 'nice': 'paris',
    'japan': 'tokyo', 'osaka': 'tokyo', 'kyoto': 'tokyo',
    'south korea': 'seoul', 'korea': 'seoul', 'busan': 'seoul',
    'germany': 'berlin', 'munich': 'berlin', 'hamburg': 'berlin', 'frankfurt': 'berlin',
    'italy': 'rome', 'milan': 'rome', 'florence': 'rome', 'naples': 'rome', 'venice': 'rome',
    'uk': 'london', 'england': 'london', 'britain': 'london', 'manchester': 'london', 'edinburgh': 'london',
    'brazil': 'rio de janeiro', 'são paulo': 'rio de janeiro', 'sao paulo': 'rio de janeiro',
    'mexico': 'mexico city', 'cancun': 'mexico city', 'guadalajara': 'mexico city',
    'australia': 'sydney', 'melbourne': 'sydney', 'brisbane': 'sydney',
    'egypt': 'cairo', 'alexandria': 'cairo',
    'nigeria': 'lagos', 'accra': 'lagos', 'ghana': 'lagos',
    'cuba': 'havana',
    'india': 'mumbai', 'delhi': 'mumbai', 'new delhi': 'mumbai', 'bangalore': 'mumbai',
    'thailand': 'bangkok', 'phuket': 'bangkok', 'chiang mai': 'bangkok',
    'netherlands': 'amsterdam', 'holland': 'amsterdam', 'rotterdam': 'amsterdam',
    'colombia': 'havana', 'bogota': 'havana', 'medellin': 'havana',
    'usa': 'new york', 'united states': 'new york', 'america': 'new york',
    // ── Expanded US city aliases ──
    // Texas → austin
    'houston': 'austin', 'dallas': 'austin', 'san antonio': 'austin',
    'fort worth': 'austin', 'el paso': 'austin',
    // SoCal → los angeles
    'san diego': 'los angeles', 'long beach': 'los angeles', 'anaheim': 'los angeles',
    'santa monica': 'los angeles', 'pasadena': 'los angeles', 'hollywood': 'los angeles',
    // Southwest → los angeles
    'phoenix': 'los angeles', 'tucson': 'los angeles', 'albuquerque': 'los angeles',
    // NorCal → san francisco
    'san jose': 'san francisco', 'sacramento': 'san francisco', 'oakland': 'san francisco',
    'berkeley': 'san francisco', 'palo alto': 'san francisco',
    // PNW → seattle
    'portland': 'seattle', 'tacoma': 'seattle', 'anchorage': 'seattle',
    // Mountain → seattle (closest indie/alternative vibe)
    'denver': 'seattle', 'boulder': 'seattle', 'salt lake city': 'seattle', 'boise': 'seattle',
    // Northeast → philadelphia
    'washington dc': 'philadelphia', 'washington d.c.': 'philadelphia', 'dc': 'philadelphia',
    'baltimore': 'philadelphia', 'pittsburgh': 'philadelphia',
    'buffalo': 'new york', 'richmond': 'philadelphia',
    // Boston-area universities & neighborhoods
    'harvard': 'boston', 'cambridge': 'boston', 'mit': 'boston',
    'somerville': 'boston', 'brookline': 'boston',
    // Midwest → detroit or chicago
    'cleveland': 'detroit', 'cincinnati': 'detroit', 'columbus': 'detroit',
    'milwaukee': 'chicago', 'indianapolis': 'chicago', 'kansas city': 'chicago',
    'st. louis': 'memphis', 'st louis': 'memphis',
    // South → atlanta
    'charlotte': 'atlanta', 'raleigh': 'atlanta', 'savannah': 'atlanta',
    'charleston': 'atlanta', 'raleigh-durham': 'atlanta',
    // Florida → miami
    'jacksonville': 'miami', 'tampa': 'miami', 'orlando': 'miami',
    'fort lauderdale': 'miami', 'west palm beach': 'miami', 'key west': 'miami',
    // Kentucky/Tennessee → nashville
    'louisville': 'nashville', 'knoxville': 'nashville', 'chattanooga': 'nashville',
    // Las Vegas → los angeles
    'las vegas': 'los angeles', 'vegas': 'los angeles', 'reno': 'los angeles',
    // Hawaii
    'hawaii': 'honolulu', 'maui': 'honolulu', 'waikiki': 'honolulu', 'oahu': 'honolulu',
    // Minneapolis
    'saint paul': 'minneapolis', 'st. paul': 'minneapolis', 'twin cities': 'minneapolis',
    'madison': 'minneapolis',
    // ── Expanded Canadian aliases ──
    'montreal': 'toronto', 'vancouver': 'toronto', 'ottawa': 'toronto',
    'calgary': 'toronto', 'winnipeg': 'toronto', 'quebec': 'toronto', 'canada': 'toronto',
    // ── Expanded European aliases ──
    // Ireland → dublin
    'ireland': 'dublin', 'belfast': 'dublin', 'cork': 'dublin', 'galway': 'dublin',
    // Move Edinburgh to Dublin (Celtic connection is stronger than London)
    // Scandinavia → stockholm
    'copenhagen': 'stockholm', 'oslo': 'stockholm', 'helsinki': 'stockholm',
    'sweden': 'stockholm', 'denmark': 'stockholm', 'norway': 'stockholm',
    'finland': 'stockholm', 'iceland': 'stockholm', 'reykjavik': 'stockholm',
    // Central Europe → vienna
    'prague': 'vienna', 'budapest': 'vienna', 'zurich': 'vienna',
    'salzburg': 'vienna', 'austria': 'vienna', 'czech republic': 'vienna',
    'hungary': 'vienna', 'switzerland': 'vienna', 'krakow': 'vienna', 'warsaw': 'vienna',
    'geneva': 'paris',
    // Belgium → amsterdam
    'brussels': 'amsterdam', 'antwerp': 'amsterdam', 'belgium': 'amsterdam',
    // Portugal → lisbon
    'portugal': 'lisbon', 'porto': 'lisbon', 'faro': 'lisbon',
    // Greece → rome (Mediterranean connection)
    'athens': 'rome', 'greece': 'rome', 'santorini': 'rome', 'mykonos': 'rome',
    // Turkey → istanbul
    'turkey': 'istanbul', 'ankara': 'istanbul', 'izmir': 'istanbul', 'antalya': 'istanbul',
    // ── Expanded Middle East aliases ──
    'dubai': 'cairo', 'abu dhabi': 'cairo', 'doha': 'cairo', 'qatar': 'cairo',
    'riyadh': 'cairo', 'jeddah': 'cairo', 'saudi arabia': 'cairo',
    'tel aviv': 'istanbul', 'jerusalem': 'cairo', 'beirut': 'istanbul',
    'jordan': 'cairo', 'amman': 'cairo', 'uae': 'cairo',
    // ── Expanded North Africa ──
    'marrakech': 'cairo', 'casablanca': 'cairo', 'morocco': 'cairo',
    'tunis': 'cairo', 'tunisia': 'cairo', 'algiers': 'cairo',
    // ── Expanded Sub-Saharan Africa ──
    'cape town': 'lagos', 'johannesburg': 'lagos', 'south africa': 'lagos',
    'nairobi': 'lagos', 'kenya': 'lagos', 'addis ababa': 'lagos',
    'ethiopia': 'lagos', 'dar es salaam': 'lagos', 'tanzania': 'lagos',
    'senegal': 'lagos', 'dakar': 'lagos',
    // ── Expanded Latin America ──
    'buenos aires': 'buenos aires',
    'argentina': 'buenos aires', 'montevideo': 'buenos aires', 'uruguay': 'buenos aires',
    'santiago': 'buenos aires', 'chile': 'buenos aires',
    'lima': 'mexico city', 'peru': 'mexico city',
    'cartagena': 'havana', 'panama': 'havana', 'panama city': 'havana',
    'costa rica': 'havana', 'san jose costa rica': 'havana',
    'quito': 'havana', 'ecuador': 'havana',
    'venezuela': 'havana', 'caracas': 'havana',
    'dominican republic': 'havana', 'santo domingo': 'havana',
    'puerto rico': 'havana', 'san juan': 'havana',
    // ── Expanded East/Southeast Asia ──
    'hong kong': 'tokyo', 'shanghai': 'tokyo', 'beijing': 'tokyo',
    'china': 'tokyo', 'taiwan': 'tokyo', 'taipei': 'tokyo',
    'singapore': 'tokyo',
    'bali': 'bangkok', 'jakarta': 'bangkok', 'indonesia': 'bangkok',
    'ho chi minh city': 'bangkok', 'hanoi': 'bangkok', 'vietnam': 'bangkok',
    'manila': 'bangkok', 'philippines': 'bangkok',
    'kuala lumpur': 'bangkok', 'malaysia': 'bangkok',
    'cambodia': 'bangkok', 'phnom penh': 'bangkok',
    'myanmar': 'bangkok', 'laos': 'bangkok',
    // ── Expanded Oceania ──
    'auckland': 'sydney', 'wellington': 'sydney', 'new zealand': 'sydney',
    'fiji': 'sydney', 'perth': 'sydney', 'adelaide': 'sydney',
    'gold coast': 'sydney',
};
function matchCity(city) {
    const c = city.toLowerCase().trim();
    if (CITY_PLAYLISTS[c])
        return c;
    if (CITY_ALIASES[c])
        return CITY_ALIASES[c];
    for (const key of Object.keys(CITY_PLAYLISTS)) {
        if (c.includes(key) || key.includes(c))
            return key;
    }
    return null;
}
// ── Song reason generator ───────────────────────────────────────────────
// Per-song knowledge for generating "why this song" explanations
const SONG_REASONS = {
    // Chill
    'harvest moon|neil young': 'Neil Young\'s tender serenade — pure warmth',
    'pink + white|frank ocean': 'Frank Ocean at his most serene and sun-dappled',
    'the night we met|lord huron': 'Nostalgic ache wrapped in a gentle melody',
    'cherry wine|hozier': 'Hozier\'s voice turns any moment intimate',
    'bloom|the paper kites': 'Whisper-quiet and impossibly pretty',
    're: stacks|bon iver': 'Bon Iver stripped back to just breath and guitar',
    'skinny love|bon iver': 'Raw vulnerability that somehow feels like a hug',
    'holocene|bon iver': 'Expansive and still — like staring at mountains',
    'first day of my life|bright eyes': 'The feeling of everything starting over',
    'such great heights|iron & wine': 'The stripped-down version that melts you',
    'sea of love|cat power': 'Cat Power\'s haunted take on a classic love song',
    'moon river|frank ocean': 'A dreamy reimagining that floats',
    'myth|beach house': 'Shimmering shoegaze for staring at the ceiling',
    'space song|beach house': 'The soundtrack to drifting through space',
    'banana pancakes|jack johnson': 'The universal "let\'s stay in" anthem',
    'better together|jack johnson': 'Simple, sweet, and impossible not to sway to',
    'the less i know the better|tame impala': 'That bass line is an instant mood lifter',
    'eventually|tame impala': 'Psychedelic bliss that builds and releases',
    'let it happen|tame impala': 'Seven minutes of letting go completely',
    'apocalypse|cigarettes after sex': 'Slow-motion beauty in every note',
    'motion sickness|phoebe bridgers': 'Bittersweet perfection from Phoebe',
    'liability|lorde': 'Lorde at her most vulnerable and honest',
    'agnes|glass animals': 'Achingly beautiful beneath the production',
    'youth|daughter': 'Haunting vocals that stop you in your tracks',
    // Upbeat
    'mr. blue sky|electric light orchestra': 'Scientifically proven to improve any day',
    'september|earth wind & fire': 'You cannot physically stay still during this',
    'lovely day|bill withers': 'Bill Withers holds that note for 18 seconds of joy',
    'dreams|fleetwood mac': 'Stevie Nicks makes everything feel possible',
    'the chain|fleetwood mac': 'That bass drop is one of rock\'s greatest moments',
    'everywhere|fleetwood mac': 'Pure jangly happiness from Christine McVie',
    'just like heaven|the cure': 'The Cure\'s most blissful three minutes',
    'float on|modest mouse': 'The anthem for when things will be alright',
    'electric feel|mgmt': 'Groovy, weird, and irresistibly catchy',
    'take me out|franz ferdinand': 'That gear shift at 0:15 changes everything',
    'shut up and dance|walk the moon': 'Does exactly what the title says',
    'heat waves|glass animals': 'The song that soundtracked everyone\'s 2020',
    'dog days are over|florence + the machine': 'Florence\'s voice could power a city',
    'you make my dreams|hall & oates': 'Instant serotonin in song form',
    'i wanna dance with somebody|whitney houston': 'Whitney at her most joyful',
    "ain't no mountain high enough|marvin gaye": 'The original hype track',
    'walking on sunshine|katrina & the waves': 'Pure concentrated happiness',
    'dancing in the moonlight|king harvest': 'Effortlessly groovy since 1972',
    'superstition|stevie wonder': 'That clavinet riff is funk perfection',
    'sir duke|stevie wonder': 'Stevie Wonder celebrating music itself',
    'redbone|childish gambino': 'That falsetto over a slowed-down funk groove',
    'come and get your love|redbone': 'Guardians of the Galaxy made this essential again',
    'golden|harry styles': 'Sunshine distilled into a pop song',
    'watermelon sugar|harry styles': 'Summer energy year-round',
    'island in the sun|weezer': 'Weezer at their most effortlessly breezy',
    // Adventure
    'runaway|aurora': 'Aurora\'s otherworldly voice for otherworldly moments',
    'midnight city|m83': 'That synth riff is the sound of city lights at speed',
    'little talks|of monsters and men': 'Icelandic indie that makes you want to explore',
    'dirty paws|of monsters and men': 'An epic adventure in four minutes',
    'gooey|glass animals': 'Psychedelic and sticky in the best way',
    'stubborn love|the lumineers': 'Folk-rock that makes you want to drive somewhere',
    'ophelia|the lumineers': 'Stomping, handclapping road trip energy',
    'home|edward sharpe & the magnetic zeros': 'The ultimate "singing out the window" song',
    '1901|phoenix': 'French indie pop that sparkles',
    'lisztomania|phoenix': 'Pure kinetic energy from the first note',
    'budapest|george ezra': 'George Ezra\'s baritone + wanderlust',
    'shotgun|george ezra': 'Windows down, volume up',
    'riptide|vance joy': 'Ukulele-driven wanderlust that travels well',
    'innerbloom|rufus du sol': 'A ten-minute journey you don\'t want to end',
    'sleepyhead|passion pit': 'Chopped-up euphoria that sounds like confetti',
    'what you know|two door cinema club': 'Bright, fast, and impossible to skip',
    'mykonos|fleet foxes': 'Harmonies that sound like a forest waking up',
    'white winter hymnal|fleet foxes': 'Round-singing perfection',
    // Romantic
    'at last|etta james': 'The greatest love song ever recorded, arguably',
    "let's stay together|al green": 'Al Green\'s voice is liquid velvet',
    'la vie en rose|louis armstrong': 'Louis makes the world literally rose-colored',
    'fly me to the moon|frank sinatra': 'Sinatra swings through the cosmos',
    'my funny valentine|chet baker': 'Cool jazz heartbreak at its finest',
    'best part|daniel caesar': 'Modern R&B at its most tender',
    'get you|daniel caesar': 'Smooth as candlelight',
    'falling|harry styles': 'Raw piano ballad vulnerability',
    'ivy|frank ocean': 'Secret garden energy from Frank Ocean',
    'thinkin bout you|frank ocean': 'That falsetto note is a religious experience',
    'like real people do|hozier': 'Intimate enough to make you blush',
    'something|the beatles': 'George Harrison\'s quiet masterpiece of devotion',
    "can't help falling in love|elvis presley": 'Timeless for a reason — pure romance',
    'sway|dean martin': 'Dean Martin makes everything suave',
    'l-o-v-e|nat king cole': 'Nat King Cole spells it out perfectly',
    'feeling good|nina simone': 'Nina Simone owns this song completely',
    'all of me|john legend': 'Modern wedding classic that actually earns it',
    // Night out
    'blinding lights|the weeknd': '80s synths meet modern nightlife perfection',
    'save your tears|the weeknd': 'Retro-future pop for the drive home',
    'after hours|the weeknd': 'The Weeknd\'s darkest and most cinematic',
    'one more time|daft punk': 'The robots command you to celebrate',
    'get lucky|daft punk': 'Nile Rodgers\' guitar + Daft Punk = pure groove',
    'dancing queen|abba': 'You\'re 17, you\'re dancing, you\'re having the time of your life',
    "gimme! gimme! gimme!|abba": 'ABBA\'s darkest banger — Madonna borrowed it for a reason',
    'physical|dua lipa': 'Dua Lipa channeling peak disco',
    "don't start now|dua lipa": 'The bass line that launched a thousand dance floors',
    'levitating|dua lipa': 'Disco-pop that literally makes you float',
    "don't stop me now|queen": 'Freddie Mercury at maximum velocity',
    'bohemian rhapsody|queen': 'Six minutes of operatic chaos that always works',
    'do i wanna know|arctic monkeys': 'That drum intro is midnight distilled',
    '505|arctic monkeys': 'Building urgency that never lets up',
    'green light|lorde': 'The moment Lorde learned to dance',
    'ribs|lorde': 'Late-night nostalgia that hits in your chest',
    // Contemplative
    'clair de lune|debussy': 'Moonlight turned into sound — a 130-year-old masterpiece',
    'gymnopédie no.1|erik satie': 'The original ambient music, from 1888',
    'an ending|brian eno': 'Eno invented ambient music for moments like this',
    'intro|the xx': 'A miniature world built from almost nothing',
    'everything in its right place|radiohead': 'Radiohead\'s most beautiful opener',
    'how to disappear completely|radiohead': 'Thom Yorke floating away from everything',
    'teardrop|massive attack': 'The trip-hop peak — Elizabeth Fraser\'s voice is unearthly',
    'glory box|portishead': 'Beth Gibbons\' voice over that Isaac Hayes sample',
    'to build a home|the cinematic orchestra': 'A piano piece that tells a whole life story',
    'nuvole bianche|ludovico einaudi': 'White clouds — gentle piano that empties your mind',
    'experience|ludovico einaudi': 'Layers building into something transcendent',
    'retrograde|james blake': 'James Blake turning heartbreak into electronic art',
    'your hand in mine|explosions in the sky': 'Post-rock that makes the ordinary feel epic',
    'time|hans zimmer': 'The Inception theme — time stretching and collapsing',
    'on the nature of daylight|max richter': 'String music for the end of the world (in a good way)',
    'saturn|sleeping at last': 'Astronomy-inspired indie that makes you feel small and okay about it',
    // Groovy
    'kiss|prince': 'Prince proving less is more (and more is more)',
    'when doves cry|prince': 'No bass line, all vibes — Prince was a genius',
    'le freak|chic': 'Nile Rodgers invented modern dance music right here',
    'good times|chic': 'The bass line that hip-hop was built on',
    'got to give it up|marvin gaye': 'Marvin Gaye loosening up at the party',
    'i want you back|the jackson 5': 'Michael at 11 years old, already unstoppable',
    'off the wall|michael jackson': 'Pre-Thriller MJ — pure dancefloor joy',
    'rock with you|michael jackson': 'The smoothest groove of 1979',
    'boogie wonderland|earth wind & fire': 'Disco at its most euphoric',
    'uptown funk|bruno mars': 'Bruno channeling James Brown into the 2010s',
    '24k magic|bruno mars': 'Vegas energy in three and a half minutes',
    'juice|lizzo': 'Lizzo\'s confidence is contagious',
    'about damn time|lizzo': 'The song that made everyone get up and move',
    'doo wop (that thing)|lauryn hill': 'Lauryn Hill schooling everyone effortlessly',
    'passionfruit|drake': 'Drake\'s most groove-forward moment',
    'move on up|curtis mayfield': 'Nine minutes of relentless optimism',
    // Indie
    'do you realize??|the flaming lips': 'Existential joy from Oklahoma\'s weirdest band',
    'in the aeroplane over the sea|neutral milk hotel': 'Lo-fi masterpiece that gets more magical each listen',
    'new slang|the shins': 'The Garden State song that launched a thousand playlists',
    'such great heights|the postal service': 'Electronic indie that still sounds like the future',
    'maps|yeah yeah yeahs': 'Karen O\'s voice cracks open with real emotion',
    'tessellate|alt-j': 'art-pop puzzles that somehow fit together perfectly',
    'breezeblocks|alt-j': 'Unsettling and beautiful in equal measure',
    'young folks|peter bjorn and john': 'That whistle hook lives rent-free in your head',
    'wake up|arcade fire': 'An arena-sized indie anthem for the ages',
    'sprawl ii|arcade fire': 'Régine Chassagne channeling Blondie in the suburbs',
    'all my friends|lcd soundsystem': 'The greatest song about getting older and going out',
    'someone great|lcd soundsystem': 'Loss processed through a synthesizer, beautifully',
    'dance yrself clean|lcd soundsystem': 'That drop at 3:07 is one of music\'s best surprises',
    'my girls|animal collective': 'Experimental pop that just wants a roof and walls',
    // Tropical
    'is this love|bob marley': 'Bob Marley\'s sweetest love song',
    'three little birds|bob marley': 'Every little thing is gonna be alright',
    'sun is shining|bob marley': 'Reggae optimism for any weather',
    'santeria|sublime': 'Ska-punk meets reggae in the California sun',
    'girl from ipanema|stan getz': 'The bossa nova standard — pure Brazilian cool',
    'mas que nada|sergio mendes': 'Brazilian groove that makes anywhere feel tropical',
    'good vibrations|the beach boys': 'Brian Wilson\'s "pocket symphony" of summer',
    "wouldn't it be nice|the beach boys": 'Youthful longing wrapped in harmonies',
    'here comes the sun|the beatles': 'George Harrison welcoming warmth back',
    'kokomo|the beach boys': 'A vacation in song form',
    // duplicate removed (island in the sun already above)
    'despacito|luis fonsi': 'The reggaeton crossover that conquered the planet',
    // Melancholy
    'mad world|gary jules': 'The Donnie Darko version — stripped to its essence',
    'everybody hurts|r.e.m.': 'R.E.M. saying "hold on" and meaning it',
    'hallelujah|jeff buckley': 'Buckley turned Cohen\'s hymn into something transcendent',
    'hurt|johnny cash': 'Johnny Cash turning a Nine Inch Nails song into a farewell letter',
    'nothing compares 2 u|sinead o\'connor': 'Sinead\'s single tear — one of music\'s most powerful moments',
    'tears in heaven|eric clapton': 'Clapton\'s most devastating and personal song',
    'yesterday|the beatles': 'The most covered song in history — timeless melancholy',
    'let it be|the beatles': 'When you find yourself in times of trouble...',
    'the sound of silence|simon & garfunkel': 'The darkness of silence rendered in perfect harmony',
    'bridge over troubled water|simon & garfunkel': 'A musical embrace when everything feels impossible',
    'wish you were here|pink floyd': 'Pink Floyd\'s elegy for lost friends and lost time',
    'comfortably numb|pink floyd': 'The guitar solo that speaks louder than words',
    'someone like you|adele': 'Adele\'s voice turning heartbreak into catharsis',
    'hello|adele': 'Adele calling from the other side — instantly iconic',
    'set fire to the rain|adele': 'Power and pain in Adele\'s most dramatic moment',
    'back to black|amy winehouse': 'Amy Winehouse\'s darkest, most brilliant moment',
    'love is a losing game|amy winehouse': 'Amy at her most vulnerable — jazz-infused heartbreak',
    'say something|a great big world': 'The piano ballad that made everyone cry',
    'jealous|labrinth': 'Raw, unfiltered emotion in every note',
    'how to save a life|the fray': 'The song that became every hospital scene\'s soundtrack',
    'good 4 u|olivia rodrigo': 'Gen Z anger anthems — Paramore meets pop punk',
    'drivers license|olivia rodrigo': 'The debut that broke streaming records with raw heartbreak',
    // New chill additions
    'stolen dance|milky chance': 'German indie-folk that became everyone\'s summer anthem',
    'put your records on|corinne bailey rae': 'The most gentle encouragement in song form',
    'gravity|john mayer': 'John Mayer\'s voice at its most effortlessly soulful',
    'slow dancing in a burning room|john mayer': 'Blues-soaked tension between two people falling apart',
    'vienna|billy joel': 'Billy Joel reminding you to slow down — timeless advice',
    'chasing cars|snow patrol': 'Lying on your back, staring at the sky, feeling everything',
    'yellow|coldplay': 'Coldplay at their most sincere and starlit',
    'the scientist|coldplay': 'Going back to the start — piano-driven perfection',
    'fix you|coldplay': 'When you try your best but you don\'t succeed...',
    'thinking out loud|ed sheeran': 'Ed Sheeran\'s most romantic slow dance',
    'perfect|ed sheeran': 'A modern love song that earned its place at every wedding',
    'stay|rihanna': 'Rihanna stripped bare — vulnerability at its finest',
    'fallin\'|alicia keys': 'Alicia Keys at the piano — pure soul debut',
    'no one|alicia keys': 'No one can get in the way — Alicia\'s most uplifting anthem',
    'say you won\'t let go|james arthur': 'A love story told in three verses of pure devotion',
    'cardigan|taylor swift': 'Taylor Swift\'s folklore era — indie meets storytelling',
    'lover|taylor swift': 'Taylor\'s most tender love song — paper rings and all',
    // New adventure additions
    'ho hey|the lumineers': 'Stomping folk-rock that makes you want to road trip',
    'radioactive|imagine dragons': 'The anthemic intro that launched a thousand playlists',
    'believer|imagine dragons': 'Pain into power — arena rock for the modern age',
    'pompeii|bastille': 'Ehh-oh — the most singalong-friendly apocalypse',
    'counting stars|onerepublic': 'OneRepublic at their most anthemic and catchy',
    'viva la vida|coldplay': 'Coldplay channeling revolution into euphoria',
    'adventure of a lifetime|coldplay': 'The Coldplay song that makes you feel alive',
    'paradise|coldplay': 'Dreaming of paradise — Coldplay\'s most cinematic moment',
    'ride|twenty one pilots': 'Twenty One Pilots at their most carefree',
    'stressed out|twenty one pilots': 'Nostalgia wrapped in a beat everyone knows',
    'cheap thrills|sia': 'Sia proving you don\'t need money to dance',
    'chandelier|sia': 'One of the most powerful pop vocals of the decade',
    'thunder|imagine dragons': 'Lightning then the thunder — instant energy',
    'something just like this|the chainsmokers': 'EDM meets Coldplay — massive feel-good anthem',
    'closer|the chainsmokers': 'The song that defined a whole summer',
    'sunflower|post malone': 'Post Malone at his most sunny and effortless',
    'circles|post malone': 'Melancholy wrapped in a catchy loop you can\'t escape',
    // New contemplative additions
    'breathe me|sia': 'The Six Feet Under finale song — devastating beauty',
    'hide and seek|imogen heap': 'Vocoder magic that still gives chills',
    'skinny love|birdy': 'A teenager\'s cover that rivaled the original',
    'a thousand years|christina perri': 'Eternal love in its simplest, most beautiful form',
    'river flows in you|yiruma': 'The piano piece that launched a million covers',
    'lovely|billie eilish': 'Billie and Khalid trapped in beautiful melancholy',
    'ocean eyes|billie eilish': 'The bedroom recording that started a revolution',
    'when the party\'s over|billie eilish': 'Billie\'s voice floating in devastating simplicity',
    'exile|taylor swift': 'Taylor and Bon Iver creating folk-pop perfection',
    'all too well|taylor swift': 'Taylor\'s ten-minute masterpiece of heartbreak',
    'heather|conan gray': 'Gen Z heartbreak distilled into three and a half minutes',
    // New indie additions
    'r u mine|arctic monkeys': 'Arctic Monkeys at their most swaggering',
    'somebody told me|the killers': 'The Killers\' most frantic and infectious single',
    'mr. brightside|the killers': 'The song that never left the charts — eternal indie anthem',
    'somebody that i used to know|gotye': 'The breakup anthem heard round the world',
    'sex on fire|kings of leon': 'Kings of Leon\'s most explosive arena rocker',
    'use somebody|kings of leon': 'Yearning wrapped in an anthemic chorus',
    'lonely boy|the black keys': 'Garage rock swagger with an irresistible groove',
    'pumped up kicks|foster the people': 'The catchiest dark song ever written',
    'sit next to me|foster the people': 'Foster the People\'s grooviest invitation',
    'are you gonna be my girl|jet': 'Australian rock that makes you move instantly',
    'last nite|the strokes': 'The Strokes defining a decade of cool',
    'reptilia|the strokes': 'Raw NYC energy in guitar form',
    'sweater weather|the neighbourhood': 'The chill indie anthem that dominated Tumblr',
    // City-specific
    'empire state of mind|jay-z': 'Jay-Z\'s love letter to New York — concrete jungle energy',
    'new york, new york|frank sinatra': 'Sinatra making every city kid feel ten feet tall',
    'no sleep till brooklyn|beastie boys': 'The Beasties at their most punk',
    'juicy|the notorious b.i.g.': 'Biggie turning struggle into triumph',
    'n.y. state of mind|nas': 'Nas painting Queensbridge in vivid detail',
    'california love|tupac': 'West coast anthem — still goes off at any party',
    'hotel california|eagles': 'A mystery wrapped in a guitar solo',
    'under the bridge|red hot chili peppers': 'L.A. loneliness, beautifully rendered',
    'jolene|dolly parton': 'Dolly turns vulnerability into power',
    'tennessee whiskey|chris stapleton': 'That voice could fill a cathedral',
    'ring of fire|johnny cash': 'The Man in Black\'s most iconic moment',
    'smells like teen spirit|nirvana': 'The song that changed rock music overnight',
    'black hole sun|soundgarden': 'Chris Cornell\'s voice soaring over grunge',
    'london calling|the clash': 'Punk rock\'s most urgent dispatch',
    'waterloo sunset|the kinks': 'Ray Davies watching London glow at dusk',
    'la vie en rose|edith piaf': 'Piaf\'s voice is the sound of Paris itself',
    'digital love|daft punk': 'French robots making the most human love song',
    'heroes|david bowie': 'Bowie and Berlin — just for one day',
    'plastic love|mariya takeuchi': 'Japanese city pop perfection — the internet\'s favorite rediscovery',
    'dynamite|bts': 'K-pop\'s biggest act delivering pure disco joy',
    'essence|wizkid': 'The Afrobeats song that crossed every border',
    'last last|burna boy': 'Burna Boy turning heartbreak into a global anthem',
    'chan chan|buena vista social club': 'Cuban son at its most soulful and timeless',
    'down under|men at work': 'Australia\'s unofficial national anthem',
    'entre dos aguas|paco de lucía': 'Paco de Lucía\'s flamenco guitar — the soul of Spain in six strings',
    'corazón partío|alejandro sanz': 'Alejandro Sanz\'s heartbreak anthem that all of Spain knows by heart',
    'malamente|rosalía': 'Rosalía fusing flamenco with electronic beats — a new Spanish revolution',
    'despechá|rosalía': 'Rosalía\'s summer anthem — reggaeton with flamenco DNA',
    'me portaré bonito|rosalía': 'Rosalía at her most playful and irresistible',
    'aserejé|las ketchup': 'The Spanish earworm that conquered the world in 2002',
    'macarena|los del río': 'The most famous Spanish export — you already know the dance',
    'tú me dejaste de querer|c. tangana': 'C. Tangana blending flamenco, reggaeton, and raw emotion',
    'ingobernable|c. tangana': 'Madrid\'s modern sound — streetwise and unstoppable',
    'la bicicleta|shakira': 'Shakira and Carlos Vives riding through summer',
    'yo no soy esa|mari trini': 'A defiant feminist anthem from 1970s Spain',
    'jai ho|a.r. rahman': 'Bollywood grandeur that won the Oscar',
    'sweet home chicago|robert johnson': 'Where the blues began — delta legend',
    'volare|dean martin': 'Dean Martin flying through the blue painted sky',
    // duplicate removed (girl from ipanema already above)
    // Detroit
    'my girl|the temptations': 'The Temptations\' sweetest moment — pure Motown magic',
    "ain't too proud to beg|the temptations": 'The Temptations getting down on their knees, soul intact',
    "what's going on|marvin gaye": 'Marvin Gaye\'s masterpiece — social consciousness wrapped in silk',
    'respect|aretha franklin': 'The Queen of Soul demanding what she deserves',
    'i heard it through the grapevine|marvin gaye': 'That bassline and those strings — Motown perfection',
    'signed sealed delivered|stevie wonder': 'Young Stevie at his most joyful and irresistible',
    'lose yourself|eminem': 'Detroit\'s own — one shot, one opportunity',
    'seven nation army|the white stripes': 'That riff conquered every stadium on Earth',
    'strings of life|derrick may': 'The track that launched Detroit techno into the world',
    'big fun|inner city': 'Detroit techno\'s most euphoric anthem',
    // Atlanta
    'hey ya!|outkast': 'André 3000 made the whole world shake it like a Polaroid picture',
    'so fresh, so clean|outkast': 'OutKast dripping with Southern cool',
    'ms. jackson|outkast': 'OutKast turning heartbreak into a hit — forever sorry',
    'rosa parks|outkast': 'OutKast commanding the back of the bus',
    'crazy|gnarls barkley': 'CeeLo\'s voice over Danger Mouse\'s production — instant classic',
    'waterfalls|tlc': 'TLC\'s masterpiece — still as relevant as ever',
    'no scrubs|tlc': 'TLC setting the standard, zero tolerance',
    'welcome to atlanta|jermaine dupri': 'ATL\'s official welcome mat',
    'yeah!|usher': 'Usher + Lil Jon = the 2000s in one song',
    "what's your fantasy|ludacris": 'Ludacris putting ATL on the map, uncensored',
    // Memphis
    'walking in memphis|marc cohn': 'The definitive Memphis love letter',
    'green onions|booker t': 'Stax Records in its purest form — that Hammond organ',
    "hold on i'm comin'|sam & dave": 'Sam & Dave at full Stax power',
    'soul man|sam & dave': 'The song that defines Memphis soul',
    "that's all right|elvis presley": 'Where rock and roll was born — Sun Studio, 1954',
    'suspicious minds|elvis presley': 'Elvis at his dramatic peak',
    'in the midnight hour|wilson pickett': 'Wilson Pickett and the birth of the midnight groove',
    'try a little tenderness|otis redding': 'Otis builds from a whisper to a storm',
    'mustang sally|wilson pickett': 'Ride, Sally, ride — pure Memphis energy',
    // Minneapolis
    'purple rain|prince': 'Prince\'s magnum opus — guitar heroism and pure emotion',
    'let\'s go crazy|prince': 'Dearly beloved, we are gathered here today...',
    'little red corvette|prince': 'Prince turning a car metaphor into pop perfection',
    '1999|prince': 'Prince partying like there\'s no tomorrow, in 1982',
    'sign o\' the times|prince': 'Prince\'s most ambitious and political statement',
    'raspberry beret|prince': 'Psychedelic pop perfection from Minneapolis',
    "can't hardly wait|the replacements": 'The Replacements at their most anthemic and beautiful',
    'bastards of young|the replacements': 'Minneapolis punk rock at its rawest',
    // Philadelphia
    "ain't no stoppin' us now|mcfadden & whitehead": 'The Sound of Philadelphia — unstoppable groove',
    'me and mrs. jones|billy paul': 'The smoothest forbidden love song ever recorded',
    "if you don't know me by now|harold melvin": 'Philly soul at its most pleading and gorgeous',
    't.s.o.p.|mfsb': 'The literal Sound of Philadelphia — Soul Train\'s theme',
    'love train|the o\'jays': 'The O\'Jays calling for worldwide unity, with a groove',
    'back stabbers|the o\'jays': 'Paranoia never sounded this good',
    'summertime|dj jazzy jeff': 'The Fresh Prince\'s lazy summer anthem',
    'streets of philadelphia|bruce springsteen': 'Springsteen\'s haunting Philly elegy',
    // Boston
    'more than a feeling|boston': 'Boston the band, from Boston the city — arena rock perfection',
    'shipping up to boston|dropkick murphys': 'The Departed put this song in everyone\'s head permanently',
    'sweet caroline|neil diamond': 'Fenway Park\'s 8th-inning tradition — the whole city sings along',
    "don't look back|boston": 'Boston keeping the momentum going — pure guitar rock',
    'peace of mind|boston': 'Tom Scholz\'s guitar tone is basically a warm hug',
    'rock and roll band|boston': 'Boston writing about being Boston — meta and magnificent',
    'dream on|aerosmith': 'Steven Tyler\'s wail echoing through every classic rock station',
    'walk this way|aerosmith': 'Aerosmith x Run-DMC — the crossover that changed music',
    'roadrunner|the modern lovers': 'Jonathan Richman cruising Route 128 — Boston punk\'s origin',
    "i'm gonna be (500 miles)|the proclaimers": 'Not from Boston, but try not singing it at a Red Sox game',
    // Honolulu
    'somewhere over the rainbow|israel kamakawiwo\'ole': 'IZ\'s ukulele version — the sound of pure peace',
    'blue hawaii|elvis presley': 'Elvis in paradise — tropical romanticism',
    'tiny bubbles|don ho': 'Don Ho\'s signature — classic Hawaiian warmth',
    'island style|john cruz': 'Modern Hawaiian music at its most authentic',
    'white sandy beach|israel kamakawiwo\'ole': 'IZ painting Hawaii with his voice',
    // Toronto
    'started from the bottom|drake': 'Drake\'s origin story — Toronto to the world',
    'hotline bling|drake': 'That beat and that dance — inescapable',
    'starboy|the weeknd': 'The Weeknd\'s darkest flex',
    'call me maybe|carly rae jepsen': 'The most infectious pop hook of the 2010s',
    'ahead by a century|the tragically hip': 'Canada\'s most beloved band, their most beloved song',
    'heart of gold|neil young': 'Neil Young searching and never quite finding',
    'summer of \'69|bryan adams': 'Bryan Adams\' anthem for endless summers',
    'you oughta know|alanis morissette': 'Alanis unleashing Canadian rage into the mainstream',
    // Dublin
    'sunday bloody sunday|u2': 'U2\'s most urgent and political statement',
    'with or without you|u2': 'The Edge\'s delay pedal + Bono\'s voice = arena perfection',
    'zombie|the cranberries': 'Dolores O\'Riordan\'s voice cutting through the noise',
    'linger|the cranberries': 'Dolores at her most tender and vulnerable',
    'galway girl|steve earle': 'An American falling for Ireland, beautifully',
    'whiskey in the jar|thin lizzy': 'Thin Lizzy turning Irish folk into rock legend',
    'the boys are back in town|thin lizzy': 'Phil Lynott and the lads — Dublin rock royalty',
    'fairytale of new york|the pogues': 'The greatest Christmas song ever (fight me)',
    'take me to church|hozier': 'Hozier turning Wicklow poetry into a global anthem',
    // Lisbon
    'estranha forma de vida|amália rodrigues': 'Amália — the voice that IS Portuguese fado',
    'canção do mar|dulce pontes': 'The song of the sea — Portugal\'s Atlantic soul',
    'chuva|mariza': 'Modern fado royalty — Mariza\'s voice aches beautifully',
    'desfado|ana moura': 'Ana Moura rewriting fado\'s rules',
    'grândola vila morena|zeca afonso': 'The song that started Portugal\'s revolution',
    // Vienna
    'the blue danube|johann strauss': 'The waltz that made Vienna the center of the world',
    'eine kleine nachtmusik|mozart': 'Mozart\'s most famous night music — timeless elegance',
    'rock me amadeus|falco': 'Austria\'s biggest pop export — Falco bridges centuries',
    'der kommissar|falco': 'Falco\'s new wave classic — Vienna after dark',
    'für elise|beethoven': 'The piano piece everyone knows, still magical every time',
    // Istanbul
    'istanbul (not constantinople)|they might be giants': 'Geography lesson disguised as a pop banger',
    'simarik|tarkan': 'Tarkan\'s kiss — Turkish pop conquered Europe with this',
    'dönence|barış manço': 'Anatolian rock royalty — psychedelic Turkey',
    // Buenos Aires
    'la cumparsita|julio sosa': 'The most famous tango ever written',
    'por una cabeza|carlos gardel': 'Gardel\'s tango masterpiece — heard in every movie ballroom',
    'libertango|astor piazzolla': 'Piazzolla revolutionized tango — this is where old meets new',
    'oblivion|astor piazzolla': 'Piazzolla\'s most hauntingly beautiful composition',
    'de música ligera|soda stereo': 'Argentina\'s greatest rock band at their purest',
    'persiana americana|soda stereo': 'Soda Stereo\'s post-punk brilliance',
    // Stockholm
    'sos|abba': 'ABBA\'s breakthrough — Swedish pop perfection begins here',
    'the final countdown|europe': 'That synth riff is Sweden\'s gift to arenas worldwide',
    'the sign|ace of base': 'Scandinavian pop at its most addictive',
    'lovefool|the cardigans': 'Love me love me — Swedish indie pop\'s sweetest moment',
    'heartbeats|the knife': 'The Knife\'s minimal masterpiece — fragile and fierce',
    'dancing on my own|robyn': 'The greatest sad dance song ever written',
    'with every heartbeat|robyn': 'Robyn turning heartbreak into an electronic anthem',
    'save tonight|eagle-eye cherry': 'Swedish warmth in acoustic form',
};
/** Generate a reason for a track based on song knowledge + vibe context */
function generateReason(t, vibe, city) {
    const key = `${t.title}|${t.artist}`.toLowerCase();
    // Check for specific song knowledge
    for (const [songKey, reason] of Object.entries(SONG_REASONS)) {
        if (key.includes(songKey.split('|')[0]) && key.includes(songKey.split('|')[1])) {
            return reason;
        }
    }
    // Fallback: vibe-based reason templates
    const vibeReasons = {
        chill: [
            `${t.artist} brings the calm, unhurried energy you need`,
            `A gentle pace from ${t.artist} — perfect for unwinding`,
            `${t.artist}'s softer side, ideal for a low-key day`,
        ],
        upbeat: [
            `${t.artist} delivering instant good vibes`,
            `Feel-good energy from ${t.artist} to keep you moving`,
            `${t.artist} knows how to lift the mood`,
        ],
        adventure: [
            `${t.artist} soundtracks the unknown — perfect for exploring`,
            `The energy of discovery, courtesy of ${t.artist}`,
            `${t.artist} for when the journey matters as much as the destination`,
        ],
        romantic: [
            `${t.artist}'s tender side — for those quiet moments together`,
            `Romance in every note from ${t.artist}`,
            `${t.artist} setting the mood effortlessly`,
        ],
        nightout: [
            `${t.artist} bringing the after-dark energy`,
            `Peak nightlife sound from ${t.artist}`,
            `${t.artist} turns any night into an event`,
        ],
        contemplative: [
            `${t.artist} creates space for reflection`,
            `Layered and thoughtful — ${t.artist} at their most introspective`,
            `The kind of ${t.artist} track that makes you pause and think`,
        ],
        groovy: [
            `${t.artist} makes it impossible to sit still`,
            `Pure rhythm and soul from ${t.artist}`,
            `${t.artist}'s groove speaks directly to your feet`,
        ],
        indie: [
            `${t.artist} — the kind of pick that makes people ask "who's this?"`,
            `Under-the-radar brilliance from ${t.artist}`,
            `${t.artist} rewards repeated listening`,
        ],
        tropical: [
            `${t.artist} brings instant warmth and sun`,
            `Beachy, breezy vibes from ${t.artist}`,
            `${t.artist} makes it feel like vacation`,
        ],
        melancholy: [
            `${t.artist} sitting with the feeling, not fighting it`,
            `Beautiful sadness from ${t.artist} — sometimes you need this`,
            `${t.artist} turns melancholy into something gorgeous`,
        ],
    };
    // City-based fallback
    if (city) {
        const cityTemplates = [
            `${t.artist} captures the energy of a day in ${city}`,
            `The right soundtrack for exploring ${city}`,
            `${t.artist} pairs perfectly with ${city}'s vibe`,
        ];
        if (!vibeReasons[vibe]) {
            return cityTemplates[Math.floor(Math.random() * cityTemplates.length)];
        }
    }
    const templates = vibeReasons[vibe] || vibeReasons.upbeat;
    return templates[Math.floor(Math.random() * templates.length)];
}
async function aiPickSongs(city, mood) {
    try {
        const dedalus = getDedalus();
        const moodStr = mood ? ` They're feeling ${mood}.` : '';
        const response = await dedalus.chat.completions.create({
            model: 'anthropic/claude-haiku-4-5',
            messages: [
                {
                    role: 'system',
                    content: `You are a music curator. Given a city and mood, suggest 5 songs that perfectly match the vibe.

Rules:
- Pick POPULAR, widely-recognized songs — songs most people would know and enjoy. Think Spotify top charts, movie soundtracks, iconic hits.
- Songs MUST be connected to the city — either from artists born/based there, songs about that city, or songs that define its musical culture (e.g. jazz for New Orleans, bossa nova for Rio, K-pop for Seoul)
- At least 3 of the 5 songs should be mainstream hits with hundreds of millions of streams
- Include at least one song from the last 5 years
- Use the EXACT original song title — no remixes, covers, or alternate versions. Use the most well-known version by the original artist.
- Each song needs a short, specific reason (1 sentence, casual tone — like a friend explaining why they added it)
- Respond ONLY with valid JSON array, no other text

Format: [{"title":"Song Name","artist":"Artist Name","reason":"Why this song fits"}]`,
                },
                {
                    role: 'user',
                    content: `City: ${city}${moodStr}`,
                },
            ],
            temperature: 0.9,
            max_tokens: 500,
        });
        const content = response.choices?.[0]?.message?.content?.trim() || '';
        // Extract JSON from response (handles markdown code blocks)
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (!jsonMatch)
            return null;
        const parsed = JSON.parse(jsonMatch[0]);
        if (!Array.isArray(parsed) || parsed.length === 0)
            return null;
        return parsed.slice(0, 5).filter(t => t.title && t.artist);
    }
    catch (err) {
        console.error('[Spotify] AI song pick failed:', err);
        return null;
    }
}
// ── Main export ─────────────────────────────────────────────────────────
exports.spotifyService = {
    async getPlaylist(city, mood) {
        const TRACK_COUNT = 5;
        // 1. Prefer curated static playlists for known cities (reliable, verified songs)
        const cityKey = matchCity(city);
        if (cityKey) {
            console.log(`[Spotify] Using curated playlist for ${city} (matched: ${cityKey})`);
            const cityPlaylist = CITY_PLAYLISTS[cityKey];
            const allPicked = pickRandom(cityPlaylist.tracks, Math.min(TRACK_COUNT, cityPlaylist.tracks.length));
            const tracksWithPreviews = await Promise.all(allPicked.map(async (t) => ({
                ...t,
                previewUrl: await fetchDeezerPreview(t.artist, t.title),
                reason: generateReason(t, cityPlaylist.mood, city),
            })));
            return {
                success: true,
                data: { ...cityPlaylist, tracks: tracksWithPreviews }
            };
        }
        // 2. Unknown city — try AI-powered song picking
        console.log(`[Spotify] No curated playlist for ${city}, trying AI picker`);
        const aiTracks = await aiPickSongs(city, mood);
        if (aiTracks && aiTracks.length >= 3) {
            console.log(`[Spotify] AI picked ${aiTracks.length} songs for ${city}`);
            const tracksWithPreviews = await Promise.all(aiTracks.map(async (t) => ({
                ...track(t.title, t.artist),
                previewUrl: await fetchDeezerPreview(t.artist, t.title),
                reason: t.reason,
            })));
            const playlistNames = [
                `${city} Today`, `Your ${city} Mix`, `${city} Vibes`,
                `A Day in ${city}`, `${city} Soundtrack`,
            ];
            const playlistName = playlistNames[Math.floor(Math.random() * playlistNames.length)];
            return {
                success: true,
                data: {
                    name: playlistName,
                    description: `Curated for your day in ${city}`,
                    tracks: tracksWithPreviews,
                    mood: mood || 'curated',
                    playlistUrl: `https://open.spotify.com/search/${encodeURIComponent(`${city} vibes`)}`
                }
            };
        }
        // 3. Last resort — vibe-based playlist from mood
        console.log(`[Spotify] AI failed for ${city}, falling back to vibe pools`);
        const moodVibes = moodToVibes(mood);
        let vibes = [...new Set(moodVibes)];
        if (vibes.length === 0)
            vibes = ['upbeat', 'adventure'];
        const candidateTracks = [];
        for (const vibe of vibes) {
            const pool = VIBE_POOLS[vibe];
            if (pool)
                candidateTracks.push(...pool.tracks);
        }
        const seen = new Set();
        const uniqueTracks = candidateTracks.filter(t => {
            const key = `${t.title}|${t.artist}`.toLowerCase();
            if (seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
        const picked = pickRandom(uniqueTracks, TRACK_COUNT);
        const primaryVibe = vibes[0];
        const pool = VIBE_POOLS[primaryVibe] || VIBE_POOLS.upbeat;
        const name = pool.names[Math.floor(Math.random() * pool.names.length)];
        const description = pool.descriptions[Math.floor(Math.random() * pool.descriptions.length)];
        const tracksWithPreviews = await Promise.all(picked.map(async (t) => ({
            ...t,
            previewUrl: await fetchDeezerPreview(t.artist, t.title),
            reason: generateReason(t, primaryVibe, city),
        })));
        return {
            success: true,
            data: {
                name,
                description,
                tracks: tracksWithPreviews,
                mood: primaryVibe,
                playlistUrl: `https://open.spotify.com/search/${encodeURIComponent(name)}`
            }
        };
    }
};
