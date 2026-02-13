# Setup Instructions

## Prerequisites

Before you begin, ensure you have **Node.js** installed:
- Download from: https://nodejs.org
- Recommended: LTS version (v20.x or v18.x)
- Verify installation: `node --version` and `npm --version`

## Quick Setup

### Windows

1. **Run the setup script:**
   ```bash
   setup.bat
   ```

   Or manually:
   ```bash
   npm install
   cd backend && npm install
   cd ../frontend && npm install
   ```

### macOS/Linux

```bash
# Install all dependencies
npm install

# Backend
cd backend && npm install && cd ..

# Frontend
cd frontend && npm install && cd ..
```

## Configure API Keys

1. **Edit `backend/.env`** and add your API keys:
   ```env
   DEDALUS_API_KEY=your_actual_key_here
   NEWS_API_KEY=your_actual_key_here
   PORT=3000
   ```

2. **Get your API keys:**
   - **Dedalus** (required): https://www.dedaluslabs.ai/dashboard/api-keys
   - **NewsAPI** (optional): https://newsapi.org/register

## Run the App

### Development Mode

**Option 1 - Both servers together:**
```bash
npm run dev
```

**Option 2 - Separate terminals:**
```bash
# Terminal 1
cd backend
npm run dev

# Terminal 2
cd frontend
npm run dev
```

The app will be available at:
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

## Troubleshooting

### "npm: command not found"
- Node.js is not installed or not in your PATH
- Reinstall Node.js and check "Add to PATH" during installation
- Restart your terminal after installation

### Port already in use
- Change the port in `backend/.env`: `PORT=3001`
- Or stop the process using the port

### API Key errors
- Make sure you've replaced `your_actual_key_here` with real keys
- Check that `.env` file exists in the `backend` directory
- Restart the backend server after changing `.env`

### Missing dependencies
- Delete `node_modules` folders and `package-lock.json` files
- Run `npm install` again

## Next Steps

Once everything is running:
1. Open http://localhost:5173
2. Enter a city name (e.g., "San Francisco")
3. Select your interests
4. Click "Plan My Day ✨"
5. Watch the AI agent call tools in real-time!

Enjoy! 🎉
