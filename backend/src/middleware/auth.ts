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
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.slice(7);

  // Try to verify — if it works, attach user info; if not, continue anyway
  try {
    const decoded = jwt.verify(token, JWT_SECRET.trim(), { algorithms: ['HS256'] }) as jwt.JwtPayload;
    req.userId = decoded.sub;
    req.userEmail = decoded.email as string | undefined;
  } catch {
    try {
      const decoded = jwt.verify(token, Buffer.from(JWT_SECRET.trim(), 'base64'), { algorithms: ['HS256'] }) as jwt.JwtPayload;
      req.userId = decoded.sub;
      req.userEmail = decoded.email as string | undefined;
    } catch (err) {
      console.warn('[Auth] Token verification failed:', err instanceof Error ? err.message : err);
    }
  }

  next();
}
