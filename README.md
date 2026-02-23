# Daily

AI-powered day planner that generates personalized itineraries for any city. Enter where you're going, and Daily calls 9+ real-time tools (weather, Google Places restaurants & attractions, events, deals, happy hours, and more) to build a complete Morning → Afternoon → Evening plan with real venue names, prices, and Google Maps links.

**Live at [getdaily.live](https://getdaily.live)**

## Features

- Personalized itineraries with real-time data from 9+ tools
- Google Places integration for restaurants and attractions
- Interactive map plotting all locations mentioned in the plan
- Multi-day trip planning (up to 7 days)
- "Right Now" mode for instant recommendations
- Weather-based outfit suggestions
- Plan history with cloud sync
- Dark/light theme
- Pro tier with unlimited plans via Stripe

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/Keugene11/daily.git
cd daily
npm install
cd backend && npm install
cd ../frontend && npm install
cd ..
```

### 2. Add your API keys

Copy `backend/.env.example` to `backend/.env` and fill in:

```env
DEDALUS_API_KEY=your_key_here        # Required — https://www.dedaluslabs.ai/dashboard/api-keys
GOOGLE_PLACES_API_KEY=your_key_here  # Required — Google Cloud Console
NEWS_API_KEY=your_key_here           # Optional — https://newsapi.org/register
PORT=8080
```

Copy `frontend/.env.example` to `frontend/.env`:

```env
VITE_API_URL=http://localhost:8080
VITE_GOOGLE_MAPS_API_KEY=your_key_here
```

### 3. Run

```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

Open **http://localhost:8081** in your browser.

## How It Works

1. You enter a city and budget preference
2. The backend deterministically calls all relevant tools in parallel — no LLM round-trip needed for tool selection
3. Real-time data streams in via SSE — you see each tool call as it happens
4. Claude Sonnet synthesizes everything into a personalized itinerary with real venue names, prices, and clickable Google Maps links
5. An interactive map plots all mentioned locations

## Architecture

- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Backend**: Express.js + TypeScript + Dedalus SDK
- **Standalone Functions**: Vercel serverless functions for Stripe, subscriptions, and auth
- **Communication**: Server-Sent Events (SSE) for real-time streaming
- **AI Model**: Claude Sonnet via Dedalus platform
- **Database**: Supabase (Postgres) for plans, subscriptions, and user data
- **Payments**: Stripe (monthly/yearly Pro plans)
- **Auth**: Supabase Auth with Google OAuth

## Tools

| Tool | Data Source | Description |
|------|-----------|-------------|
| Weather | wttr.in | Temperature, conditions, UV, rain forecast |
| Restaurants | Google Places API | Top-rated restaurants with reviews, price levels |
| Attractions | Google Places API | Landmarks, activities, experiences, entertainment |
| Events | Curated database | Day-specific local events for major cities |
| Free Stuff | Curated database | Free museums, parks, tours, festivals |
| Deals & Coupons | Curated database | Daily deals and discounts |
| Happy Hours | Curated database | Bar specials and happy hour times |
| Accommodations | Google Places API | Hotels and lodging by budget |
| Sunrise/Sunset | sunrise-sunset.org | Golden hour timing |

## Deployment

Deployed on Vercel. Production branch is `main`, development branch is `master`.

```bash
git push origin master master:main
```

## License

MIT
