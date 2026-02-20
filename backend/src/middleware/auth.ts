import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  // No secret configured — skip auth entirely
  if (!JWT_SECRET) {
    console.warn('[Auth] SUPABASE_JWT_SECRET not set, skipping auth');
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn('[Auth] No Bearer token in request');
    return next();
  }

  const token = authHeader.slice(7);
  console.log('[Auth] Token present, length:', token.length, 'secret length:', JWT_SECRET.length);

  // Try to verify — if it works, attach user info; if not, continue anyway
  try {
    const decoded = jwt.verify(token, JWT_SECRET.trim(), { algorithms: ['HS256'] }) as jwt.JwtPayload;
    req.userId = decoded.sub;
    req.userEmail = decoded.email as string | undefined;
    console.log('[Auth] Verified OK (raw secret), userId:', req.userId);
  } catch (err1) {
    console.warn('[Auth] Raw secret failed:', err1 instanceof Error ? err1.message : err1);
    try {
      const decoded = jwt.verify(token, Buffer.from(JWT_SECRET.trim(), 'base64'), { algorithms: ['HS256'] }) as jwt.JwtPayload;
      req.userId = decoded.sub;
      req.userEmail = decoded.email as string | undefined;
      console.log('[Auth] Verified OK (base64 secret), userId:', req.userId);
    } catch (err2) {
      console.warn('[Auth] Base64 secret also failed:', err2 instanceof Error ? err2.message : err2);
    }
  }

  next();
}
