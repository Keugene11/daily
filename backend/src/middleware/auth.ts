import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabase-admin';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export async function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.slice(7);

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      console.warn('[Auth] Token verification failed:', error?.message);
      return next();
    }
    req.userId = user.id;
    req.userEmail = user.email;
  } catch (err) {
    console.warn('[Auth] Unexpected error:', err instanceof Error ? err.message : err);
  }

  next();
}
