# Quick Start Guide

## 🚀 Starting the App

### Option 1: PowerShell Script (Recommended)

**Right-click** `start-servers.ps1` and select **"Run with PowerShell"**

Or open PowerShell and run:
```powershell
cd c:\Users\keuge\projects\daily
.\start-servers.ps1
```

### Option 2: Manual Start

Open **two separate terminals** and run:

**Terminal 1 - Backend:**
```bash
cd c:\Users\keuge\projects\daily\backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd c:\Users\keuge\projects\daily\frontend
npm run dev
```

## 🌐 Access the App

Once both servers show "ready" or "compiled successfully", open:

### http://localhost:8081

## ✨ Using the App

1. **Enter a city**: "San Francisco", "New York", "London", etc.
2. **Select interests**: Click on tags like Food, Outdoors, Culture
3. **Click "Plan My Day ✨"**
4. **Watch the AI agent work**:
   - 🌤️ Checking weather (wttr.in)
   - 🎉 Finding events
   - 📰 Getting news (NewsAPI)
   - 🎲 Suggesting activities (Bored API)
5. **Get your personalized day plan!**

## 🔧 Troubleshooting

### Servers won't start
- Make sure Node.js is installed: `node --version`
- Check ports aren't in use: Backend (8080), Frontend (8081)
- Try closing and restarting the terminal windows

### "Cannot find module" errors
- Run `npm install` in both `backend` and `frontend` directories

### API errors
- Backend: Check `backend/.env` has valid `DEDALUS_API_KEY`
- News: Optional - add `NEWS_API_KEY` if you want news headlines

## 📝 Configuration

- **Ports**: Backend (8080), Frontend (8081)
  - Change in: `backend/.env` and `frontend/vite.config.ts`

- **API Keys**: `backend/.env`
  - Dedalus: https://www.dedaluslabs.ai/dashboard/api-keys
  - NewsAPI: https://newsapi.org/register

## 🎯 What You Should See

**Backend Terminal:**
```
🚀 Backend server running on http://localhost:8080
📊 Health check: http://localhost:8080/health
```

**Frontend Terminal:**
```
VITE v5.x.x ready in xxx ms
➜ Local: http://localhost:8081/
```

**Browser (http://localhost:8081):**
- Purple gradient background
- "What Should I Do Today?" heading
- City input and interest selector
- "Plan My Day ✨" button

Enjoy! 🎉
