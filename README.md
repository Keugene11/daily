# Daily

- **Travel/lifestyle discovery app** that helps users find **attractions**, **restaurants**, and **nightlife** — powered by **AI** (Anthropic SDK) with a **React + Vite** frontend and **Express** backend, deployed on **Vercel**
- Monetized via **Stripe** with **monthly** and **yearly** pro plans, using **Supabase** for **auth** and **subscription storage**

**Live at [getdaily.live](https://getdaily.live)**

## Features

- Personalized itineraries with real-time data from 9+ tools
- Google Places integration for restaurants and attractions
- Interactive map plotting all locations mentioned in the plan
- Nightlife mode for evening-focused bar, club, and late-night plans
- Weather-based outfit suggestions
- Plan history with cloud sync
- Dark/light theme
- Pro tier with unlimited plans via Stripe

## How It Works

1. You enter a city and budget preference
2. The backend deterministically calls all relevant tools in parallel — no LLM round-trip needed for tool selection
3. Real-time data streams in via SSE — you see each tool call as it happens
4. Claude Sonnet synthesizes everything into a personalized itinerary with real venue names, prices, and clickable Google Maps links
5. An interactive map plots all mentioned locations

## Architecture

- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Backend**: Express.js + TypeScript + Anthropic SDK
- **Standalone Functions**: Vercel serverless functions for Stripe, subscriptions, and auth
- **Communication**: Server-Sent Events (SSE) for real-time streaming
- **AI Model**: Claude Sonnet via Anthropic API
- **Database**: Supabase (Postgres) for plans, subscriptions, and user data
- **Payments**: Stripe (monthly/yearly Pro plans)
- **Auth**: Supabase Auth with Google OAuth

## Deployment

Deployed on Vercel. Production branch is `main`, development branch is `master`.

```bash
git push origin master master:main
```

## License

MIT
