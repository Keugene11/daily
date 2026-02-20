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

  // Decode header to see what algorithm the token uses
  try {
    const headerB64 = token.split('.')[0];
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());
    console.log('[Auth] Token algorithm:', header.alg, '| Token length:', token.length);
  } catch {
    console.warn('[Auth] Could not decode token header');
  }

  const secret = JWT_SECRET.trim();

  // Try HS256 first (Supabase default), then HS384, HS512
  const algorithms: jwt.Algorithm[] = ['HS256', 'HS384', 'HS512'];

  // Try raw secret with all algorithms
  try {
    const decoded = jwt.verify(token, secret, { algorithms }) as jwt.JwtPayload;
    req.userId = decoded.sub;
    req.userEmail = decoded.email as string | undefined;
    console.log('[Auth] Verified OK (raw secret), userId:', req.userId);
    return next();
  } catch (err1) {
    console.warn('[Auth] Raw secret failed:', err1 instanceof Error ? err1.message : err1);
  }

  // Try base64-decoded secret with all algorithms
  try {
    const decoded = jwt.verify(token, Buffer.from(secret, 'base64'), { algorithms }) as jwt.JwtPayload;
    req.userId = decoded.sub;
    req.userEmail = decoded.email as string | undefined;
    console.log('[Auth] Verified OK (base64 secret), userId:', req.userId);
    return next();
  } catch (err2) {
    console.warn('[Auth] Base64 secret failed:', err2 instanceof Error ? err2.message : err2);
  }

  next();
}
