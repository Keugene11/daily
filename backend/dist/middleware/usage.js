"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkUsage = checkUsage;
const supabase_admin_1 = require("../lib/supabase-admin");
const stripe_1 = require("../lib/stripe");
function checkUsage(counter) {
    return async (req, res, next) => {
        const tier = req.tier || 'free';
        const tierConfig = stripe_1.TIERS[tier];
        const limit = tierConfig.planLimit;
        // Unlimited — skip check
        if (limit === Infinity) {
            return next();
        }
        if (!req.userId) {
            return res.status(403).json({
                error: 'limit_reached',
                message: 'Sign in to use this feature',
                tier,
                limit,
                used: 0,
            });
        }
        const dbColumn = 'plan_count';
        try {
            const today = new Date().toISOString().split('T')[0];
            if (tierConfig.period === 'day') {
                const { data } = await supabase_admin_1.supabaseAdmin
                    .from('usage')
                    .select('plan_count')
                    .eq('user_id', req.userId)
                    .eq('date', today)
                    .single();
                const used = data?.[dbColumn] ?? 0;
                if (used >= limit) {
                    return res.status(403).json({
                        error: 'limit_reached',
                        message: `You've used your ${limit} free plan${limit > 1 ? 's' : ''} today`,
                        tier,
                        limit,
                        used,
                    });
                }
                await supabase_admin_1.supabaseAdmin
                    .from('usage')
                    .upsert({ user_id: req.userId, date: today, [dbColumn]: used + 1 }, { onConflict: 'user_id,date' });
            }
            else {
                const monthStart = `${today.slice(0, 7)}-01`;
                const { data: rows } = await supabase_admin_1.supabaseAdmin
                    .from('usage')
                    .select('plan_count')
                    .eq('user_id', req.userId)
                    .gte('date', monthStart);
                const used = (rows || []).reduce((sum, row) => sum + (row[dbColumn] ?? 0), 0);
                if (used >= limit) {
                    return res.status(403).json({
                        error: 'limit_reached',
                        message: `You've used your ${limit} plan${limit > 1 ? 's' : ''} this month`,
                        tier,
                        limit,
                        used,
                    });
                }
                const { data: todayRow } = await supabase_admin_1.supabaseAdmin
                    .from('usage')
                    .select('plan_count')
                    .eq('user_id', req.userId)
                    .eq('date', today)
                    .single();
                const todayCount = todayRow?.[dbColumn] ?? 0;
                await supabase_admin_1.supabaseAdmin
                    .from('usage')
                    .upsert({ user_id: req.userId, date: today, [dbColumn]: todayCount + 1 }, { onConflict: 'user_id,date' });
            }
            next();
        }
        catch (err) {
            console.error('[Usage] Error checking usage:', err);
            next();
        }
    };
}
