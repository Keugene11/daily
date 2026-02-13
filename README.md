# What Should I Do Today?

An AI-powered day planner that generates personalized daily itineraries using the Dedalus SDK. Enter a city and your interests, and the AI agent autonomously calls 16+ tools (weather, events, restaurants, Spotify playlists, deals, happy hours, and more) to build a Morning → Afternoon → Evening plan with a soundtrack.

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
DEDALUS_API_KEY=your_key_here   # Required — https://www.dedaluslabs.ai/dashboard/api-keys
NEWS_API_KEY=your_key_here      # Optional — https://newsapi.org/register
PORT=8080
```

Copy `frontend/.env.example` to `frontend/.env`:

```env
VITE_API_URL=http://localhost:8080
```

### 3. Run

```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

Open **http://localhost:8081** in your browser.

## What It Does

1. You enter a city + interests (food, outdoors, nightlife, etc.)
2. The AI agent calls tools to gather real-time data:
   - Weather, sunrise/sunset, pollen counts
   - Local events, restaurants, happy hours
   - Free activities, deals/coupons
   - Spotify playlists, trending news
   - Transit estimates, parking, gas prices, wait times
3. Results stream in real-time via SSE — you see each tool call as it happens
4. The AI synthesizes everything into a personalized itinerary with real venue names, prices, and links
5. An interactive map plots all mentioned locations
6. A music player with 30-second previews plays the curated soundtrack

## Architecture

- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Backend**: Express.js + TypeScript + Dedalus SDK
- **Communication**: Server-Sent Events (SSE) for real-time streaming
- **AI Model**: Claude Sonnet 4.5 via Dedalus platform
- **Tools**: 16 custom tool implementations with graceful fallbacks

## API Keys

| Key | Required | Free Tier | Get It |
|-----|----------|-----------|--------|
| Dedalus API | Yes | Yes | [dedaluslabs.ai](https://www.dedaluslabs.ai/dashboard/api-keys) |
| NewsAPI | No | 100 req/day | [newsapi.org](https://newsapi.org/register) |

All other tools (weather, events, restaurants, playlists, etc.) work without API keys.

## License

MIT
