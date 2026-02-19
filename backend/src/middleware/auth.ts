import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

// When JWT secret isn't configured, auth is optional (dev mode)
const SKIP_AUTH = !JWT_SECRET;

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (SKIP_AUTH) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);

  try {
    // Try verifying with the secret as-is first, then base64-decoded
    let decoded: jwt.JwtPayload | null = null;
    try {
      decoded = jwt.verify(token, JWT_SECRET!.trim(), { algorithms: ['HS256'] }) as jwt.JwtPayload;
    } catch {
      decoded = jwt.verify(token, Buffer.from(JWT_SECRET!.trim(), 'base64'), { algorithms: ['HS256'] }) as jwt.JwtPayload;
    }

    req.userId = decoded.sub;
    req.userEmail = decoded.email as string | undefined;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (err instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    return res.status(401).json({ error: 'Authentication failed' });
  }
}
