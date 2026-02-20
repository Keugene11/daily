import { app } from '../backend/src/app';

// Test endpoint to verify deployment is current
app.get('/api/deploy-check', (_req: any, res: any) => {
  res.json({ deployed: '2026-02-20-v3', ok: true });
});

export default app;
