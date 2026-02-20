"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const supabase_admin_1 = require("../lib/supabase-admin");
async function requireAuth(req, _res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
    }
    const token = authHeader.slice(7);
    try {
        const { data: { user }, error } = await supabase_admin_1.supabaseAdmin.auth.getUser(token);
        if (error || !user) {
            console.warn('[Auth] Token verification failed:', error?.message);
            return next();
        }
        req.userId = user.id;
        req.userEmail = user.email;
    }
    catch (err) {
        console.warn('[Auth] Unexpected error:', err instanceof Error ? err.message : err);
    }
    next();
}
