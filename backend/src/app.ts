import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import planRouter from './routes/plan';
import { requireAuth } from './middleware/auth';

// Load environment variables — works from both src/ (dev) and dist/ (prod)
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    dedalusConfigured: !!(process.env.DEDALUS_API_KEY && process.env.DEDALUS_API_KEY !== 'your_dedalus_api_key_here'),
    newsApiConfigured: !!(process.env.NEWS_API_KEY && process.env.NEWS_API_KEY !== 'your_newsapi_key_here'),
    env: {
      DEDALUS_API_KEY_SET: !!process.env.DEDALUS_API_KEY,
      DEDALUS_API_KEY_PREFIX: process.env.DEDALUS_API_KEY?.substring(0, 10),
      NODE_ENV: process.env.NODE_ENV
    }
  });
});

// API routes
app.use('/api', requireAuth, planRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Error]', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

export { app };
