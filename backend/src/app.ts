import express from 'express';
import cors from 'cors';
import planRouter from './routes/plan';
import { requireAuth } from './middleware/auth';

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
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    dedalusConfigured: !!(process.env.DEDALUS_API_KEY && process.env.DEDALUS_API_KEY !== 'your_dedalus_api_key_here'),
    newsApiConfigured: !!(process.env.NEWS_API_KEY && process.env.NEWS_API_KEY !== 'your_newsapi_key_here'),
  });
});

// API routes
app.use('/api', requireAuth, planRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error]', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

export { app };
