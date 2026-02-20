// v2 entry point — replaces api/index.ts to bypass Vercel function cache
import { app } from '../backend/dist/app';

export default app;
