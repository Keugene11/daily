import dotenv from 'dotenv';
import path from 'path';

// Load .env before importing app (local dev only)
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

import { app } from './app';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🎯 Plan endpoint: http://localhost:${PORT}/api/plan\n`);

  if (!process.env.DEDALUS_API_KEY || process.env.DEDALUS_API_KEY === 'your_dedalus_api_key_here') {
    console.warn('⚠️  Warning: DEDALUS_API_KEY not configured in .env file');
  }
  if (!process.env.NEWS_API_KEY || process.env.NEWS_API_KEY === 'your_newsapi_key_here') {
    console.warn('⚠️  Warning: NEWS_API_KEY not configured (news tool will fail)');
  }
  console.log('');
});

export { app };
