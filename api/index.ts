import { app } from '../backend/dist/app';

// Force Vercel to rebuild this function — build timestamp: 2026-02-20T01
console.log('[API] Function cold start');

export default app;
